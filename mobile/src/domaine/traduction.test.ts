import { test } from "node:test";
import assert from "node:assert/strict";

import { champTraduit, choisirLangue, traduire } from "./traduction.ts";

const hobby = {
  nom: "Marchés locaux",
  categorie: "Gastronomie",
  traductions: { en: { nom: "Local markets", categorie: "Food & drink" } },
};

test("rend la traduction quand elle existe", () => {
  assert.equal(traduire(hobby, "nom", "en", hobby.nom), "Local markets");
});

test("rend le français sans regarder les traductions", () => {
  assert.equal(traduire(hobby, "nom", "fr", hobby.nom), "Marchés locaux");
});

test("retombe sur le français pour un champ non traduit", () => {
  assert.equal(traduire(hobby, "icone", "en", "market"), "market");
});

test("retombe sur le français quand traductions est absent, vide ou mal formé", () => {
  const cas: unknown[] = [undefined, null, {}, { en: null }, { en: "pas un objet" }, [], "texte", 42];
  for (const traductions of cas) {
    assert.equal(
      traduire({ traductions }, "nom", "en", "Marchés locaux"),
      "Marchés locaux",
      `échec pour ${JSON.stringify(traductions)}`,
    );
  }
});

test("une traduction vide ne masque pas le français", () => {
  assert.equal(traduire({ traductions: { en: { nom: "" } } }, "nom", "en", "Marchés locaux"), "Marchés locaux");
});

test("une valeur par défaut nulle rend une chaîne vide, jamais « null »", () => {
  assert.equal(traduire({ traductions: {} }, "description", "en", null), "");
  assert.equal(traduire({ traductions: {} }, "description", "fr", null), "");
});

test("champTraduit lit la colonne de même nom", () => {
  assert.equal(champTraduit(hobby, "nom", "en"), "Local markets");
  assert.equal(champTraduit(hobby, "categorie", "en"), "Food & drink");
  assert.equal(champTraduit(hobby, "categorie", "fr"), "Gastronomie");
});

test("choisirLangue accepte les étiquettes régionales", () => {
  assert.equal(choisirLangue(["en-GB", "fr-FR"]), "en");
  assert.equal(choisirLangue(["fr_CA"]), "fr");
  assert.equal(choisirLangue(["EN"]), "en");
});

test("choisirLangue prend la première langue supportée, pas la première tout court", () => {
  assert.equal(choisirLangue(["pt-PT", "de-DE", "en-US"]), "en");
});

test("choisirLangue retombe sur le français", () => {
  assert.equal(choisirLangue(["pt-PT", "de"]), "fr");
  assert.equal(choisirLangue([]), "fr");
});
