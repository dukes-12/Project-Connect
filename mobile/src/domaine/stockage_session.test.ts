import { test } from "node:test";
import assert from "node:assert/strict";

import {
  creerStockageFragmente,
  decouper,
  TAILLE_FRAGMENT,
  type MagasinClefValeur,
} from "./stockage_session.ts";

/** Magasin en mémoire qui refuse les valeurs trop longues, comme SecureStore. */
function magasinFactice(limite = 2048) {
  const donnees = new Map<string, string>();
  const magasin: MagasinClefValeur = {
    async getItem(cle) {
      return donnees.get(cle) ?? null;
    },
    async setItem(cle, valeur) {
      if (valeur.length > limite) {
        throw new Error(`Valeur trop longue pour SecureStore : ${valeur.length}`);
      }
      donnees.set(cle, valeur);
    },
    async removeItem(cle) {
      donnees.delete(cle);
    },
  };
  return { magasin, donnees };
}

const session = (longueur: number) => "j".repeat(longueur);

test("une valeur courte est écrite telle quelle, sans fragment", async () => {
  const { magasin, donnees } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);

  await stockage.setItem("session", "court");

  assert.equal(await stockage.getItem("session"), "court");
  assert.deepEqual([...donnees.keys()], ["session"]);
});

test("une session longue est découpée et recollée à l'identique", async () => {
  const { magasin, donnees } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);
  const valeur = session(5000);

  await stockage.setItem("session", valeur);

  assert.equal(await stockage.getItem("session"), valeur);
  assert.equal(donnees.size, 1 + Math.ceil(5000 / TAILLE_FRAGMENT));
});

test("aucun fragment ne dépasse la limite de SecureStore", async () => {
  const { magasin, donnees } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);

  // Le magasin factice lève au-delà de 2048 : si le découpage était trop
  // grossier, cette écriture échouerait.
  await stockage.setItem("session", session(20000));

  for (const [cle, valeur] of donnees) {
    assert.ok(valeur.length <= 2048, `${cle} fait ${valeur.length} caractères`);
  }
});

test("le contenu est préservé caractère par caractère", async () => {
  const { magasin } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);
  // Un vrai JWT : points, tirets, base64url, et de l'accentué dans le profil.
  const valeur = JSON.stringify({
    access_token: "a".repeat(1200) + ".b" + "c".repeat(1200),
    user: { bio: "Détaché six mois à Lisbonne — café ☕ 🇵🇹" },
  });

  await stockage.setItem("session", valeur);

  assert.equal(await stockage.getItem("session"), valeur);
});

test("une paire de substitution à cheval sur deux fragments est préservée", async () => {
  const { magasin } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);
  // L'emoji est placé pile sur la frontière de fragment.
  const valeur = "x".repeat(TAILLE_FRAGMENT - 1) + "🇵🇹" + "y".repeat(100);

  await stockage.setItem("session", valeur);

  assert.equal(await stockage.getItem("session"), valeur);
});

test("réécrire plus court ne laisse pas de fragments orphelins", async () => {
  const { magasin, donnees } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);

  await stockage.setItem("session", session(10000));
  await stockage.setItem("session", "court");

  assert.equal(await stockage.getItem("session"), "court");
  assert.deepEqual([...donnees.keys()], ["session"], "les anciens fragments doivent disparaître");
});

test("la suppression efface l'en-tête et tous les fragments", async () => {
  const { magasin, donnees } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);

  await stockage.setItem("session", session(6000));
  await stockage.removeItem("session");

  assert.equal(await stockage.getItem("session"), null);
  assert.equal(donnees.size, 0);
});

test("un fragment manquant rend null plutôt qu'une session tronquée", async () => {
  const { magasin, donnees } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);

  await stockage.setItem("session", session(6000));
  donnees.delete("session.1");

  assert.equal(await stockage.getItem("session"), null);
  assert.equal(donnees.size, 0, "le reste doit être nettoyé");
});

test("une clé absente rend null", async () => {
  const { magasin } = magasinFactice();
  const stockage = creerStockageFragmente(magasin);
  assert.equal(await stockage.getItem("jamais-ecrit"), null);
});

test("decouper refuse une taille nulle ou négative", () => {
  assert.throws(() => decouper("abc", 0), /positive/);
  assert.throws(() => decouper("abc", -1), /positive/);
});

test("decouper rend un fragment vide pour une chaîne vide", () => {
  assert.deepEqual(decouper(""), [""]);
});
