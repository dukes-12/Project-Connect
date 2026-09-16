# Project-Connect

App de mise en relation pour nouveaux arrivants dans une ville : rencontrer les
personnes qui arrivent au même moment, découvrir les événements locaux, et
s'installer concrètement.

Spec produit & technique : [`docs/spec-produit.md`](docs/spec-produit.md).

## État

Backend complet pour le périmètre MVP (§9), appliqué et déployé sur le projet
Supabase `Project-Connect` (région eu-central-1).

Application mobile Expo : le périmètre MVP est couvert — session, onboarding
avec photo, accueil, cohortes, propositions de match, messagerie temps réel,
fiche ville, checklist d'installation, découverte des locaux, soumission
d'événement, blocage et signalement. Elle compile et se bundle, mais **n'a
jamais été exécutée** : voir « Limites de vérification ».

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
mobile/                  Application Expo (expo-router)
  app/                   Routes : connexion, onboarding, accueil, cohorte…
  src/domaine/           Logique pure, testée unitairement
  src/donnees/           Client Supabase, types générés, requêtes
  src/ui/                Thème et composants partagés
```

## Tests

```
npm test
```

85 tests unitaires, sans base ni réseau :

- **28 côté backend** — logique de cohorte et service de matching, écrit contre
  une interface `DepotMatching` qu'un dépôt en mémoire implémente.
- **57 côté mobile** — découpage de la session, traduction, état d'un séjour,
  décodage base64, validation d'une soumission d'événement.

Pas de framework de test : Node exécute le TypeScript directement
(`--experimental-strip-types`). `npm run typecheck:mobile` vérifie le typage de
l'app.

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
| `evenements_similaires(ville, pays, titre, date)` | Doublons avant soumission d'un événement (§7.1) |
| `traduire(defaut, traductions, langue, champ)` | Contenu dans la langue demandée, repli sur le français |
| `archiver_cartes_expirees()` | Archive les séjours terminés — planifiée tous les jours à 03:00 UTC |

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

## Ce que la base fait toute seule

| Déclencheur | Effet |
|---|---|
| Rejoindre une cohorte | Ouvre le chat de groupe et y ajoute le membre ; le quitter l'en retire |
| Match individuel accepté des deux côtés | Ouvre le chat 1:1 (§8.2) |
| Demande de mise en relation acceptée | Ouvre le chat avec le local (§8.3) |
| 3ᵉ signalement ouvert sur un profil | Passe tout son dossier en revue prioritaire (§9.7) |
| Blocage entre deux comptes | Fait disparaître leur échange à deux de `v_mes_conversations`, dans les deux sens |
| Tous les jours à 03:00 UTC | Archive les cartes dont le séjour est terminé (§6.2) |

Les seuils vivent dans `app_private.parametres`, modifiables sans migration.

## Photos et multilingue

Les photos de profil vont dans le bucket privé `photos-profil`, au chemin
`<user_id>/<fichier>`. Bucket privé et non public : l'accès passe par une URL
signée, donc un compte bloqué ne peut pas récupérer la photo de celui qui l'a
bloqué.

Les contenus éditoriaux (hobbies, fiches ville, points d'intérêt, checklist,
événements) portent une colonne `traductions jsonb` de forme
`{"en": {"nom": "..."}}`. Les colonnes d'origine restent la version française et
servent de repli. Anglais déjà saisi pour tout le contenu de référence.

## Jeu de test

`supabase/seeds/dev_matching.sql` crée 8 comptes autour de Lisbonne, mars 2027,
avec un cas par filtre : dates disjointes, autre ville, hors tranche d'âge, compte
bloqué, séjour ouvert, carte archivée, carte Local.

Ne jamais appliquer en production. Suppression :

```sql
delete from auth.users where email like '%@dev.project-connect.test';
```

## L'application mobile

```
cd mobile
cp .env.example .env
npm install --legacy-peer-deps
npx expo start
```

Parcours couvert (§11) : inscription → profil et photo → première carte →
centres d'intérêt → accueil, d'où partent cohortes, propositions de match,
messagerie temps réel, fiche ville, checklist d'installation et découverte des
locaux.

La session est stockée dans SecureStore **découpée en fragments** : un jeton
Supabase dépasse la limite de 2048 octets par entrée. Le découpage se fait sur
les unités UTF-16, pour qu'un emoji à cheval sur deux fragments soit recollé
intact.

Tout ce qui concerne les autres comptes passe par les vues masquées
(`v_cartes_publiques`, `v_locaux_actifs`) et jamais par les tables : les champs
qu'une personne a choisi de cacher reviennent à `null` jusque dans l'app.

La photo part en base64 depuis la galerie, décodée en octets par
`src/domaine/base64.ts` — écrit à la main plutôt qu'avec un polyfill, parce que
Hermes ne garantit pas `atob` et que `Buffer` n'existe pas en React Native. Elle
est envoyée **avant** la création du profil : un échec ne laisse donc pas une
ligne pointant vers un fichier inexistant. À l'affichage, le bucket étant privé,
chaque photo passe par une URL signée.

## Limites de vérification

Le réseau de l'environnement de développement bloque `*.supabase.co`,
`docs.expo.dev` et l'API d'Expo. En conséquence :

- **L'app n'a jamais été lancée.** Elle passe `tsc --noEmit` et se bundle
  (`expo export --platform web`, 841 modules), ce qui prouve que le graphe de
  modules et les types tiennent — pas que les écrans s'affichent correctement.
- **Les versions des paquets n'ont pas été résolues par `expo install`** mais
  par npm. Les paquets Expo sont bien alignés sur le SDK 57, mais cela reste à
  confirmer sur un poste connecté.
- **L'edge function n'a pas été testée en HTTP.** Son contrat base de données a
  été validé requête par requête.

## Blocage et signalement

Deux actions délibérément distinctes à l'écran : le blocage est immédiat et
réversible par celui qui l'a posé ; le signalement part en file de modération et
n'a pas d'effet visible tout de suite. Les confondre laisserait croire qu'un
signalement fait taire l'autre.

L'accès est là où la spec §9.7 le demande — pendant l'échange (bouton d'en-tête
sur un tête-à-tête, appui long sur un message dans une cohorte, ce qui joint le
message au signalement) et depuis les profils, dans les propositions de match
comme dans la liste des locaux.

Côté base, `v_mes_conversations` fait disparaître un échange à deux dès qu'un
blocage existe dans un sens ou dans l'autre. Une cohorte, elle, reste visible :
seuls les messages du compte bloqué en sont filtrés, y compris dans l'aperçu.

## Soumission d'un événement

Le formulaire ne part jamais directement : la vérification de doublon est
imposée avant l'envoi, comme le demande le §7.1. Les entrées similaires — même
ville, dates proches, titre voisin au sens trigramme — sont affichées, y compris
celles encore en modération, puisque c'est précisément le doublon qu'on veut
éviter. L'utilisateur peut alors renoncer, ou confirmer que ce n'en est pas un.

Modifier un champ après vérification invalide celle-ci : on ne soumet pas un
formulaire sur la foi d'un contrôle fait sur une version antérieure.

## Ce qui reste à construire
- **Modification du profil et des cartes** après l'onboarding.
- Back-office de modération, notifications push, agrégation d'événements.
