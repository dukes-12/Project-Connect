import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aujourdhuiISO,
  etatSejour,
  formaterDate,
  formaterPeriode,
  joursEntre,
  libelleEtatSejour,
  sejourEligibleAuMatching,
  type Sejour,
} from "./sejour.ts";

const voyage = (p: Partial<Sejour> = {}): Sejour => ({
  type: "voyageur",
  date_debut: "2027-03-15",
  date_fin: "2027-06-15",
  ...p,
});

test("joursEntre compte en jours calendaires UTC", () => {
  assert.equal(joursEntre("2027-03-10", "2027-03-15"), 5);
  assert.equal(joursEntre("2027-03-15", "2027-03-10"), -5);
  assert.equal(joursEntre("2027-03-15", "2027-03-15"), 0);
  assert.equal(joursEntre("2027-12-31", "2028-01-01"), 1);
  assert.equal(joursEntre("2028-02-28", "2028-03-01"), 2, "2028 est bissextile");
});

test("joursEntre rejette les dates invalides", () => {
  assert.throws(() => joursEntre("15/03/2027", "2027-03-15"), /YYYY-MM-DD/);
  assert.throws(() => joursEntre("2027-02-30", "2027-03-15"), /inexistante/);
});

test("aujourdhuiISO ne dépend pas du fuseau", () => {
  assert.equal(aujourdhuiISO(new Date("2027-03-15T23:30:00Z")), "2027-03-15");
  assert.equal(aujourdhuiISO(new Date("2027-03-15T00:30:00Z")), "2027-03-15");
});

test("séjour à venir", () => {
  assert.deepEqual(etatSejour(voyage(), "2027-03-01"), { etat: "a_venir", joursAvant: 14 });
  assert.deepEqual(etatSejour(voyage(), "2027-03-14"), { etat: "a_venir", joursAvant: 1 });
});

test("le jour de l'arrivée, le séjour est en cours", () => {
  assert.deepEqual(etatSejour(voyage(), "2027-03-15"), { etat: "en_cours", joursRestants: 92 });
});

test("le jour du départ, le séjour est encore en cours", () => {
  assert.deepEqual(etatSejour(voyage(), "2027-06-15"), { etat: "en_cours", joursRestants: 0 });
});

test("le lendemain du départ, le séjour est terminé", () => {
  assert.deepEqual(etatSejour(voyage(), "2027-06-16"), { etat: "termine", joursDepuis: 1 });
});

test("un séjour ouvert reste en cours sans échéance", () => {
  assert.deepEqual(etatSejour(voyage({ date_fin: null }), "2030-01-01"), {
    etat: "en_cours",
    joursRestants: null,
  });
});

test("une carte Local n'a pas d'état temporel", () => {
  assert.deepEqual(etatSejour({ type: "local", date_debut: null, date_fin: null }), {
    etat: "sans_dates",
  });
});

test("libellés français", () => {
  const fr = (s: Sejour, jour: string) => libelleEtatSejour(etatSejour(s, jour), "fr");
  assert.equal(fr(voyage(), "2027-03-01"), "Arrivée dans 14 jours");
  assert.equal(fr(voyage(), "2027-03-14"), "Arrivée demain");
  assert.equal(fr(voyage(), "2027-06-14"), "Départ demain");
  assert.equal(fr(voyage(), "2027-06-15"), "Dernier jour");
  assert.equal(fr(voyage(), "2027-06-16"), "Terminé hier");
  assert.equal(fr(voyage(), "2027-06-20"), "Terminé il y a 5 jours");
  assert.equal(fr(voyage({ date_fin: null }), "2027-04-01"), "Sur place");
});

test("libellés anglais", () => {
  const en = (s: Sejour, jour: string) => libelleEtatSejour(etatSejour(s, jour), "en");
  assert.equal(en(voyage(), "2027-03-14"), "Arriving tomorrow");
  assert.equal(en(voyage(), "2027-06-15"), "Last day");
  assert.equal(en(voyage(), "2027-06-16"), "Ended yesterday");
});

test("éligibilité au matching : miroir de la règle serveur", () => {
  assert.equal(sejourEligibleAuMatching(voyage(), "actif"), true);
  assert.equal(sejourEligibleAuMatching(voyage(), "archive"), false);
  assert.equal(sejourEligibleAuMatching(voyage(), "inactif"), false);
  assert.equal(sejourEligibleAuMatching(voyage({ type: "local" }), "actif"), false);
  assert.equal(sejourEligibleAuMatching(voyage({ date_debut: null }), "actif"), false);
});

test("formaterDate rend une date lisible", () => {
  assert.equal(formaterDate("2027-03-15", "fr", "2026-09-16"), "15 mars 2027");
  assert.equal(formaterDate("2027-08-03", "fr", "2026-09-16"), "3 août 2027");
  assert.equal(formaterDate("2027-03-15", "en", "2026-09-16"), "March 15, 2027");
});

test("formaterDate met « 1er » en français, « 1 » en anglais", () => {
  assert.equal(formaterDate("2027-05-01", "fr", "2026-09-16"), "1er mai 2027");
  assert.equal(formaterDate("2027-05-01", "en", "2026-09-16"), "May 1, 2027");
  assert.equal(formaterDate("2027-05-21", "fr", "2026-09-16"), "21 mai 2027");
});

test("formaterDate omet l'année en cours", () => {
  assert.equal(formaterDate("2026-09-20", "fr", "2026-09-16"), "20 septembre");
  assert.equal(formaterDate("2026-09-20", "en", "2026-09-16"), "September 20");
});

test("formaterDate rejette une date invalide", () => {
  assert.throws(() => formaterDate("2027-02-30", "fr"), /inexistante/);
  assert.throws(() => formaterDate("15/03/2027", "fr"), /YYYY-MM-DD/);
});

test("formaterPeriode encadre deux dates", () => {
  assert.equal(
    formaterPeriode("2027-03-15", "2027-06-15", "fr", "2026-09-16"),
    "du 15 mars 2027 au 15 juin 2027",
  );
  assert.equal(
    formaterPeriode("2027-03-15", "2027-06-15", "en", "2026-09-16"),
    "from March 15, 2027 to June 15, 2027",
  );
});

test("formaterPeriode réduit à une date quand il n'y a pas de fin distincte", () => {
  assert.equal(formaterPeriode("2027-03-15", null, "fr", "2026-09-16"), "15 mars 2027");
  assert.equal(formaterPeriode("2027-03-15", "2027-03-15", "fr", "2026-09-16"), "15 mars 2027");
});
