/**
 * Logique de cohorte — fonctions pures, sans I/O ni dépendance Supabase.
 *
 * Tout ce qui est décidable sans lire la base vit ici, pour être testable
 * unitairement (spec §16). Les dates sont manipulées en UTC et échangées au
 * format `YYYY-MM-DD` : jamais de `new Date("2027-03-10")` interprété dans le
 * fuseau local, qui décalerait une arrivée d'un jour selon le serveur.
 */

export type TypeCarte = "local" | "voyageur" | "travailleur";

export interface Carte {
  id: string;
  user_id: string;
  type: TypeCarte;
  ville: string;
  pays: string;
  date_debut: string | null;
  date_fin: string | null;
  statut: "actif" | "inactif" | "archive";
}

export interface Fenetre {
  debut: string;
  fin: string;
}

/** Demi-largeur de la fenêtre de cohorte : ±2 semaines autour de l'arrivée (§5.1). */
export const DEMI_FENETRE_JOURS = 14;

/**
 * Élargissements successifs de la recherche, en jours ajoutés de part et
 * d'autre. On s'arrête au premier palier qui donne un résultat, pour éviter
 * les groupes vides dans les villes peu peuplées (§14).
 */
export const PALIERS_ELARGISSEMENT = [0, 7, 21, 60] as const;

/** En dessous, on élargit la recherche de candidats individuels. */
export const CANDIDATS_SOUHAITES = 3;

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function analyserDate(iso: string): { annee: number; mois: number; jour: number } {
  if (!FORMAT_DATE.test(iso)) {
    throw new Error(`Date attendue au format YYYY-MM-DD, reçu : ${iso}`);
  }
  const [annee, mois, jour] = iso.split("-").map(Number);
  // Contrôle de validité réelle : 2027-02-30 passe la regex mais n'existe pas.
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== jour) {
    throw new Error(`Date inexistante : ${iso}`);
  }
  return { annee, mois, jour };
}

export function formaterDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function decalerJours(iso: string, jours: number): string {
  const { annee, mois, jour } = analyserDate(iso);
  return formaterDate(new Date(Date.UTC(annee, mois - 1, jour + jours)));
}

/**
 * Fenêtre d'une nouvelle cohorte, centrée sur la date d'arrivée.
 * `elargissement` ajoute des jours de chaque côté (paliers ci-dessus).
 */
export function fenetreCohorte(dateArrivee: string, elargissement = 0): Fenetre {
  const marge = DEMI_FENETRE_JOURS + elargissement;
  return {
    debut: decalerJours(dateArrivee, -marge),
    fin: decalerJours(dateArrivee, marge),
  };
}

/**
 * Libellé de période : « début mars 2027 », « mi-mars 2027 », « fin mars 2027 ».
 * Le trait d'union de « mi- » est porté par le préfixe, pas par le mois.
 */
export function libellePeriode(dateArrivee: string): string {
  const { annee, mois, jour } = analyserDate(dateArrivee);
  const prefixe = jour <= 10 ? "début " : jour <= 20 ? "mi-" : "fin ";
  return `${prefixe}${MOIS_FR[mois - 1]} ${annee}`;
}

/** Description générée d'une cohorte, ex. « Arrivées à Lisbonne — mi-mars 2027 » (§8.1.2). */
export function descriptionCohorte(ville: string, dateArrivee: string): string {
  return `Arrivées à ${ville} — ${libellePeriode(dateArrivee)}`;
}

/**
 * Paire ordonnée pour `individual_matches`, dont la contrainte impose
 * card_id_a < card_id_b. Trie sur la même règle que Postgres pour les uuid :
 * comparaison lexicographique de la représentation textuelle.
 */
export function paireOrdonnee(a: string, b: string): [string, string] {
  if (a === b) throw new Error("Une carte ne peut pas matcher avec elle-même");
  return a < b ? [a, b] : [b, a];
}

/** Une carte peut-elle entrer dans le matching de groupe/individuel ? (§8.1, §8.2) */
export function carteEligibleAuMatching(carte: Carte): { ok: boolean; raison?: string } {
  if (carte.type === "local") {
    return { ok: false, raison: "Une carte Local ne passe pas par le matching (§8.3)" };
  }
  if (carte.statut !== "actif") {
    return { ok: false, raison: `Carte au statut « ${carte.statut} », attendu « actif »` };
  }
  if (!carte.date_debut) {
    return { ok: false, raison: "Carte de séjour sans date d'arrivée" };
  }
  if (carte.date_fin && carte.date_fin <= carte.date_debut) {
    return { ok: false, raison: "Date de fin antérieure ou égale à la date d'arrivée" };
  }
  return { ok: true };
}

/**
 * Applique les paliers d'élargissement jusqu'à ce que `chercher` renvoie assez
 * de résultats, et retourne le premier palier concluant.
 *
 * Si aucun palier n'atteint `minimumSouhaite`, retourne le **meilleur** essai et
 * non le dernier : un palier large est censé être un sur-ensemble d'un palier
 * étroit, mais rien ne le garantit ici (données concurrentes, `chercher` qui
 * plafonne le nombre de lignes). Renvoyer le dernier essai ferait perdre un
 * candidat trouvé à ±0 jour au profit d'un résultat vide à ±60.
 *
 * Quand tous les paliers sont vides, on remonte le plus large essayé : c'est
 * l'information utile (« on a cherché jusqu'à ±60 jours, il n'y a personne »).
 */
export async function chercherEnElargissant<T>(
  chercher: (toleranceJours: number) => Promise<T[]>,
  minimumSouhaite = 1,
  paliers: readonly number[] = PALIERS_ELARGISSEMENT,
): Promise<{ resultats: T[]; toleranceJours: number }> {
  let meilleur: { resultats: T[]; toleranceJours: number } | null = null;
  let dernierPalier = paliers[0] ?? 0;

  for (const toleranceJours of paliers) {
    const resultats = await chercher(toleranceJours);
    dernierPalier = toleranceJours;

    if (resultats.length >= minimumSouhaite) return { resultats, toleranceJours };
    if (resultats.length > 0 && resultats.length > (meilleur?.resultats.length ?? 0)) {
      meilleur = { resultats, toleranceJours };
    }
  }

  return meilleur ?? { resultats: [], toleranceJours: dernierPalier };
}
