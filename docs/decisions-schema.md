# Décisions prises sur le schéma de données

La spec (`docs/spec-produit.md`) laisse plusieurs points ouverts. Voici ce qui a été
tranché pour pouvoir écrire le schéma, et ce qui reste à confirmer.

## 1. `statut` de carte ≠ carte principale

La spec dit à la fois « une carte Local **et** une ou plusieurs cartes Voyageur en
parallèle » et « une seule carte active à la fois ». Les deux ne sont pas
compatibles avec un seul champ.

Retenu : deux notions distinctes sur `profile_cards`.
- `statut` (`actif` / `inactif` / `archive`) — par carte, pilote la visibilité et
  le matching. Plusieurs cartes peuvent être actives.
- `est_principale` (booléen, une seule par compte, garantie par index unique
  partiel) — pilote ce qui s'affiche en priorité dans le fil de l'utilisateur.

## 2. Table `conversations` ajoutée

`messages` référence un `conversation_id` mais la spec §13 ne définit aucune table
`conversations`. Ajoutées : `conversations` (avec `matching_group_id` pour le chat
de cohorte) et `conversation_participants`.

## 3. Matching individuel : décision de chaque côté

La spec §8.2 dit « l'utilisateur accepte ou refuse » et « la connexion s'ouvre
seulement si acceptée », sans préciser si l'accord des deux est requis.

Retenu : accord mutuel. `individual_matches` porte `decision_a` et `decision_b`,
et `statut` (`propose`/`accepte`/`refuse`) en est une colonne générée. La paire est
ordonnée (`card_id_a < card_id_b`) pour garantir l'unicité.

**À confirmer** : si un seul « oui » doit suffire, c'est la colonne générée qui change.

## 4. `connections` : demandeur / destinataire

Renommé `user_id_a`/`user_id_b` (spec §13) en `demandeur_user_id` /
`destinataire_user_id` : pour une demande de mise en relation, la direction porte
du sens (qui demande, qui répond).

## 5. Masquage : vues plutôt que RLS

RLS filtre des lignes, pas des colonnes. Le masquage (`sexe_visible`,
`religion_visible`, `quartier_visible`, `entreprise_visible`…) ne peut donc pas y
être implémenté.

Retenu :
- un client authentifié ne lit **jamais** la ligne brute d'un autre compte ;
- tout ce qu'il voit des autres passe par les vues `v_profils_publics`,
  `v_cartes_publiques`, `v_locaux_actifs`, qui sortent `NULL` sur les champs masqués ;
- la donnée reste intacte en base et reste exploitable par le moteur de matching
  (`service_role`), comme le demande la spec §6.1.

Conséquence : ces vues sont en `SECURITY DEFINER`, ce que l'advisor Supabase
signale en ERROR (`security_definer_view`). C'est assumé — c'est le mécanisme même
du masquage. Elles refiltrent explicitement les comptes bloqués.

## 6. Confidentialité de la ville de résidence (§14) — **non tranché**

La spec §14 dit « ville précise de résidence non affichée publiquement tant que la
connexion n'est pas acceptée », mais §6.2 fait du quartier un champ dont
l'utilisateur choisit lui-même la visibilité.

Retenu pour l'instant, au plus strict : le quartier n'est visible que si
`quartier_visible = true`, sans déverrouillage à l'acceptation d'une connexion.

**À décider** : faut-il aussi révéler le quartier une fois la connexion acceptée,
même quand `quartier_visible = false` ?

## 7. Matching de groupe : Voyageur et Travailleur ensemble

« Type de carte proche » (§8.1) a été implémenté comme : toutes les cartes non-Local
sont compatibles entre elles. `groupes_compatibles()` renvoie un booléen `meme_type`
pour que l'app puisse afficher d'abord les groupes du même type.

## 8. Tranche d'âge préférée : filtre mutuel

Appliqué dans les deux sens — chacun doit tomber dans la fourchette de l'autre.

## 9. Score de matching individuel

`score = 0,6 × (intérêts communs / union des intérêts) + 0,4 × (jours communs / durée de mon séjour)`

Religion, nationalité et origine n'entrent dans aucun calcul (§6.1, §14). Les
pondérations sont un point de départ arbitraire, à ajuster sur des vraies données.

## 10. Consentement RGPD art. 9

`users.consentement_sensibles_at` + une contrainte CHECK : impossible de stocker une
religion, une nationalité ou une origine sans avoir enregistré un consentement.
Ne remplace pas l'avis juridique que la spec §14 appelle.

## Points hors périmètre de ce schéma

- Moteur de matching applicatif (création des groupes, envoi des propositions) —
  le schéma ne fournit que les structures et les fonctions de recherche.
- Agrégation d'événements via API Meetup/Eventbrite.
- Protection contre les mots de passe compromis : à activer dans les réglages Auth
  du projet Supabase (advisor `auth_leaked_password_protection`).

---

# Décisions prises sur le service de matching

## 11. Largeur d'une cohorte : ±2 semaines

La spec §5.1 donne « ex. ±2 semaines » comme illustration. Retenu tel quel :
`DEMI_FENETRE_JOURS = 14` dans `_partage/cohorte.ts`, constante unique à ajuster.

## 12. Élargissement par paliers : 0, 7, 21, 60 jours

La spec §14 demande d'« élargir automatiquement la fenêtre si peu d'utilisateurs
actifs » sans chiffrer. Retenu : quatre paliers, essayés dans l'ordre, arrêt au
premier concluant. L'élargissement effectivement utilisé est renvoyé à l'app,
pour qu'elle puisse dire « élargi à ±21 jours » plutôt que d'afficher des
résultats inexplicablement lointains.

Le seuil de déclenchement diffère selon l'objet : un seul groupe suffit, alors
qu'on élargit tant qu'il y a moins de 3 candidats individuels
(`CANDIDATS_SOUHAITES`).

## 13. Description de cohorte : découpage du mois en trois

`descriptionCohorte()` produit « Arrivées à Lisbonne — mi-mars 2027 », l'exemple
exact de la spec §8.1.2. Le mois est découpé en « début » (1–10), « mi- »
(11–20), « fin » (21–31).

## 14. Le chat de groupe est géré par trigger, pas par le service

`membres_sync_conversation` crée la conversation du groupe et y ajoute/retire les
participants. En base plutôt qu'en code applicatif : tout chemin d'insertion
(edge function, back-office, migration) donne le même résultat, et il ne peut pas
exister deux conversations pour un même groupe.

## 15. Archivage : fonction appelée, pas trigger

`archiver_cartes_expirees()` est à appeler quotidiennement (pg_cron ou edge
function planifiée) — **pas encore planifié**. Un trigger ne conviendrait pas :
l'archivage dépend du temps qui passe, pas d'une écriture.

## 16. Le service de matching tourne en `service_role`

`individual_matches` n'a pas de policy INSERT : les propositions sont créées par
le système, pas par les utilisateurs. L'edge function identifie l'appelant via son
JWT, puis construit le dépôt avec cet identifiant : `lireCarte()` ne voit que les
cartes de l'appelant, donc toute activation sur la carte d'autrui échoue en
« carte introuvable ».

## 17. Le score stocké est asymétrique

`candidats_individuels` calcule la part de séjour partagée relativement au séjour
de référence. Une paire n'étant enregistrée qu'une fois, le score conservé est
celui de la carte qui a déclenché le matching. Acceptable en MVP ; à revoir si le
score devient visible des utilisateurs.

## Non couvert à ce stade

- Aucun test HTTP de bout en bout de l'edge function : le réseau de
  l'environnement de développement bloque `*.supabase.co`. La logique est
  couverte par 28 tests unitaires et le contrat base de données a été validé
  requête par requête, mais le trajet HTTP complet reste à vérifier depuis un
  poste ayant accès au projet.
- Planification de `archiver_cartes_expirees()`.
- Notifications push à la création d'un match ou d'un message.

---

# Décisions prises en comblant les trous du MVP

## 18. Chat 1:1 : trigger sur l'acceptation

Rien n'ouvrait la conversation quand un match ou une demande de mise en relation
était accepté — le parcours §9.6 s'arrêtait là. Réglé par deux triggers,
symétriques de celui des cohortes.

Le déclencheur est `statut = 'accepte'`, une colonne générée. Conséquence utile :
si la décision §8.2 bascule vers « un seul oui suffit », seule la formule de la
colonne change et les triggers continuent de fonctionner sans retouche.

`conversations` porte maintenant `individual_match_id` et `connection_id`, avec
une contrainte garantissant exactement une origine par conversation.

## 19. Photos : bucket privé, pas public

Un bucket public rendrait toute photo accessible à qui connaît son chemin, ce qui
contournerait le blocage (§9.7). Bucket privé, accès par URL signée, et les
policies de `storage.objects` refilrent les comptes bloqués. Convention de chemin
`<user_id>/<fichier>`, le premier segment faisant foi pour la propriété.

## 20. i18n : `traductions jsonb` par table, pas de table de traductions

Les colonnes existantes restent la langue de référence (français) ; chaque table
de contenu éditorial porte `{"en": {...}}`. Une table de traductions séparée
serait plus normalisée mais imposerait une jointure à chaque lecture, pour un
volume qui reste éditorial. `public.traduire()` applique le repli.

Ne concerne que le contenu éditorial : ce que les utilisateurs écrivent (bio,
messages, événements soumis) n'est pas traduit.

## 21. Seuils de modération en table, pas en constantes

`app_private.parametres` porte le seuil de signalements convergents (3), la
tolérance de dates pour les doublons (3 jours) et le seuil de similarité de titre
(0,4). La spec §9.7 demande un seuil « configurable » — en table, il se change
sans migration.

Quand le seuil est atteint, **tous** les signalements ouverts du profil passent
en priorité haute, pas seulement le dernier : un modérateur qui trie par priorité
doit voir le dossier complet remonter d'un bloc.

## 22. `evenements_similaires()` voit les soumissions en attente

En `SECURITY DEFINER` volontairement : détecter un doublon suppose de voir les
soumissions encore en modération, y compris celles d'autres utilisateurs. La
fonction ne renvoie que titre, dates et statut — jamais l'auteur.

L'index posé initialement sous le nom `events_titre_trgm` était en réalité un
btree, inutilisable pour une recherche par similarité. Remplacé par un vrai index
GIN trigramme.

## Ce qui reste à construire

- **Application cliente** (React Native / Expo) — tout le §11.
- **Providers d'authentification** : aucun n'est configuré (§9.1).
- **Back-office de modération** : traiter la file des signalements et des
  événements en attente.
- **Notifications push** (FCM, §12).
- **Agrégation d'événements** Meetup/Eventbrite (§12) — la spec la dit mockable
  au début.
- **Intégration continue** : les tests ne tournent pas automatiquement.
- **Test HTTP de bout en bout** de l'edge function (réseau bloqué ici).
- **Protection contre les mots de passe compromis**, à activer dans les réglages
  Auth du projet.

## 23. Blocage : masquer la conversation, pas seulement les messages

La policy sur `messages` filtrait les messages d'un compte bloqué, mais la
conversation restait dans la liste — une coquille vide, là où la spec §9.7 dit
« la conversation existante est masquée pour B ». `v_mes_conversations` applique
la règle au bon niveau.

Le masquage ne vaut que pour les échanges à deux : bloquer un membre d'une
cohorte ne fait pas disparaître le groupe, seulement ses messages. Et il vaut
dans les deux sens — le bloqué ne voit pas davantage la conversation que le
bloqueur, sans quoi il verrait ses propres messages rester sans réponse.

Un premier jet calculait `autre_user_id` pour toutes les conversations. Sur une
cohorte, cela désignait un membre au hasard, et un groupe pouvait passer pour un
tête-à-tête côté app — au point de faire croire à une fuite lors du test. Le
champ n'est renseigné que pour les conversations directes.

## 24. Soumission d'événement : la vérification de doublon n'est pas contournable

La spec §7.1 dit qu'elle est « proposée ». Retenu plus strict : elle est imposée
comme étape, mais son résultat ne bloque pas. L'utilisateur voit les entrées
similaires puis décide — renoncer, ou confirmer que ce n'en est pas un. Un
bouton d'envoi direct aurait vidé la mesure de son sens, sans pour autant qu'on
puisse décider à sa place qu'il s'agit d'un doublon.

Modifier un champ après la vérification l'invalide : soumettre sur la foi d'un
contrôle fait sur une version antérieure du formulaire n'aurait aucune valeur.

Le statut de modération n'est pas transmis par le client. La policy l'impose à
« en_attente » et refuse toute autre valeur : le passer depuis l'app laisserait
croire qu'il est négociable.

## 25. Un compte bloqué n'est plus lisible, y compris par celui qui l'a bloqué

`v_profils_publics` exclut les blocages dans les deux sens. L'écran des comptes
bloqués n'obtient donc pas le profil des personnes qu'il liste, et affiche une
pastille à initiale. C'est cohérent — le blocage coupe la visibilité — mais cela
signifie qu'on débloque quelqu'un sans le revoir. À revoir si la liste s'avère
inutilisable à l'usage : il faudrait alors une vue dédiée exposant le strict
minimum pour identifier qui l'on débloque.

## 26. L'interface est en français ; seuls les contenus sont bilingues

Le premier rendu réel a montré « Arriving in 180 days » au milieu d'un écran
français : `libelleEtatSejour` suivait la langue de l'appareil alors que tous
les libellés d'écran sont écrits en dur en français. Une phrase anglaise isolée
est pire que du tout-français.

Séparé depuis : `LANGUE_INTERFACE` (fixée à `"fr"`) pour les textes de l'app,
et la langue de l'appareil pour les contenus venant de la base, qui sont
réellement bilingues. À basculer sur `choisirLangue()` le jour où les écrans
seront traduits.
