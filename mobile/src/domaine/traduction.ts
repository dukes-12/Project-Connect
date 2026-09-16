/**
 * Traduction des contenus éditoriaux, côté client.
 *
 * Reproduit exactement `public.traduire()` en SQL : la colonne d'origine porte
 * le français, `traductions` porte les autres langues, et une traduction
 * absente ou vide retombe sur le français plutôt que de vider l'écran.
 *
 * Le client traduit lui-même plutôt que d'appeler la fonction SQL : il connaît
 * sa langue, et cela évite un aller-retour par ligne affichée.
 */

export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export const LANGUE_DE_REFERENCE: Langue = "fr";

export interface ContenuTraduisible {
  traductions?: unknown;
}

function estLangue(valeur: string): valeur is Langue {
  return (LANGUES as readonly string[]).includes(valeur);
}

/**
 * Première langue supportée parmi celles de l'appareil, sinon le français.
 * Accepte les étiquettes complètes ("en-GB") comme les codes courts ("en").
 */
export function choisirLangue(languesAppareil: readonly string[]): Langue {
  for (const etiquette of languesAppareil) {
    const code = etiquette.toLowerCase().split(/[-_]/)[0];
    if (estLangue(code)) return code;
  }
  return LANGUE_DE_REFERENCE;
}

/**
 * Valeur d'un champ dans la langue demandée.
 * `valeurParDefaut` est la colonne d'origine (le français).
 */
export function traduire(
  contenu: ContenuTraduisible,
  champ: string,
  langue: Langue,
  valeurParDefaut: string | null,
): string {
  const defaut = valeurParDefaut ?? "";
  if (langue === LANGUE_DE_REFERENCE) return defaut;

  const traductions = contenu.traductions;
  if (traductions === null || typeof traductions !== "object" || Array.isArray(traductions)) {
    return defaut;
  }

  const pourLaLangue = (traductions as Record<string, unknown>)[langue];
  if (pourLaLangue === null || typeof pourLaLangue !== "object" || Array.isArray(pourLaLangue)) {
    return defaut;
  }

  const valeur = (pourLaLangue as Record<string, unknown>)[champ];
  return typeof valeur === "string" && valeur !== "" ? valeur : defaut;
}

/** Raccourci pour les lignes dont le champ traduit porte le même nom que la colonne. */
export function champTraduit<T extends ContenuTraduisible & Record<string, unknown>>(
  ligne: T,
  champ: keyof T & string,
  langue: Langue,
): string {
  const valeur = ligne[champ];
  return traduire(ligne, champ, langue, typeof valeur === "string" ? valeur : null);
}
