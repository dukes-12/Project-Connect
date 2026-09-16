/**
 * Accès aux données. Une fonction par intention d'écran, pas un ORM :
 * chaque requête dit explicitement quelle table ou quelle vue elle lit, ce qui
 * rend visible le passage par les vues masquées pour tout ce qui concerne les
 * autres comptes (§6.1).
 */

import { supabase } from "./client.ts";
import type { Database, Enums, Tables, TablesInsert } from "./database.types.ts";

export type Carte = Tables<"profile_cards">;
export type Hobby = Tables<"hobbies">;
export type Profil = Tables<"users">;
export type CartePublique = Tables<"v_cartes_publiques">;
export type LocalActif = Tables<"v_locaux_actifs">;
export type Message = Tables<"messages">;
export type FicheVille = Tables<"city_guides">;
export type ItemChecklist = Tables<"checklist_items">;
export type TypeCarte = Enums<"type_carte">;

export type GroupePropose =
  Database["public"]["Functions"]["groupes_compatibles"]["Returns"][number];
export type Candidat =
  Database["public"]["Functions"]["candidats_individuels"]["Returns"][number];

/** Enveloppe les erreurs PostgREST en Error, pour un seul style de gestion côté écran. */
function verifier<T>(resultat: { data: T | null; error: { message: string } | null }, quoi: string): T {
  if (resultat.error) throw new Error(`${quoi} : ${resultat.error.message}`);
  if (resultat.data === null) throw new Error(`${quoi} : aucune donnée`);
  return resultat.data;
}

// --------------------------------------------------------------------- profil

export async function lireMonProfil(): Promise<Profil | null> {
  const { data, error } = await supabase.from("users").select("*").maybeSingle();
  if (error) throw new Error(`Lecture du profil : ${error.message}`);
  return data;
}

export async function creerMonProfil(profil: TablesInsert<"users">): Promise<Profil> {
  return verifier(
    await supabase.from("users").insert(profil).select().single(),
    "Création du profil",
  );
}

// --------------------------------------------------------------------- cartes

/** Toutes les cartes du compte, la principale d'abord, puis les plus récentes. */
export async function listerMesCartes(): Promise<Carte[]> {
  return verifier(
    await supabase
      .from("profile_cards")
      .select("*")
      .order("est_principale", { ascending: false })
      .order("created_at", { ascending: false }),
    "Lecture des cartes",
  );
}

export async function creerCarte(carte: TablesInsert<"profile_cards">): Promise<Carte> {
  return verifier(
    await supabase.from("profile_cards").insert(carte).select().single(),
    "Création de la carte",
  );
}

/**
 * Bascule la carte principale. L'index unique partiel interdit deux cartes
 * principales : on retire l'ancienne avant de poser la nouvelle.
 */
export async function definirCartePrincipale(carteId: string, userId: string): Promise<void> {
  const retrait = await supabase
    .from("profile_cards")
    .update({ est_principale: false })
    .eq("user_id", userId)
    .eq("est_principale", true);
  if (retrait.error) throw new Error(`Carte principale : ${retrait.error.message}`);

  const pose = await supabase
    .from("profile_cards")
    .update({ est_principale: true })
    .eq("id", carteId);
  if (pose.error) throw new Error(`Carte principale : ${pose.error.message}`);
}

export async function changerStatutCarte(
  carteId: string,
  statut: Enums<"statut_carte">,
): Promise<void> {
  const { error } = await supabase.from("profile_cards").update({ statut }).eq("id", carteId);
  if (error) throw new Error(`Statut de la carte : ${error.message}`);
}

// -------------------------------------------------------------------- hobbies

export async function listerHobbies(): Promise<Hobby[]> {
  return verifier(
    await supabase.from("hobbies").select("*").order("categorie").order("nom"),
    "Lecture des centres d'intérêt",
  );
}

export async function definirHobbiesDeCarte(carteId: string, hobbyIds: string[]): Promise<void> {
  const suppression = await supabase.from("card_hobbies").delete().eq("card_id", carteId);
  if (suppression.error) throw new Error(`Centres d'intérêt : ${suppression.error.message}`);

  if (hobbyIds.length === 0) return;
  const { error } = await supabase
    .from("card_hobbies")
    .insert(hobbyIds.map((hobby_id) => ({ card_id: carteId, hobby_id })));
  if (error) throw new Error(`Centres d'intérêt : ${error.message}`);
}

export async function lireHobbiesDeCarte(carteId: string): Promise<string[]> {
  const lignes = verifier(
    await supabase.from("card_hobbies").select("hobby_id").eq("card_id", carteId),
    "Centres d'intérêt de la carte",
  );
  return lignes.map((l) => l.hobby_id);
}

// ------------------------------------------------------------------- matching

export interface ResultatActivation {
  action: "groupe_cree" | "groupes_proposes";
  groupe?: GroupePropose;
  groupes: GroupePropose[];
  candidats: Candidat[];
  propositions_creees: number;
  elargissement: { groupes: number; candidats: number };
}

/** Appelle l'edge function `matching` (§8.1, §8.2). */
async function appelerMatching<T>(corps: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("matching", { body: corps });
  if (error) throw new Error(`Matching : ${error.message}`);
  if (data === null) throw new Error("Matching : réponse vide");
  return data;
}

export function activerCarte(carteId: string): Promise<ResultatActivation> {
  return appelerMatching<ResultatActivation>({ action: "activer", carte_id: carteId });
}

export function rejoindreCohorte(carteId: string, groupeId: string) {
  return appelerMatching<{ groupe: GroupePropose }>({
    action: "rejoindre",
    carte_id: carteId,
    groupe_id: groupeId,
  });
}

export function creerSaCohorte(carteId: string) {
  return appelerMatching<{ groupe: GroupePropose }>({
    action: "creer_cohorte",
    carte_id: carteId,
  });
}

/** Propositions individuelles en attente de ma réponse, pour une carte donnée. */
export async function listerMatchsEnAttente(carteId: string) {
  const lignes = verifier(
    await supabase
      .from("individual_matches")
      .select("id, card_id_a, card_id_b, decision_a, decision_b, score, statut")
      .or(`card_id_a.eq.${carteId},card_id_b.eq.${carteId}`)
      .neq("statut", "refuse")
      .order("score", { ascending: false }),
    "Propositions de match",
  );

  return lignes
    .map((m) => {
      const jeSuisA = m.card_id_a === carteId;
      return {
        id: m.id,
        carteAutre: jeSuisA ? m.card_id_b : m.card_id_a,
        maDecision: jeSuisA ? m.decision_a : m.decision_b,
        sonDecision: jeSuisA ? m.decision_b : m.decision_a,
        score: m.score,
        statut: m.statut,
      };
    })
    .filter((m) => m.maDecision === "en_attente");
}

export async function repondreAuMatch(
  matchId: string,
  reponse: Exclude<Enums<"decision_match">, "en_attente">,
) {
  const { error } = await supabase.rpc("repondre_match", {
    match_id: matchId,
    reponse,
  });
  if (error) throw new Error(`Réponse au match : ${error.message}`);
}

/** Profil public d'une carte — passe par la vue masquée, jamais par la table. */
export async function lireCartePublique(carteId: string): Promise<CartePublique | null> {
  const { data, error } = await supabase
    .from("v_cartes_publiques")
    .select("*")
    .eq("card_id", carteId)
    .maybeSingle();
  if (error) throw new Error(`Profil : ${error.message}`);
  return data;
}

// ------------------------------------------------------- découverte des locaux

export async function listerLocaux(ville: string, pays: string): Promise<LocalActif[]> {
  return verifier(
    await supabase
      .from("v_locaux_actifs")
      .select("*")
      .eq("ville", ville)
      .eq("pays", pays)
      .order("card_id"),
    "Locaux de la ville",
  );
}

export async function demanderMiseEnRelation(
  destinataireUserId: string,
  demandeurUserId: string,
  messageIntro: string,
): Promise<void> {
  const { error } = await supabase.from("connections").insert({
    demandeur_user_id: demandeurUserId,
    destinataire_user_id: destinataireUserId,
    message_intro: messageIntro,
    statut: "en_attente",
  });
  if (error) throw new Error(`Demande de mise en relation : ${error.message}`);
}

// ---------------------------------------------------------------- fiche ville

export async function lireFicheVille(ville: string, pays: string): Promise<FicheVille | null> {
  const { data, error } = await supabase
    .from("city_guides")
    .select("*")
    .eq("ville", ville)
    .eq("pays", pays)
    .maybeSingle();
  if (error) throw new Error(`Fiche ville : ${error.message}`);
  return data;
}

/** Événements de la ville qui recoupent le séjour. */
export async function listerEvenements(ville: string, pays: string, debut: string, fin: string) {
  return verifier(
    await supabase
      .from("v_evenements_ville")
      .select("*")
      .eq("ville", ville)
      .eq("pays", pays)
      .lte("date_debut", fin)
      .or(`date_fin.gte.${debut},date_fin.is.null`)
      .order("date_debut"),
    "Événements de la ville",
  );
}

export async function chercherDoublonsEvenement(
  ville: string,
  pays: string,
  titre: string,
  dateDebut: string,
) {
  const { data, error } = await supabase.rpc("evenements_similaires", {
    p_ville: ville,
    p_pays: pays,
    p_titre: titre,
    p_date_debut: dateDebut,
  });
  if (error) throw new Error(`Recherche de doublons : ${error.message}`);
  return data ?? [];
}

// ------------------------------------------------------------------ checklist

export async function listerChecklist(pays: string, ville: string): Promise<ItemChecklist[]> {
  return verifier(
    await supabase
      .from("checklist_items")
      .select("*")
      .eq("pays", pays)
      .or(`ville.is.null,ville.eq.${ville}`)
      .order("ordre"),
    "Checklist d'installation",
  );
}

export async function lireAvancementChecklist(carteId: string) {
  return verifier(
    await supabase
      .from("user_checklist_status")
      .select("checklist_item_id, statut")
      .eq("card_id", carteId),
    "Avancement de la checklist",
  );
}

export async function marquerItemChecklist(
  userId: string,
  carteId: string,
  itemId: string,
  statut: Enums<"statut_checklist">,
): Promise<void> {
  const { error } = await supabase.from("user_checklist_status").upsert({
    user_id: userId,
    card_id: carteId,
    checklist_item_id: itemId,
    statut,
  });
  if (error) throw new Error(`Checklist : ${error.message}`);
}

// ----------------------------------------------------------------- messagerie

export async function listerMesConversations() {
  return verifier(
    await supabase
      .from("conversations")
      .select("id, type, matching_group_id, created_at")
      .order("created_at", { ascending: false }),
    "Conversations",
  );
}

export async function listerMessages(conversationId: string): Promise<Message[]> {
  const messages = verifier(
    await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(100),
    "Messages",
  );
  return messages.reverse();
}

export async function envoyerMessage(
  conversationId: string,
  expediteurId: string,
  contenu: string,
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: expediteurId,
    contenu,
  });
  if (error) throw new Error(`Envoi du message : ${error.message}`);
}

/** Abonnement temps réel aux nouveaux messages d'une conversation. */
export function ecouterMessages(
  conversationId: string,
  surNouveauMessage: (message: Message) => void,
): () => void {
  const canal = supabase
    .channel(`messages:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (charge) => surNouveauMessage(charge.new as Message),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(canal);
  };
}

// ----------------------------------------------------------------- modération

export async function bloquer(bloqueurId: string, bloqueId: string): Promise<void> {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_user_id: bloqueurId, blocked_user_id: bloqueId });
  if (error) throw new Error(`Blocage : ${error.message}`);
}

export async function signaler(
  signalantId: string,
  signaleId: string,
  motif: Enums<"motif_signalement">,
  description: string,
  contexte?: { conversationId?: string; messageId?: string },
): Promise<void> {
  const { error } = await supabase.from("reports").insert({
    reporter_user_id: signalantId,
    reported_user_id: signaleId,
    motif,
    description,
    statut: "en_attente",
    conversation_id: contexte?.conversationId ?? null,
    message_id: contexte?.messageId ?? null,
  });
  if (error) throw new Error(`Signalement : ${error.message}`);
}
