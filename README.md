# Project-Connect

App de mise en relation pour nouveaux arrivants dans une ville : rencontrer les
personnes qui arrivent au même moment, découvrir les événements locaux, et
s'installer concrètement.

Spec produit & technique : [`docs/spec-produit.md`](docs/spec-produit.md).

## État

Schéma de données et service de matching en place, appliqués et déployés sur le
projet Supabase `Project-Connect` (région eu-central-1). Pas encore
d'application cliente.

## Structure

```
docs/
  spec-produit.md        Spec complète
  decisions-schema.md    Points ambigus de la spec et arbitrages retenus
supabase/
  migrations/            Migrations SQL, appliquées dans l'ordre des noms
  seeds/dev_matching.sql Jeu de test pour le matching — DEV UNIQUEMENT
  functions/
    _partage/            Logique de matching, sans I/O — testée unitairement
    matching/            Edge function : dépôt Supabase + point d'entrée HTTP
```

## Tests

```
npm test
```

28 tests unitaires sur la logique de cohorte et le service de matching. Ils
tournent sans base ni réseau : le service est écrit contre une interface
`DepotMatching` qu'un dépôt en mémoire implémente dans les tests.

## Le schéma en bref

| Domaine | Tables |
|---|---|
| Profil & cartes | `users`, `profile_cards`, `hobbies`, `card_hobbies` |
| Fiches ville | `city_guides`, `points_of_interet`, `ephemeral_events`, `checklist_items`, `user_checklist_status` |
| Matching | `matching_groups`, `matching_group_members`, `individual_matches`, `connections` |
| Messagerie & modération | `conversations`, `conversation_participants`, `messages`, `blocks`, `reports` |

Deux mécanismes structurants :

- **Chevauchement de dates.** `profile_cards.sejour` est une colonne `daterange`
  générée (borne haute infinie si le séjour est ouvert). Les recherches de cohorte
  utilisent l'opérateur `&&` sur des index GIST `(ville, type, sejour)`.
- **Masquage par vues.** RLS filtre des lignes, pas des colonnes. Un client ne lit
  jamais la ligne brute d'un autre compte : il passe par `v_profils_publics`,
  `v_cartes_publiques`, `v_locaux_actifs`, qui sortent `NULL` sur les champs que
  l'utilisateur a masqués. La donnée reste exploitable par le moteur de matching
  (`service_role`). Détail dans `docs/decisions-schema.md`.

## Fonctions exposées

| Fonction | Rôle |
|---|---|
| `groupes_compatibles(carte_id, tolerance_jours)` | Cohortes existantes compatibles avec une carte |
| `candidats_individuels(carte_id, limite, tolerance_jours)` | Profils individuels classés par score |
| `repondre_match(match_id, reponse)` | Accepter/refuser un match (écrit uniquement sa propre décision) |

`tolerance_jours` élargit la fenêtre de dates quand une ville est peu peuplée
(spec §14). Les deux premières vérifient que l'appelant possède bien la carte.

Les helpers d'autorisation (`est_bloque`, `est_participant`, `est_membre_groupe`,
`possede_carte`) vivent dans le schéma `app_private`, non exposé par PostgREST.

## Service de matching

Edge function `matching`, déclenchée à l'activation d'une carte. `POST` avec un
corps JSON :

| Action | Corps | Effet |
|---|---|---|
| `activer` | `{action, carte_id}` | Cherche une cohorte ; en crée une si aucune n'existe (§8.1.2), sinon renvoie les propositions (§8.1.3). Enregistre en parallèle les propositions individuelles (§8.2). |
| `rejoindre` | `{action, carte_id, groupe_id}` | Rejoint une cohorte proposée, après revalidation de la compatibilité. |
| `creer_cohorte` | `{action, carte_id}` | Crée sa propre cohorte malgré les propositions existantes. |

Découpage : `_partage/cohorte.ts` (fonctions pures : fenêtre, libellé, éligibilité,
élargissement) → `_partage/service_matching.ts` (orchestration, contre une
interface) → `matching/depot_supabase.ts` (requêtes) → `matching/index.ts` (HTTP).
Seules les deux premières couches portent des règles métier, et elles sont
testables sans rien démarrer.

Une cohorte couvre ±2 semaines autour de l'arrivée. Si la recherche ne donne
rien, elle est réessayée à ±7, ±21 puis ±60 jours avant d'abandonner (§14) ;
l'élargissement retenu est renvoyé pour que l'app puisse l'afficher.

## Jeu de test

`supabase/seeds/dev_matching.sql` crée 8 comptes autour de Lisbonne, mars 2027,
avec un cas par filtre : dates disjointes, autre ville, hors tranche d'âge, compte
bloqué, séjour ouvert, carte archivée, carte Local.

Ne jamais appliquer en production. Suppression :

```sql
delete from auth.users where email like '%@dev.project-connect.test';
```
