# Spec produit & technique — App de mise en relation pour nouveaux arrivants

## 1. Vision

Une application qui aide les personnes qui arrivent dans une nouvelle ville (pour un voyage long, une mobilité professionnelle, une expatriation) à :
1. Rencontrer d'autres personnes qui arrivent au même moment (et, secondairement, des locaux volontaires),
2. Découvrir rapidement les événements et activités de la ville pour s'organiser dès l'arrivée,
3. Se projeter concrètement dans leur nouvelle vie (logement temporaire, démarches, premiers repères).

Positionnement : réseau d'entraide et de rencontre amicale/professionnelle — **explicitement pas une app de dating**.

## 2. Problème adressé

- Arriver seul dans une nouvelle ville est un moment de forte anxiété sociale et logistique.
- Les apps existantes couvrent soit le social générique (Meetup), soit l'expat networking payant (InterNations), soit le matching voyageur type swipe (TravelBesties, Nomax, Trespot) — peu combinent "cohorte d'arrivée synchronisée" + "organisation concrète de la nouvelle vie".
- Les événements locaux sont dispersés sur plusieurs plateformes, difficiles à filtrer pour quelqu'un qui ne connaît pas encore la ville.

## 3. Public cible

- **Primaire** : personnes en mobilité professionnelle (VIE, expatriation, mission longue), étudiants en échange, digital nomads s'installant plusieurs semaines/mois.
- **Secondaire** : locaux volontaires ("guides") qui veulent accueillir/aider des nouveaux arrivants.
- **Tertiaire** : voyageurs long séjour non professionnels.

## 4. Concurrence identifiée (repères, pas à copier)

| App | Angle principal | Limite |
|---|---|---|
| Locpats | Matching arrivants/locaux + guide + events + IA sorties hebdo | Très proche de l'idée — à différencier par la logique de cohorte |
| InterNations | Networking expat mondial, 420 villes | Payant, orienté événementiel pur |
| Newbee Connect | Events + Q&A + communautés par ville | Pas de matching par date d'arrivée |
| TravelBesties / Nomax / Trespot / DUAL | Matching voyageurs par dates/lieu, format swipe | Glisse souvent vers le dating, peu d'aide à l'installation |
| Seatlr | Room par vol/destination | Très ponctuel, pas de suivi dans la durée |

## 5. Différenciateurs à construire

1. **Matching par fenêtre d'arrivée** : grouper les utilisateurs arrivant dans une même ville sur une même période (ex. ±2 semaines) en "cohortes", plutôt qu'un matching géographique flou permanent.
2. **Calendrier d'événements personnalisé à l'arrivée** : agrégation d'événements locaux (API Meetup/Eventbrite/Time Out, ou scraping léger) filtrés par date d'arrivée et centres d'intérêt.
3. **Système de cartes de profil multiples** (Local / Voyageur / Travailleur) réactivables selon la situation réelle de l'utilisateur — pas un statut figé.
4. **Checklist d'installation intégrée** : logement temporaire, SIM/banque, transports, démarches — reliée au fil social.
5. **Positionnement anti-dating clair**, avec modération pour le faire respecter.

## 6. Profil global et système de cartes

### 6.1 Informations de profil global (communes à toutes les cartes)

Ces informations sont renseignées une seule fois au niveau du compte (pas répétées par carte, car identiques partout) :

- **Photo de profil** : obligatoire, toujours visible (nécessaire à la confiance minimale entre utilisateurs).
- **Âge** (via date de naissance) : obligatoire, **toujours visible**, non masquable.
- **Tranche d'âge préférée pour le matching** : obligatoire — la fourchette d'âge avec laquelle l'utilisateur est le plus à l'aise pour être mis en relation ; utilisée comme filtre dans le matching individuel et de groupe, mais n'est pas un champ affiché publiquement sur le profil des autres.
- **Sexe** : renseigné, **masquable** par l'utilisateur, utilisable en interne pour le matching/filtrage même si masqué.
- **Religion** : renseignée, **masquable** par l'utilisateur — champ purement déclaratif, **non utilisé dans la logique de matching**.
- **Nationalité(s)** : renseignées, **masquables** — champ purement déclaratif, **non utilisé dans la logique de matching**.
- **Origine(s)** : renseignées, **masquables** — champ purement déclaratif, **non utilisé dans la logique de matching**.

Le sexe dispose d'un booléen de visibilité indépendant (`sexe_visible`) : la donnée reste utilisable en interne pour le matching/filtrage même masquée du profil public. Religion, nationalité et origine disposent aussi chacune de leur booléen de visibilité (ex: `religion_visible`), mais servent uniquement à l'affichage du profil (quand l'utilisateur choisit de les montrer) — elles ne rentrent dans aucun calcul de matching ou de suggestion.

### 6.2 Cartes de profil (situations géographiques/temporelles)

Un compte utilisateur peut posséder plusieurs **cartes**, chacune représentant une situation géographique/temporelle distincte :

- **Carte Local** : rattachée à une ville de résidence, pas de dates de début/fin. Peut être mise **active/inactive** par l'utilisateur (ex: inactive s'il est lui-même en voyage ailleurs). Tant qu'active, elle rend l'utilisateur visible et contactable dans la découverte "locaux" de cette ville. Peut renseigner un **quartier précis**, masquable, pour permettre aux voyageurs de cibler des zones spécifiques sans que le quartier exact soit forcément affiché publiquement.
- **Carte Voyageur** : ville de destination + date d'arrivée + date de départ (optionnelle si séjour ouvert). Si un logement est déjà trouvé, peut renseigner un **quartier/lieu précis**, masquable — utilisé pour proposer des événements et des personnes à proximité même si l'information reste privée.
- **Carte Travailleur** : identique à la carte Voyageur (ville, dates, quartier précis masquable), avec en plus un champ **entreprise** optionnel et masquable — utile pour affiner le ciblage (ex: collègues d'une même entreprise arrivant en même temps) sans obligation de le rendre public.

Comme pour le profil global, le quartier précis et l'entreprise restent **utilisables en interne pour le ciblage/matching** (proximité géographique, groupes) même quand ils sont masqués du profil visible par les autres utilisateurs.

Règles :
- Un utilisateur peut avoir une carte Local ET une ou plusieurs cartes Voyageur/Travailleur en parallèle (passées, actuelles, futures).
- Une seule carte "active" à la fois détermine ce qui est affiché en priorité dans son propre fil (accueil, matching en cours), mais les autres cartes restent en base (historique, futurs séjours planifiés).
- Chaque nouveau projet de déplacement (même si un précédent existe déjà) crée une **nouvelle carte Voyageur/Travailleur**, ce qui relance automatiquement la recherche de groupe/matchs pour ce nouveau projet.
- Une carte passée (date de fin dépassée) passe automatiquement en statut "archivée" mais reste consultable dans l'historique du profil.

### Hobbies / centres d'intérêt
- Liste prédéfinie et catégorisée de hobbies/intérêts, sélection multiple par tags cliquables (façon Tinder), rattachée à chaque carte (les intérêts peuvent légèrement varier selon le contexte du séjour, mais une valeur par défaut vient du profil global de l'utilisateur).

## 7. Données de référence par ville/pays

Chaque ville couverte par l'app dispose d'une fiche de référence, affichée aux arrivants dès l'activation de leur carte :

- **Transport** : nom du système de transport local, description rapide, apps à télécharger (ex: nom de l'app de métro/bus locale)
- **Apps recommandées** : liste d'apps utiles dans le pays (banque, VTC, livraison, etc.)
- **Numéros d'urgence** : police, pompiers, SAMU/urgences médicales, numéro d'urgence général
- **Points d'intérêt** : monuments, musées, bâtiments emblématiques (contenu semi-statique, entretenu manuellement/communautairement)
- **Événements éphémères** : expositions, festivals, événements ponctuels avec dates de début/fin (alimentés par agrégation API + saisie communautaire), distincts des points d'intérêt permanents

Ces fiches sont gérées indépendamment de l'activité utilisateur (contenu semi-éditorial), avec une possibilité de contribution communautaire modérée en V2.

### 7.1 Soumission communautaire d'événements (MVP)
- Tout utilisateur peut soumettre un événement absent de la base : titre, type d'événement (expo, festival, concert, marché, autre), ville, date de début, date de fin, lien/source, description courte.
- Avant soumission, une vérification de doublon est proposée (recherche sur titre + ville + dates proches) pour éviter les entrées redondantes.
- L'événement soumis entre en statut **"en attente de modération"** et n'est visible dans le flux public qu'après validation par un modérateur (ou un système de règles automatiques simples pour le MVP : champs obligatoires complets, pas de doublon détecté).
- L'auteur de la soumission est conservé (traçabilité) pour pouvoir gérer les abus/soumissions répétées invalides.

## 8. Système de matching

### 8.1 Matching de groupe (Voyageurs/Travailleurs uniquement)
1. À l'activation d'une carte Voyageur/Travailleur, le système cherche un `matching_group` existant correspondant à : même ville + type de carte proche + fenêtre de dates qui chevauche la sienne.
2. **Aucun groupe trouvé** → création automatique d'un nouveau groupe avec une description générée (ex: "Arrivées à Lisbonne — mi-mars 2027"), modifiable ensuite par les membres.
3. **Un ou plusieurs groupes trouvés** → l'utilisateur voit la/les propositions (description + liste des membres visibles) et choisit de **rejoindre un groupe existant** ou **d'en créer un nouveau**.
4. Chaque groupe est un chat de groupe avec une description affichée en en-tête, pour que les nouveaux arrivants puissent s'identifier rapidement au groupe avant de le rejoindre.

### 8.2 Matching individuel (Voyageurs/Travailleurs uniquement)
- En parallèle du groupe, le système propose des **profils individuels** ayant un projet similaire (même ville, dates proches, intérêts communs) sous forme de suggestions une par une.
- L'utilisateur accepte ou refuse chaque proposition (pas de fil de discussion automatique — la connexion s'ouvre seulement si acceptée).

### 8.3 Découverte des locaux
- Par ville, liste des locaux **actifs** (statut activable/désactivable par eux-mêmes), filtrable par intérêts/langue.
- Un local ne passe pas par le matching de groupe ou individuel — il est contacté directement par les arrivants via une demande de mise en relation.

## 9. Fonctionnalités MVP (synthèse)

### 9.1 Onboarding & profil
- Inscription (email ou OAuth)
- Création d'une ou plusieurs cartes : Local / Voyageur / Travailleur
- Pour Voyageur/Travailleur : ville, date d'arrivée, date de départ (optionnelle)
- Pour Local : ville, statut actif/inactif
- Sélection des hobbies/intérêts via liste cliquable

### 9.2 Matching (sections 8.1 et 8.2)

### 9.3 Découverte de locaux (section 8.3)

### 9.4 Fiche de référence ville + soumission d'événements (sections 7 et 7.1)

### 9.5 Checklist d'installation
- Liste de tâches pratiques suggérées selon le pays/ville (logement, banque, SIM, transport)

### 9.6 Messagerie
- Chat 1:1 (matchs individuels acceptés) et chat de groupe (matching de groupe)
- Modération basique (signalement, blocage) — détail en 9.7

### 9.7 Sécurité des échanges : blocage et signalement
- **Blocage** : accessible directement depuis une conversation ou un profil. Une fois un utilisateur A bloqué par B, A ne peut plus envoyer de message à B, n'apparaît plus dans ses suggestions de matching/découverte, et la conversation existante est masquée pour B (sans être supprimée côté données, pour trace en cas de signalement ultérieur). Le blocage est débloquable à tout moment par celui qui l'a initié.
- **Signalement** : accessible directement depuis une conversation en cours (bouton visible pendant l'échange) ou depuis un profil. L'utilisateur choisit un motif (harcèlement, contenu inapproprié, faux profil, comportement déplacé, autre) et peut ajouter une description libre. Le signalement crée automatiquement un enregistrement dans une file de modération, avec le contexte de la conversation/message concerné si pertinent.
- **Traitement** : un signalement passe en statut "en attente" puis "traité" par un modérateur (humain en MVP, avec possibilité d'automatisation en V2). Plusieurs signalements convergents sur un même profil déclenchent une revue prioritaire (seuil configurable).
- Le blocage est une action immédiate et autonome de l'utilisateur ; le signalement passe par la modération et peut entraîner un avertissement, une suspension temporaire ou un bannissement du profil concerné.

## 10. Fonctionnalités V2 (hors MVP)

- Recommandations IA de sorties hebdomadaires personnalisées
- Programme de guides locaux formalisé (matching arrivant ↔ local)
- Intégration calendrier externe (Google Calendar)
- Vérification d'identité / badges de confiance
- Contribution communautaire modérée aux points d'intérêt permanents de la fiche ville (les événements éphémères sont déjà soumissibles en MVP, cf. 7.1)
- Version "entreprise" pour la mobilité RH (packs d'onboarding par entreprise partenaire)

## 11. Flux utilisateur principal (MVP)

1. Inscription → création de la première carte (Local, Voyageur ou Travailleur) → intérêts
2. Si carte Voyageur/Travailleur active → proposition de rejoindre/créer un groupe + suggestions de matchs individuels
3. Écran d'accueil : groupe rejoint (chat) + matchs individuels en attente + fiche de référence ville + checklist
4. Nouveau projet de voyage → création d'une nouvelle carte → nouveau cycle de matching, indépendant des cartes précédentes

## 12. Architecture technique recommandée

- **Frontend mobile** : React Native (Expo) — un seul code iOS/Android, itération rapide, SDK Supabase mature en JS
- **Backend/BaaS** : Supabase (Postgres + Auth + Realtime + Storage) — couvre auth, base relationnelle, chat temps réel et stockage en un seul service, adapté à un MVP solo/petite équipe. Un connecteur Supabase est déjà disponible pour ce projet.
- **Base de données** : PostgreSQL, avec `daterange` et l'opérateur `&&` pour détecter les chevauchements de dates (matching)
- **Logique de matching** : service applicatif dédié (fonction backend ou edge function Supabase), déclenché à l'activation d'une carte — à isoler du reste du code pour rester testable
- **Géolocalisation/villes** : normalisation via API de type Google Places
- **Événements éphémères** : ingestion via API Meetup/Eventbrite, complétée par saisie communautaire modérée
- **Notifications push** : Firebase Cloud Messaging
- **Modération temps réel** : signalement + blocage stockés en base, filtrage géré côté backend avant affichage

## 13. Modèle de données (MVP)

- `users` (id, email, langues, bio, photo_url, date_naissance, age_min_prefere, age_max_prefere, sexe, sexe_visible, religion, religion_visible, nationalites jsonb, nationalites_visible, origines jsonb, origines_visible)
- `profile_cards` (id, user_id, type: local/voyageur/travailleur, ville, pays, date_debut, date_fin nullable, statut: actif/inactif/archive, quartier_precis nullable, quartier_visible, entreprise nullable, entreprise_visible, created_at)
- `card_hobbies` (card_id, hobby_id)
- `hobbies` (id, nom, categorie, icone)
- `city_guides` (id, ville, pays, systeme_transport_nom, transport_description, apps_recommandees jsonb, numeros_urgence jsonb)
- `points_of_interet` (id, city_guide_id, nom, type, description, lien)
- `ephemeral_events` (id, city_guide_id, titre, type, date_debut, date_fin, lien, description, source: agrege/utilisateur, soumis_par_user_id nullable, statut_moderation: en_attente/approuve/rejete, created_at)
- `matching_groups` (id, ville, type_carte, fenetre_debut, fenetre_fin, description, created_at)
- `matching_group_members` (group_id, card_id, statut: membre/en_attente)
- `individual_matches` (card_id_a, card_id_b, statut: propose/accepte/refuse, score)
- `connections` (user_id_a, user_id_b, statut: en_attente/accepte/refuse) — pour les demandes locaux ↔ arrivants
- `checklist_items` (id, ville/pays, titre, ordre)
- `user_checklist_status` (user_id, checklist_item_id, statut)
- `messages` (id, conversation_id, sender_id, contenu, date)
- `blocks` (id, blocker_user_id, blocked_user_id, created_at)
- `reports` (id, reporter_user_id, reported_user_id, conversation_id nullable, message_id nullable, motif: harcelement/contenu_inapproprie/faux_profil/comportement_deplace/autre, description, statut: en_attente/en_cours/traite, action_prise nullable, created_at)

## 14. Contraintes non-fonctionnelles

- **Confidentialité** : ville précise de résidence non affichée publiquement tant que la connexion n'est pas acceptée
- **Données sensibles (RGPD)** : religion, nationalité et origine sont des catégories de données considérées comme sensibles par le RGPD (article 9) — elles sont purement déclaratives (non utilisées dans le matching), mais nécessitent tout de même un consentement explicite et distinct à la collecte et un stockage restreint/chiffré. À valider avec un avis juridique avant mise en production.
- **Modération** : signalement utilisateur/message accessible pendant un échange, blocage immédiat et autonome, seuil de signalements convergents déclenchant une revue prioritaire, règles anti-dating explicites dans les CGU
- **Sécurité** : pas d'exposition de données personnelles sensibles (immigration, statut visa) dans les profils publics
- **Scalabilité du matching** : élargir automatiquement la fenêtre de dates ou le rayon si peu d'utilisateurs actifs dans une ville pour éviter des groupes vides
- **Internationalisation** : prévoir le multilingue dès l'architecture (même si le MVP ne sort qu'en français/anglais)

## 15. Roadmap suggérée

- **MVP (v0.1)** : cartes de profil + matching groupe/individuel + découverte locaux + fiche ville, une seule ville pilote
- **v0.2** : checklist d'installation + messagerie complète + modération
- **v1.0** : ouverture multi-villes, contribution communautaire aux fiches ville
- **v2.0** : recommandations IA, programme de guides formalisé, offre B2B mobilité RH

## 16. Notes pour l'implémentation avec Claude Code

- Démarrer par le schéma de données (`profile_cards`, `matching_groups`, `city_guides`) avant toute UI avancée — c'est le cœur différenciant du produit.
- Implémenter le système de cartes et son cycle de vie (actif/inactif/archivé) avant le matching.
- Traiter la logique de matching (groupe + individuel) comme un module isolé et testable unitairement (créer des cas de test avec plusieurs cartes se chevauchant ou non en dates).
- Traiter les fiches ville et l'agrégation d'événements comme un module indépendant/mockable au début (données de test), pour ne pas bloquer le développement sur l'intégration API externe.
- Prévoir des seeds de données de test (plusieurs villes, plusieurs cartes avec dates variées) pour tester le matching sans attendre une vraie base d'utilisateurs.
