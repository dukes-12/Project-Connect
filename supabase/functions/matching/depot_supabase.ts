/**
 * Implémentation de `DepotMatching` au-dessus de Supabase.
 *
 * Aucune règle métier ici : uniquement la traduction des opérations du service
 * en requêtes. Le service reste testable sans base (voir service_matching.test.ts).
 *
 * Le client passé est un client **service_role** : `individual_matches` n'a pas
 * de policy INSERT (les propositions sont créées par le système, pas par les
 * utilisateurs), et les fonctions de recherche doivent pouvoir tourner sans
 * dépendre du JWT. Le cloisonnement est assuré autrement : le dépôt est
 * construit avec l'identifiant de l'appelant et `lireCarte` ne voit que ses
 * propres cartes, ce qui fait échouer toute activation sur la carte d'autrui.
 */

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { Carte } from "../_partage/cohorte.ts";
import type {
  Candidat,
  DepotMatching,
  GroupePropose,
  NouveauGroupe,
  Proposition,
} from "../_partage/service_matching.ts";

interface LigneGroupe {
  id: string;
  description: string;
  fenetre_debut: string;
  fenetre_fin: string;
  type_carte: string;
}

export class DepotSupabase implements DepotMatching {
  readonly #db: SupabaseClient;
  readonly #utilisateurId: string;

  constructor(db: SupabaseClient, utilisateurId: string) {
    this.#db = db;
    this.#utilisateurId = utilisateurId;
  }

  async lireCarte(carteId: string): Promise<Carte | null> {
    const { data, error } = await this.#db
      .from("profile_cards")
      .select("id, user_id, type, ville, pays, date_debut, date_fin, statut")
      .eq("id", carteId)
      // Cloisonnement : une carte qui n'appartient pas à l'appelant est
      // indistinguable d'une carte inexistante.
      .eq("user_id", this.#utilisateurId)
      .maybeSingle();

    if (error) throw new Error(`Lecture de la carte impossible : ${error.message}`);
    return (data as Carte | null) ?? null;
  }

  async lireGroupe(groupeId: string): Promise<GroupePropose | null> {
    const { data, error } = await this.#db
      .from("matching_groups")
      .select("id, description, fenetre_debut, fenetre_fin, type_carte")
      .eq("id", groupeId)
      .maybeSingle();

    if (error) throw new Error(`Lecture du groupe impossible : ${error.message}`);
    if (!data) return null;
    return this.#versGroupePropose(data as LigneGroupe, true, 0);
  }

  async groupesCompatibles(carteId: string, toleranceJours: number): Promise<GroupePropose[]> {
    const { data, error } = await this.#db.rpc("groupes_compatibles", {
      carte_id: carteId,
      tolerance_jours: toleranceJours,
    });

    if (error) throw new Error(`Recherche de cohortes impossible : ${error.message}`);
    return (data ?? []) as GroupePropose[];
  }

  async candidatsIndividuels(
    carteId: string,
    limite: number,
    toleranceJours: number,
  ): Promise<Candidat[]> {
    const { data, error } = await this.#db.rpc("candidats_individuels", {
      carte_id: carteId,
      limite,
      tolerance_jours: toleranceJours,
    });

    if (error) throw new Error(`Recherche de profils impossible : ${error.message}`);
    // `score` est un numeric Postgres, remonté en chaîne par PostgREST.
    return ((data ?? []) as Array<Omit<Candidat, "score"> & { score: string | number }>)
      .map((c) => ({ ...c, score: Number(c.score) }));
  }

  async creerGroupe(groupe: NouveauGroupe): Promise<GroupePropose> {
    const { data, error } = await this.#db
      .from("matching_groups")
      .insert(groupe)
      .select("id, description, fenetre_debut, fenetre_fin, type_carte")
      .single();

    if (error) throw new Error(`Création de la cohorte impossible : ${error.message}`);
    return this.#versGroupePropose(data as LigneGroupe, true, 0);
  }

  async ajouterMembre(groupeId: string, carteId: string): Promise<void> {
    // Le trigger membres_sync_conversation rattache l'utilisateur au chat du
    // groupe : rien à faire ici côté conversation.
    const { error } = await this.#db
      .from("matching_group_members")
      .upsert(
        { group_id: groupeId, card_id: carteId, statut: "membre" },
        { onConflict: "group_id,card_id", ignoreDuplicates: true },
      );

    if (error) throw new Error(`Adhésion à la cohorte impossible : ${error.message}`);
  }

  async enregistrerPropositions(propositions: Proposition[]): Promise<number> {
    if (propositions.length === 0) return 0;

    // ignoreDuplicates : `candidats_individuels` écarte déjà les paires connues,
    // mais deux activations simultanées peuvent viser la même paire.
    const { data, error } = await this.#db
      .from("individual_matches")
      .upsert(propositions, { onConflict: "card_id_a,card_id_b", ignoreDuplicates: true })
      .select("id");

    if (error) throw new Error(`Enregistrement des propositions impossible : ${error.message}`);
    return data?.length ?? 0;
  }

  #versGroupePropose(ligne: LigneGroupe, memeType: boolean, nbMembres: number): GroupePropose {
    return {
      group_id: ligne.id,
      description: ligne.description,
      fenetre_debut: ligne.fenetre_debut,
      fenetre_fin: ligne.fenetre_fin,
      meme_type: memeType,
      nb_membres: nbMembres,
    };
  }
}
