/**
 * Validation d'une soumission d'événement (§7.1).
 *
 * Pure, donc testable sans formulaire ni base. Les mêmes règles existent en
 * contrainte SQL — la validation côté client sert à expliquer l'erreur avant
 * l'aller-retour, pas à garantir quoi que ce soit.
 */

export const TYPES_EVENEMENT = ["expo", "festival", "concert", "marche", "autre"] as const;
export type TypeEvenement = (typeof TYPES_EVENEMENT)[number];

export const LIBELLES_TYPE: Record<TypeEvenement, string> = {
  expo: "Exposition",
  festival: "Festival",
  concert: "Concert",
  marche: "Marché",
  autre: "Autre",
};

export interface BrouillonEvenement {
  titre: string;
  type: string;
  dateDebut: string;
  dateFin: string;
  lien: string;
  description: string;
}

export interface EvenementValide {
  titre: string;
  type: TypeEvenement;
  dateDebut: string;
  dateFin: string | null;
  lien: string | null;
  description: string | null;
}

export type Resultat =
  | { ok: true; valeur: EvenementValide }
  | { ok: false; champ: keyof BrouillonEvenement; message: string };

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const TITRE_MIN = 3;
export const TITRE_MAX = 120;

function dateReelle(iso: string): boolean {
  if (!FORMAT_DATE.test(iso)) return false;
  const [annee, mois, jour] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  return (
    d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour
  );
}

function estTypeConnu(valeur: string): valeur is TypeEvenement {
  return (TYPES_EVENEMENT as readonly string[]).includes(valeur);
}

/**
 * Un lien est facultatif, mais s'il est fourni il doit être exploitable :
 * afficher un lien mort dans une fiche ville est pire que pas de lien.
 */
function lienAcceptable(lien: string): boolean {
  try {
    const url = new URL(lien);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validerEvenement(
  brouillon: BrouillonEvenement,
  aujourdhui: string,
): Resultat {
  const titre = brouillon.titre.trim();
  if (titre.length < TITRE_MIN) {
    return { ok: false, champ: "titre", message: `Titre trop court (${TITRE_MIN} caractères minimum).` };
  }
  if (titre.length > TITRE_MAX) {
    return { ok: false, champ: "titre", message: `Titre trop long (${TITRE_MAX} caractères maximum).` };
  }

  if (!estTypeConnu(brouillon.type)) {
    return { ok: false, champ: "type", message: "Choisissez un type d'événement." };
  }

  if (!dateReelle(brouillon.dateDebut)) {
    return { ok: false, champ: "dateDebut", message: "Date de début attendue au format AAAA-MM-JJ." };
  }

  const dateFin = brouillon.dateFin.trim();
  if (dateFin) {
    if (!dateReelle(dateFin)) {
      return { ok: false, champ: "dateFin", message: "Date de fin attendue au format AAAA-MM-JJ, ou laissée vide." };
    }
    // Comparaison lexicographique : valide sur des dates ISO.
    if (dateFin < brouillon.dateDebut) {
      return { ok: false, champ: "dateFin", message: "La date de fin précède la date de début." };
    }
  }

  // Un événement déjà terminé n'a plus d'intérêt pour un arrivant, et encombre
  // la file de modération.
  const derniereDate = dateFin || brouillon.dateDebut;
  if (derniereDate < aujourdhui) {
    return { ok: false, champ: "dateDebut", message: "Cet événement est déjà terminé." };
  }

  const lien = brouillon.lien.trim();
  if (lien && !lienAcceptable(lien)) {
    return { ok: false, champ: "lien", message: "Lien invalide — attendu une adresse http(s)." };
  }

  return {
    ok: true,
    valeur: {
      titre,
      type: brouillon.type,
      dateDebut: brouillon.dateDebut,
      dateFin: dateFin || null,
      lien: lien || null,
      description: brouillon.description.trim() || null,
    },
  };
}

/** Brouillon vierge, pour initialiser le formulaire. */
export function brouillonVide(): BrouillonEvenement {
  return { titre: "", type: "", dateDebut: "", dateFin: "", lien: "", description: "" };
}
