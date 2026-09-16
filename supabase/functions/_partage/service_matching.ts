/**
 * Service de matching (§8.1, §8.2) — déclenché à l'activation d'une carte.
 *
 * Isolé du transport HTTP et de Supabase : tout accès aux données passe par
 * l'interface `DepotMatching`, ce qui rend le service testable avec un dépôt en
 * mémoire (spec §12 « à isoler du reste du code pour rester testable »).
 */

import {
  CANDIDATS_SOUHAITES,
  carteEligibleAuMatching,
  chercherEnElargissant,
  descriptionCohorte,
  fenetreCohorte,
  paireOrdonnee,
  type Carte,
} from "./cohorte.ts";

export const LIMITE_CANDIDATS = 20;

export interface GroupePropose {
  group_id: string;
  description: string;
  fenetre_debut: string;
  fenetre_fin: string;
  /** false quand c'est un groupe Voyageur proposé à un Travailleur, ou l'inverse. */
  meme_type: boolean;
  nb_membres: number;
}

export interface Candidat {
  card_id: string;
  user_id: string;
  score: number;
  interets_communs: number;
  jours_communs: number;
}

export interface NouveauGroupe {
  ville: string;
  pays: string;
  type_carte: "voyageur" | "travailleur";
  fenetre_debut: string;
  fenetre_fin: string;
  description: string;
  cree_par_card_id: string;
}

export interface Proposition {
  card_id_a: string;
  card_id_b: string;
  score: number;
}

export interface DepotMatching {
  lireCarte(carteId: string): Promise<Carte | null>;
  groupesCompatibles(carteId: string, toleranceJours: number): Promise<GroupePropose[]>;
  lireGroupe(groupeId: string): Promise<GroupePropose | null>;
  creerGroupe(groupe: NouveauGroupe): Promise<GroupePropose>;
  ajouterMembre(groupeId: string, carteId: string): Promise<void>;
  candidatsIndividuels(
    carteId: string,
    limite: number,
    toleranceJours: number,
  ): Promise<Candidat[]>;
  enregistrerPropositions(propositions: Proposition[]): Promise<number>;
}

export type CodeErreur =
  | "carte_introuvable"
  | "carte_ineligible"
  | "groupe_introuvable"
  | "groupe_incompatible";

export class ErreurMatching extends Error {
  // Champ déclaré explicitement plutôt qu'en propriété de constructeur : ce
  // sucre syntaxique TypeScript n'est pas supporté par les runtimes qui se
  // contentent d'effacer les types (Node en strip-only, esbuild sans transform).
  readonly code: CodeErreur;

  constructor(code: CodeErreur, message: string) {
    super(message);
    this.name = "ErreurMatching";
    this.code = code;
  }
}

export interface ResultatActivation {
  /** `groupe_cree` : aucune cohorte n'existait, une a été créée et rejointe (§8.1.2).
   *  `groupes_proposes` : une ou plusieurs cohortes existent, l'utilisateur choisit (§8.1.3). */
  action: "groupe_cree" | "groupes_proposes";
  groupe?: GroupePropose;
  groupes: GroupePropose[];
  candidats: Candidat[];
  propositions_creees: number;
  /** Élargissement retenu pour chaque recherche, à afficher côté app (§14). */
  elargissement: { groupes: number; candidats: number };
}

function exigerCarteEligible(carte: Carte | null, carteId: string): Carte {
  if (!carte) {
    throw new ErreurMatching("carte_introuvable", `Carte ${carteId} introuvable`);
  }
  const eligible = carteEligibleAuMatching(carte);
  if (!eligible.ok) {
    throw new ErreurMatching("carte_ineligible", eligible.raison!);
  }
  return carte;
}

function groupePourCarte(carte: Carte): NouveauGroupe {
  const fenetre = fenetreCohorte(carte.date_debut!);
  return {
    ville: carte.ville,
    pays: carte.pays,
    type_carte: carte.type as "voyageur" | "travailleur",
    fenetre_debut: fenetre.debut,
    fenetre_fin: fenetre.fin,
    description: descriptionCohorte(carte.ville, carte.date_debut!),
    cree_par_card_id: carte.id,
  };
}

/**
 * Enregistre les propositions de matching individuel pour une carte.
 * Le score est celui calculé du point de vue de la carte qui déclenche : il est
 * asymétrique (la part de séjour partagée dépend de la durée du séjour de
 * référence). Une paire n'étant proposée qu'une fois, c'est le score du premier
 * arrivé qui est conservé.
 */
async function proposerCandidats(
  depot: DepotMatching,
  carteId: string,
): Promise<{ candidats: Candidat[]; creees: number; elargissement: number }> {
  const { resultats: candidats, toleranceJours } = await chercherEnElargissant(
    (tolerance) => depot.candidatsIndividuels(carteId, LIMITE_CANDIDATS, tolerance),
    CANDIDATS_SOUHAITES,
  );

  if (candidats.length === 0) {
    return { candidats, creees: 0, elargissement: toleranceJours };
  }

  const propositions = candidats.map((c) => {
    const [a, b] = paireOrdonnee(carteId, c.card_id);
    return { card_id_a: a, card_id_b: b, score: c.score };
  });

  return {
    candidats,
    creees: await depot.enregistrerPropositions(propositions),
    elargissement: toleranceJours,
  };
}

/**
 * Activation d'une carte Voyageur/Travailleur : cherche une cohorte, en crée
 * une si aucune n'existe, et propose des profils individuels en parallèle.
 */
export async function activerCarte(
  depot: DepotMatching,
  carteId: string,
): Promise<ResultatActivation> {
  const carte = exigerCarteEligible(await depot.lireCarte(carteId), carteId);

  const { resultats: groupes, toleranceJours } = await chercherEnElargissant(
    (tolerance) => depot.groupesCompatibles(carteId, tolerance),
  );

  const individuel = await proposerCandidats(depot, carteId);
  const commun = {
    groupes,
    candidats: individuel.candidats,
    propositions_creees: individuel.creees,
    elargissement: { groupes: toleranceJours, candidats: individuel.elargissement },
  };

  // §8.1.2 : aucun groupe trouvé → création automatique, l'utilisateur n'a rien
  // à décider. §8.1.3 : au moins un groupe → on lui laisse le choix.
  if (groupes.length > 0) {
    return { action: "groupes_proposes", ...commun };
  }

  const groupe = await depot.creerGroupe(groupePourCarte(carte));
  await depot.ajouterMembre(groupe.group_id, carte.id);
  return { action: "groupe_cree", groupe, ...commun, groupes: [groupe] };
}

/** §8.1.3 : l'utilisateur rejoint une des cohortes proposées. */
export async function rejoindreGroupe(
  depot: DepotMatching,
  carteId: string,
  groupeId: string,
): Promise<GroupePropose> {
  exigerCarteEligible(await depot.lireCarte(carteId), carteId);

  // La proposition ayant pu vieillir dans l'app, on revalide la compatibilité
  // au moment du clic plutôt que de faire confiance à l'écran précédent.
  const compatibles = await chercherEnElargissant(
    (tolerance) => depot.groupesCompatibles(carteId, tolerance),
  );
  const groupe = compatibles.resultats.find((g) => g.group_id === groupeId);
  if (groupe) {
    await depot.ajouterMembre(groupeId, carteId);
    return groupe;
  }

  if (!(await depot.lireGroupe(groupeId))) {
    throw new ErreurMatching("groupe_introuvable", `Groupe ${groupeId} introuvable`);
  }
  throw new ErreurMatching(
    "groupe_incompatible",
    `Le groupe ${groupeId} ne correspond plus à cette carte (ville, type ou dates)`,
  );
}

/** §8.1.3 : l'utilisateur préfère créer sa propre cohorte malgré les propositions. */
export async function creerSaCohorte(
  depot: DepotMatching,
  carteId: string,
): Promise<GroupePropose> {
  const carte = exigerCarteEligible(await depot.lireCarte(carteId), carteId);
  const groupe = await depot.creerGroupe(groupePourCarte(carte));
  await depot.ajouterMembre(groupe.group_id, carte.id);
  return groupe;
}
