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
