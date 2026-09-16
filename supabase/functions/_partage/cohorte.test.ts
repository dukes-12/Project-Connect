import { test } from "node:test";
import assert from "node:assert/strict";

import {
  carteEligibleAuMatching,
  chercherEnElargissant,
  decalerJours,
  descriptionCohorte,
  fenetreCohorte,
  libellePeriode,
  paireOrdonnee,
  type Carte,
  PALIERS_ELARGISSEMENT,
} from "./cohorte.ts";

const carte = (p: Partial<Carte> = {}): Carte => ({
  id: "c1",
  user_id: "u1",
  type: "voyageur",
  ville: "Lisbonne",
  pays: "Portugal",
  date_debut: "2027-03-15",
  date_fin: "2027-06-15",
  statut: "actif",
  ...p,
});

test("decalerJours traverse les mois et les années", () => {
  assert.equal(decalerJours("2027-03-15", 14), "2027-03-29");
  assert.equal(decalerJours("2027-03-15", -14), "2027-03-01");
  assert.equal(decalerJours("2027-03-05", -14), "2027-02-19");
  assert.equal(decalerJours("2027-12-25", 10), "2028-01-04");
  assert.equal(decalerJours("2028-02-28", 1), "2028-02-29", "2028 est bissextile");
  assert.equal(decalerJours("2027-02-28", 1), "2027-03-01", "2027 ne l'est pas");
});

test("decalerJours ne dépend pas du fuseau du serveur", () => {
  // Une implémentation via `new Date("2027-03-15")` en heure locale décalerait
  // d'un jour à l'ouest de Greenwich. On vérifie la borne de minuit.
  assert.equal(decalerJours("2027-03-15", 0), "2027-03-15");
  assert.equal(decalerJours("2027-01-01", -1), "2026-12-31");
});

test("analyserDate rejette les dates mal formées ou inexistantes", () => {
  assert.throws(() => decalerJours("15/03/2027", 0), /YYYY-MM-DD/);
  assert.throws(() => decalerJours("2027-3-15", 0), /YYYY-MM-DD/);
  assert.throws(() => decalerJours("2027-02-30", 0), /inexistante/);
  assert.throws(() => decalerJours("2027-13-01", 0), /inexistante/);
});

test("fenetreCohorte encadre l'arrivée de ±2 semaines", () => {
  assert.deepEqual(fenetreCohorte("2027-03-15"), {
    debut: "2027-03-01",
    fin: "2027-03-29",
  });
});

test("fenetreCohorte s'élargit symétriquement", () => {
  assert.deepEqual(fenetreCohorte("2027-03-15", 21), {
    debut: "2027-02-08",
    fin: "2027-04-19",
  });
});

test("libellePeriode découpe le mois en trois", () => {
  assert.equal(libellePeriode("2027-03-01"), "début mars 2027");
  assert.equal(libellePeriode("2027-03-10"), "début mars 2027");
  assert.equal(libellePeriode("2027-03-11"), "mi-mars 2027");
  assert.equal(libellePeriode("2027-03-20"), "mi-mars 2027");
  assert.equal(libellePeriode("2027-03-21"), "fin mars 2027");
  assert.equal(libellePeriode("2027-03-31"), "fin mars 2027");
});

test("libellePeriode accentue les mois français", () => {
  assert.equal(libellePeriode("2027-02-15"), "mi-février 2027");
  assert.equal(libellePeriode("2027-08-03"), "début août 2027");
  assert.equal(libellePeriode("2027-12-28"), "fin décembre 2027");
});

test("descriptionCohorte reproduit l'exemple de la spec §8.1.2", () => {
  assert.equal(
    descriptionCohorte("Lisbonne", "2027-03-15"),
    "Arrivées à Lisbonne — mi-mars 2027",
  );
});

test("paireOrdonnee respecte la contrainte card_id_a < card_id_b", () => {
  assert.deepEqual(paireOrdonnee("bbb", "aaa"), ["aaa", "bbb"]);
  assert.deepEqual(paireOrdonnee("aaa", "bbb"), ["aaa", "bbb"]);
  assert.throws(() => paireOrdonnee("aaa", "aaa"), /elle-même/);
});

test("carteEligibleAuMatching accepte un séjour ouvert", () => {
  assert.deepEqual(carteEligibleAuMatching(carte({ date_fin: null })), { ok: true });
});

test("carteEligibleAuMatching écarte les cartes hors périmètre", () => {
  const cas: Array<[Partial<Carte>, RegExp]> = [
    [{ type: "local" }, /Local/],
    [{ statut: "archive" }, /archive/],
    [{ statut: "inactif" }, /inactif/],
    [{ date_debut: null }, /sans date d'arrivée/],
    [{ date_debut: "2027-06-15", date_fin: "2027-03-15" }, /antérieure/],
  ];
  for (const [patch, motif] of cas) {
    const r = carteEligibleAuMatching(carte(patch));
    assert.equal(r.ok, false, `attendu inéligible pour ${JSON.stringify(patch)}`);
    assert.match(r.raison!, motif);
  }
});

test("chercherEnElargissant s'arrête au premier palier concluant", () => {
  const appels: number[] = [];
  return chercherEnElargissant(async (tolerance) => {
    appels.push(tolerance);
    return tolerance >= 7 ? ["un groupe"] : [];
  }).then((r) => {
    assert.deepEqual(appels, [0, 7], "ne doit pas essayer les paliers suivants");
    assert.equal(r.toleranceJours, 7);
    assert.deepEqual(r.resultats, ["un groupe"]);
  });
});

test("chercherEnElargissant ne s'arrête pas avant le minimum souhaité", async () => {
  const appels: number[] = [];
  const r = await chercherEnElargissant(async (tolerance) => {
    appels.push(tolerance);
    return tolerance >= 21 ? ["a", "b", "c"] : ["a"];
  }, 3);
  assert.deepEqual(appels, [0, 7, 21]);
  assert.equal(r.resultats.length, 3);
});

test("chercherEnElargissant garde le meilleur essai, pas le dernier", async () => {
  // Cas réel : un seul candidat à ±0 jour, et les paliers suivants ne ramènent
  // rien (données concurrentes, requête plafonnée). Ce candidat ne doit pas
  // être perdu sous prétexte qu'on a cherché plus large ensuite.
  const r = await chercherEnElargissant(
    async (tolerance) => (tolerance === 0 ? ["le seul candidat"] : []),
    3,
  );
  assert.deepEqual(r.resultats, ["le seul candidat"]);
  assert.equal(r.toleranceJours, 0);
});

test("chercherEnElargissant préfère le palier le plus fourni", async () => {
  const r = await chercherEnElargissant(
    async (tolerance) => (tolerance === 7 ? ["a", "b"] : tolerance === 0 ? ["a"] : []),
    5,
  );
  assert.deepEqual(r.resultats, ["a", "b"]);
  assert.equal(r.toleranceJours, 7);
});

test("chercherEnElargissant rend un résultat vide après le dernier palier", async () => {
  const appels: number[] = [];
  const r = await chercherEnElargissant(async (t) => {
    appels.push(t);
    return [];
  });
  assert.deepEqual(appels, [...PALIERS_ELARGISSEMENT]);
  assert.deepEqual(r.resultats, []);
  assert.equal(r.toleranceJours, PALIERS_ELARGISSEMENT.at(-1));
});
