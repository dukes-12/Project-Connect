import { test } from "node:test";
import assert from "node:assert/strict";

import {
  brouillonVide,
  validerEvenement,
  type BrouillonEvenement,
} from "./soumission_evenement.ts";

const AUJOURDHUI = "2026-09-16";

const brouillon = (p: Partial<BrouillonEvenement> = {}): BrouillonEvenement => ({
  titre: "Brocante de Alfama",
  type: "marche",
  dateDebut: "2027-05-01",
  dateFin: "",
  lien: "",
  description: "",
  ...p,
});

test("une soumission complète est acceptée et normalisée", () => {
  const r = validerEvenement(
    brouillon({
      titre: "  Brocante de Alfama  ",
      dateFin: "2027-05-02",
      lien: "https://exemple.pt/brocante",
      description: "  Chinage le dimanche.  ",
    }),
    AUJOURDHUI,
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.ok && r.valeur, {
    titre: "Brocante de Alfama",
    type: "marche",
    dateDebut: "2027-05-01",
    dateFin: "2027-05-02",
    lien: "https://exemple.pt/brocante",
    description: "Chinage le dimanche.",
  });
});

test("les champs facultatifs vides deviennent null, jamais une chaîne vide", () => {
  const r = validerEvenement(brouillon(), AUJOURDHUI);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.valeur.dateFin, null);
    assert.equal(r.valeur.lien, null);
    assert.equal(r.valeur.description, null);
  }
});

test("titre trop court, y compris après nettoyage des espaces", () => {
  for (const titre of ["", "ab", "   a   "]) {
    const r = validerEvenement(brouillon({ titre }), AUJOURDHUI);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.champ, "titre");
  }
});

test("titre trop long", () => {
  const r = validerEvenement(brouillon({ titre: "x".repeat(121) }), AUJOURDHUI);
  assert.equal(!r.ok && r.champ, "titre");
});

test("type inconnu ou absent", () => {
  for (const type of ["", "soiree", "MARCHE"]) {
    const r = validerEvenement(brouillon({ type }), AUJOURDHUI);
    assert.equal(r.ok, false, `« ${type} » ne devrait pas passer`);
    assert.equal(!r.ok && r.champ, "type");
  }
});

test("date de début mal formée ou inexistante", () => {
  for (const dateDebut of ["01/05/2027", "2027-5-1", "2027-02-30", ""]) {
    const r = validerEvenement(brouillon({ dateDebut }), AUJOURDHUI);
    assert.equal(r.ok, false, `« ${dateDebut} » ne devrait pas passer`);
    assert.equal(!r.ok && r.champ, "dateDebut");
  }
});

test("date de fin antérieure au début", () => {
  const r = validerEvenement(brouillon({ dateFin: "2027-04-30" }), AUJOURDHUI);
  assert.equal(!r.ok && r.champ, "dateFin");
  assert.match((!r.ok && r.message) || "", /précède/);
});

test("une date de fin égale au début est acceptée", () => {
  const r = validerEvenement(brouillon({ dateFin: "2027-05-01" }), AUJOURDHUI);
  assert.equal(r.ok, true);
});

test("un événement déjà terminé est refusé", () => {
  const r = validerEvenement(
    brouillon({ dateDebut: "2026-01-10", dateFin: "2026-01-12" }),
    AUJOURDHUI,
  );
  assert.equal(!r.ok && r.champ, "dateDebut");
  assert.match((!r.ok && r.message) || "", /terminé/);
});

test("un événement en cours aujourd'hui est accepté", () => {
  const r = validerEvenement(
    brouillon({ dateDebut: "2026-09-01", dateFin: AUJOURDHUI }),
    AUJOURDHUI,
  );
  assert.equal(r.ok, true, "le dernier jour compte encore");
});

test("un événement commençant aujourd'hui est accepté", () => {
  const r = validerEvenement(brouillon({ dateDebut: AUJOURDHUI }), AUJOURDHUI);
  assert.equal(r.ok, true);
});

test("liens acceptés et refusés", () => {
  const valides = ["https://exemple.pt", "http://exemple.pt/a?b=c"];
  const invalides = ["exemple.pt", "javascript:alert(1)", "ftp://exemple.pt", "   h ttp://x"];

  for (const lien of valides) {
    assert.equal(validerEvenement(brouillon({ lien }), AUJOURDHUI).ok, true, lien);
  }
  for (const lien of invalides) {
    const r = validerEvenement(brouillon({ lien }), AUJOURDHUI);
    assert.equal(r.ok, false, `« ${lien} » ne devrait pas passer`);
    assert.equal(!r.ok && r.champ, "lien");
  }
});

test("un brouillon vierge est refusé sur le titre en premier", () => {
  const r = validerEvenement(brouillonVide(), AUJOURDHUI);
  assert.equal(!r.ok && r.champ, "titre");
});
