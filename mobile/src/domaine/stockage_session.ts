/**
 * Stockage de session découpé en fragments.
 *
 * expo-secure-store refuse les valeurs de plus de 2048 octets, et une session
 * Supabase (jeton d'accès + jeton de rafraîchissement + profil) les dépasse
 * régulièrement. On découpe donc la valeur, et on mémorise le nombre de
 * fragments dans la clé d'origine pour pouvoir la relire et la nettoyer.
 *
 * Aucune dépendance à Expo : testable avec un magasin en mémoire.
 */

export interface MagasinClefValeur {
  getItem(cle: string): Promise<string | null>;
  setItem(cle: string, valeur: string): Promise<void>;
  removeItem(cle: string): Promise<void>;
}

/** Marge sous la limite de 2048 octets de SecureStore. */
export const TAILLE_FRAGMENT = 1800;

const PREFIXE_FRAGMENTS = "__fragments__:";

function cleFragment(cle: string, index: number): string {
  return `${cle}.${index}`;
}

/**
 * Découpe sur les unités de code UTF-16 plutôt que sur les octets : recoller
 * les fragments redonne exactement la chaîne d'origine, y compris quand une
 * paire de substitution (emoji) tombe sur une frontière.
 */
export function decouper(valeur: string, taille = TAILLE_FRAGMENT): string[] {
  if (taille <= 0) throw new Error("La taille de fragment doit être positive");
  if (valeur.length === 0) return [""];

  const fragments: string[] = [];
  for (let i = 0; i < valeur.length; i += taille) {
    fragments.push(valeur.slice(i, i + taille));
  }
  return fragments;
}

export function creerStockageFragmente(magasin: MagasinClefValeur): MagasinClefValeur {
  async function nombreDeFragments(cle: string): Promise<number | null> {
    const entete = await magasin.getItem(cle);
    if (entete === null || !entete.startsWith(PREFIXE_FRAGMENTS)) return null;
    const n = Number(entete.slice(PREFIXE_FRAGMENTS.length));
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  async function effacerFragments(cle: string): Promise<void> {
    const n = await nombreDeFragments(cle);
    if (n === null) return;
    for (let i = 0; i < n; i += 1) {
      await magasin.removeItem(cleFragment(cle, i));
    }
  }

  return {
    async getItem(cle) {
      const n = await nombreDeFragments(cle);
      // Valeur courte écrite directement, ou absente.
      if (n === null) return magasin.getItem(cle);

      const morceaux: string[] = [];
      for (let i = 0; i < n; i += 1) {
        const morceau = await magasin.getItem(cleFragment(cle, i));
        // Un fragment manquant rend la session irrécupérable : plutôt que de
        // rendre une valeur tronquée que Supabase tenterait de parser, on
        // nettoie et on repart d'une session absente.
        if (morceau === null) {
          await this.removeItem(cle);
          return null;
        }
        morceaux.push(morceau);
      }
      return morceaux.join("");
    },

    async setItem(cle, valeur) {
      // Toujours nettoyer l'écriture précédente : passer de 3 fragments à 1
      // laisserait sinon deux orphelins derrière.
      await effacerFragments(cle);

      if (valeur.length <= TAILLE_FRAGMENT) {
        await magasin.setItem(cle, valeur);
        return;
      }

      const fragments = decouper(valeur);
      for (let i = 0; i < fragments.length; i += 1) {
        await magasin.setItem(cleFragment(cle, i), fragments[i]);
      }
      await magasin.setItem(cle, `${PREFIXE_FRAGMENTS}${fragments.length}`);
    },

    async removeItem(cle) {
      await effacerFragments(cle);
      await magasin.removeItem(cle);
    },
  };
}
