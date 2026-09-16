import { test } from "node:test";
import assert from "node:assert/strict";

import { decoderBase64 } from "./base64.ts";

const texte = (octets: Uint8Array) => new TextDecoder().decode(octets);

test("vecteurs de la RFC 4648", () => {
  const cas: Array<[string, string]> = [
    ["", ""],
    ["Zg==", "f"],
    ["Zm8=", "fo"],
    ["Zm9v", "foo"],
    ["Zm9vYg==", "foob"],
    ["Zm9vYmE=", "fooba"],
    ["Zm9vYmFy", "foobar"],
  ];
  for (const [encode, attendu] of cas) {
    assert.equal(texte(decoderBase64(encode)), attendu, `échec sur « ${encode} »`);
  }
});

test("restitue exactement les octets, y compris les non imprimables", () => {
  const original = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
  const encode = Buffer.from(original).toString("base64");
  assert.deepEqual([...decoderBase64(encode)], [...original]);
});

test("un JPEG commence bien par ses octets magiques", () => {
  // En-tête JFIF réel : FF D8 FF E0 00 10 4A 46 49 46
  const entete = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const octets = decoderBase64(Buffer.from(entete).toString("base64"));
  assert.equal(octets[0], 0xff);
  assert.equal(octets[1], 0xd8);
  assert.equal(octets.length, 10);
});

test("concorde avec Buffer sur une charge aléatoire", () => {
  const aleatoire = new Uint8Array(3000);
  for (let i = 0; i < aleatoire.length; i += 1) aleatoire[i] = (i * 37 + 11) % 256;
  const encode = Buffer.from(aleatoire).toString("base64");
  assert.deepEqual([...decoderBase64(encode)], [...aleatoire]);
});

test("tolère les retours à la ligne et les espaces", () => {
  assert.equal(texte(decoderBase64("Zm9v\nYmFy")), "foobar");
  assert.equal(texte(decoderBase64("Zm9v YmFy")), "foobar");
});

test("accepte l'alphabet URL-safe", () => {
  const octets = new Uint8Array([251, 255, 190]);
  const standard = Buffer.from(octets).toString("base64");
  const urlSafe = standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.deepEqual([...decoderBase64(urlSafe)], [...octets]);
});

test("accepte un préfixe data:", () => {
  assert.equal(texte(decoderBase64("data:image/jpeg;base64,Zm9vYmFy")), "foobar");
});

test("rejette un caractère invalide", () => {
  assert.throws(() => decoderBase64("Zm9v!mFy"), /invalide/);
  assert.throws(() => decoderBase64("Zm9vé"), /invalide/);
});

test("accepte le base64 sans remplissage", () => {
  // « Zg » sans « == » reste valide : 12 bits, dont 8 utiles.
  assert.equal(texte(decoderBase64("Zg")), "f");
  assert.equal(texte(decoderBase64("Zm8")), "fo");
});

test("rejette une chaîne tronquée", () => {
  // Un caractère isolé ne porte que 6 bits : aucun octet complet.
  assert.throws(() => decoderBase64("Z"), /tronquée/);
  assert.throws(() => decoderBase64("Zm9vZ"), /tronquée/);
});

test("la longueur en octets est cohérente avec le remplissage", () => {
  assert.equal(decoderBase64("Zg==").length, 1);
  assert.equal(decoderBase64("Zm8=").length, 2);
  assert.equal(decoderBase64("Zm9v").length, 3);
});
