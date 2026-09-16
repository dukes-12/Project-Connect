import { test } from "node:test";
import assert from "node:assert/strict";

import type { Carte } from "./cohorte.ts";
import {
  activerCarte,
  creerSaCohorte,
  ErreurMatching,
  rejoindreGroupe,
  type Candidat,
  type DepotMatching,
  type GroupePropose,
  type NouveauGroupe,
  type Proposition,
} from "./service_matching.ts";

/**
 * Dépôt en mémoire. `groupesParTolerance` permet de décrire précisément le
 * comportement d'élargissement : clé = tolérance en jours, valeur = ce que la
 * base renverrait à ce palier.
 */
class DepotFactice implements DepotMatching {
  cartes = new Map<string, Carte>();
  groupes = new Map<string, GroupePropose>();
  groupesParTolerance = new Map<number, GroupePropose[]>();
  candidatsParTolerance = new Map<number, Candidat[]>();

  groupesCrees: NouveauGroupe[] = [];
  membresAjoutes: Array<{ groupeId: string; carteId: string }> = [];
  propositionsEnregistrees: Proposition[] = [];
  appelsGroupes: number[] = [];
  appelsCandidats: number[] = [];

  private compteur = 0;

  lireCarte(id: string) {
    return Promise.resolve(this.cartes.get(id) ?? null);
  }
  lireGroupe(id: string) {
    return Promise.resolve(this.groupes.get(id) ?? null);
  }
  groupesCompatibles(_carteId: string, tolerance: number) {
    this.appelsGroupes.push(tolerance);
    return Promise.resolve(this.groupesParTolerance.get(tolerance) ?? []);
  }
  candidatsIndividuels(_carteId: string, _limite: number, tolerance: number) {
    this.appelsCandidats.push(tolerance);
    return Promise.resolve(this.candidatsParTolerance.get(tolerance) ?? []);
  }
  creerGroupe(g: NouveauGroupe) {
    this.groupesCrees.push(g);
    const cree: GroupePropose = {
      group_id: `g-neuf-${++this.compteur}`,
      description: g.description,
      fenetre_debut: g.fenetre_debut,
      fenetre_fin: g.fenetre_fin,
      meme_type: true,
      nb_membres: 0,
    };
    this.groupes.set(cree.group_id, cree);
    return Promise.resolve(cree);
  }
  ajouterMembre(groupeId: string, carteId: string) {
    this.membresAjoutes.push({ groupeId, carteId });
    return Promise.resolve();
  }
  enregistrerPropositions(p: Proposition[]) {
    this.propositionsEnregistrees.push(...p);
    return Promise.resolve(p.length);
  }
}

const CARTE_ALICE: Carte = {
  id: "carte-alice",
  user_id: "alice",
  type: "voyageur",
  ville: "Lisbonne",
  pays: "Portugal",
  date_debut: "2027-03-15",
  date_fin: "2027-06-15",
  statut: "actif",
};

const groupe = (p: Partial<GroupePropose> = {}): GroupePropose => ({
  group_id: "g-existant",
  description: "Arrivées à Lisbonne — mi-mars 2027",
  fenetre_debut: "2027-03-01",
  fenetre_fin: "2027-03-29",
  meme_type: true,
  nb_membres: 4,
  ...p,
});

const candidat = (p: Partial<Candidat> = {}): Candidat => ({
  card_id: "carte-bruno",
  user_id: "bruno",
  score: 0.57,
  interets_communs: 2,
  jours_communs: 87,
  ...p,
});

function depotAvecAlice() {
  const d = new DepotFactice();
  d.cartes.set(CARTE_ALICE.id, CARTE_ALICE);
  return d;
}

test("aucun groupe trouvé → création automatique et adhésion (§8.1.2)", async () => {
  const d = depotAvecAlice();

  const r = await activerCarte(d, CARTE_ALICE.id);

  assert.equal(r.action, "groupe_cree");
  assert.equal(d.groupesCrees.length, 1);
  assert.deepEqual(d.groupesCrees[0], {
    ville: "Lisbonne",
    pays: "Portugal",
    type_carte: "voyageur",
    fenetre_debut: "2027-03-01",
    fenetre_fin: "2027-03-29",
    description: "Arrivées à Lisbonne — mi-mars 2027",
    cree_par_card_id: "carte-alice",
  });
  assert.deepEqual(d.membresAjoutes, [
    { groupeId: r.groupe!.group_id, carteId: "carte-alice" },
  ]);
  assert.deepEqual(r.groupes, [r.groupe], "le groupe créé est renvoyé comme seul groupe");
});

test("un groupe existe → proposition, sans rien créer ni rejoindre (§8.1.3)", async () => {
  const d = depotAvecAlice();
  d.groupesParTolerance.set(0, [groupe()]);

  const r = await activerCarte(d, CARTE_ALICE.id);

  assert.equal(r.action, "groupes_proposes");
  assert.deepEqual(r.groupes.map((g) => g.group_id), ["g-existant"]);
  assert.deepEqual(d.groupesCrees, [], "aucun groupe ne doit être créé");
  assert.deepEqual(d.membresAjoutes, [], "l'adhésion reste un choix de l'utilisateur");
});

test("la recherche de groupe s'élargit avant d'abandonner (§14)", async () => {
  const d = depotAvecAlice();
  d.groupesParTolerance.set(21, [groupe({ group_id: "g-large" })]);

  const r = await activerCarte(d, CARTE_ALICE.id);

  assert.deepEqual(d.appelsGroupes, [0, 7, 21]);
  assert.equal(r.action, "groupes_proposes");
  assert.equal(r.elargissement.groupes, 21, "l'app doit pouvoir dire « élargi à ±21 jours »");
});

test("les candidats individuels sont proposés en paires ordonnées (§8.2)", async () => {
  const d = depotAvecAlice();
  // "carte-alice" > "carte-bruno" n'est pas vrai lexicographiquement :
  // on vérifie que le service trie, quel que soit l'ordre d'arrivée.
  d.candidatsParTolerance.set(0, [
    candidat({ card_id: "carte-bruno", score: 0.57 }),
    candidat({ card_id: "aaa-carte", user_id: "zoe", score: 0.42 }),
    candidat({ card_id: "zzz-carte", user_id: "yuri", score: 0.31 }),
  ]);

  const r = await activerCarte(d, CARTE_ALICE.id);

  assert.equal(r.propositions_creees, 3);
  for (const p of d.propositionsEnregistrees) {
    assert.ok(p.card_id_a < p.card_id_b, `paire non ordonnée : ${p.card_id_a}/${p.card_id_b}`);
  }
  assert.deepEqual(
    d.propositionsEnregistrees.find((p) => p.card_id_a === "aaa-carte"),
    { card_id_a: "aaa-carte", card_id_b: "carte-alice", score: 0.42 },
  );
});

test("la recherche de candidats s'élargit jusqu'au minimum souhaité", async () => {
  const d = depotAvecAlice();
  d.candidatsParTolerance.set(0, [candidat()]);
  d.candidatsParTolerance.set(7, [candidat(), candidat({ card_id: "c2" })]);
  d.candidatsParTolerance.set(21, [
    candidat(),
    candidat({ card_id: "c2" }),
    candidat({ card_id: "c3" }),
  ]);

  const r = await activerCarte(d, CARTE_ALICE.id);

  assert.deepEqual(d.appelsCandidats, [0, 7, 21]);
  assert.equal(r.candidats.length, 3);
  assert.equal(r.elargissement.candidats, 21);
});

test("aucun candidat : on n'enregistre aucune proposition", async () => {
  const d = depotAvecAlice();

  const r = await activerCarte(d, CARTE_ALICE.id);

  assert.deepEqual(r.candidats, []);
  assert.equal(r.propositions_creees, 0);
  assert.deepEqual(d.propositionsEnregistrees, []);
});

test("le matching de groupe et l'individuel sont indépendants", async () => {
  const d = depotAvecAlice();
  d.candidatsParTolerance.set(0, [candidat()]);

  const r = await activerCarte(d, CARTE_ALICE.id);

  // Groupe créé (aucun existant) ET propositions individuelles enregistrées :
  // la spec §8.2 dit « en parallèle du groupe ».
  assert.equal(r.action, "groupe_cree");
  assert.equal(r.propositions_creees, 1);
});

test("carte introuvable ou inéligible : erreur typée, aucun effet de bord", async () => {
  const d = depotAvecAlice();
  d.cartes.set("carte-locale", { ...CARTE_ALICE, id: "carte-locale", type: "local" });
  d.cartes.set("carte-archivee", { ...CARTE_ALICE, id: "carte-archivee", statut: "archive" });

  const cas: Array<[string, string]> = [
    ["inconnue", "carte_introuvable"],
    ["carte-locale", "carte_ineligible"],
    ["carte-archivee", "carte_ineligible"],
  ];

  for (const [carteId, code] of cas) {
    await assert.rejects(
      () => activerCarte(d, carteId),
      (e: unknown) => e instanceof ErreurMatching && e.code === code,
      `attendu ${code} pour ${carteId}`,
    );
  }
  assert.deepEqual(d.groupesCrees, []);
  assert.deepEqual(d.propositionsEnregistrees, []);
});

test("rejoindreGroupe revalide la compatibilité au moment du clic", async () => {
  const d = depotAvecAlice();
  d.groupesParTolerance.set(0, [groupe()]);

  const rejoint = await rejoindreGroupe(d, CARTE_ALICE.id, "g-existant");

  assert.equal(rejoint.group_id, "g-existant");
  assert.deepEqual(d.membresAjoutes, [
    { groupeId: "g-existant", carteId: "carte-alice" },
  ]);
});

test("rejoindreGroupe distingue groupe absent et groupe devenu incompatible", async () => {
  const d = depotAvecAlice();
  d.groupes.set("g-autre-ville", groupe({ group_id: "g-autre-ville" }));

  await assert.rejects(
    () => rejoindreGroupe(d, CARTE_ALICE.id, "g-inexistant"),
    (e: unknown) => e instanceof ErreurMatching && e.code === "groupe_introuvable",
  );
  await assert.rejects(
    () => rejoindreGroupe(d, CARTE_ALICE.id, "g-autre-ville"),
    (e: unknown) => e instanceof ErreurMatching && e.code === "groupe_incompatible",
  );
  assert.deepEqual(d.membresAjoutes, [], "aucune adhésion en cas d'échec");
});

test("creerSaCohorte crée un groupe même quand d'autres existent (§8.1.3)", async () => {
  const d = depotAvecAlice();
  d.groupesParTolerance.set(0, [groupe()]);

  const cree = await creerSaCohorte(d, CARTE_ALICE.id);

  assert.equal(d.groupesCrees.length, 1);
  assert.equal(cree.description, "Arrivées à Lisbonne — mi-mars 2027");
  assert.deepEqual(d.membresAjoutes, [
    { groupeId: cree.group_id, carteId: "carte-alice" },
  ]);
});

test("une carte à séjour ouvert produit une cohorte normale", async () => {
  const d = new DepotFactice();
  d.cartes.set("carte-carla", {
    ...CARTE_ALICE,
    id: "carte-carla",
    user_id: "carla",
    date_debut: "2027-03-20",
    date_fin: null,
  });

  const r = await activerCarte(d, "carte-carla");

  assert.equal(r.action, "groupe_cree");
  assert.equal(d.groupesCrees[0].description, "Arrivées à Lisbonne — mi-mars 2027");
  assert.equal(d.groupesCrees[0].fenetre_debut, "2027-03-06");
  assert.equal(d.groupesCrees[0].fenetre_fin, "2027-04-03");
});
