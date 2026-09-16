/**
 * Décodage base64 vers octets.
 *
 * Écrit à la main plutôt que via `atob` : Hermes ne le fournit pas de façon
 * garantie, et `Buffer` n'existe pas en React Native. Vingt lignes valent mieux
 * qu'un polyfill de plus, et ça se teste.
 *
 * `ImagePicker` rend l'image en base64 ; le client Supabase attend des octets.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const VALEURS = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i += 1) table[ALPHABET.charCodeAt(i)] = i;
  // Variante « URL-safe », qu'on accepte aussi : - et _ remplacent + et /.
  table["-".charCodeAt(0)] = 62;
  table["_".charCodeAt(0)] = 63;
  return table;
})();

export function decoderBase64(entree: string): Uint8Array {
  // Le préfixe `data:` est toléré : certaines sources le collent devant.
  const virgule = entree.indexOf(",");
  const corps = entree.startsWith("data:") && virgule !== -1 ? entree.slice(virgule + 1) : entree;

  // On ignore espaces et retours à la ligne, et le remplissage final.
  const propre = corps.replace(/[\s=]/g, "");

  let accumulateur = 0;
  let bitsAccumules = 0;
  const octets = new Uint8Array((propre.length * 3) >> 2);
  let ecrits = 0;

  for (let i = 0; i < propre.length; i += 1) {
    const code = propre.charCodeAt(i);
    const valeur = code < 128 ? VALEURS[code] : -1;
    if (valeur === -1) {
      throw new Error(`Caractère base64 invalide à la position ${i} : « ${propre[i]} »`);
    }

    accumulateur = (accumulateur << 6) | valeur;
    bitsAccumules += 6;

    if (bitsAccumules >= 8) {
      bitsAccumules -= 8;
      octets[ecrits] = (accumulateur >> bitsAccumules) & 0xff;
      ecrits += 1;
    }
  }

  // Un reste de 6 bits signale une longueur impossible (un caractère isolé).
  if (bitsAccumules === 6) {
    throw new Error("Chaîne base64 tronquée");
  }

  return ecrits === octets.length ? octets : octets.subarray(0, ecrits);
}
