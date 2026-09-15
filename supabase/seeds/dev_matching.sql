-- Jeu de test pour le matching (§16) — DONNÉES DE DÉVELOPPEMENT UNIQUEMENT.
-- Volontairement hors de supabase/migrations/ : ne doit jamais partir en prod.
-- Suppression : delete from auth.users where email like '%@dev.project-connect.test';
--
-- Scénario couvert, autour de Lisbonne mi-mars 2027 :
--   Alice / Bruno / Carla  → fenêtres qui se chevauchent, doivent matcher
--   Diego                  → même ville, dates disjointes → ne doit PAS matcher
--   Farid                  → mêmes dates, autre ville     → ne doit PAS matcher
--   Gaby                   → dates OK, hors tranche d'âge → ne doit PAS matcher
--   Hugo                   → dates OK, bloqué par Alice   → ne doit PAS matcher
--   Emma                   → carte Local active à Lisbonne (découverte, pas matching)
--   Carla                  → séjour ouvert (date_fin nulle)

begin;

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-4111-8111-000000000001', 'alice@dev.project-connect.test', 'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-000000000002', 'bruno@dev.project-connect.test', 'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-000000000003', 'carla@dev.project-connect.test', 'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-000000000004', 'diego@dev.project-connect.test', 'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-000000000005', 'emma@dev.project-connect.test',  'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-000000000006', 'farid@dev.project-connect.test', 'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-000000000007', 'gaby@dev.project-connect.test',  'authenticated', 'authenticated'),
  ('11111111-1111-4111-8111-000000000008', 'hugo@dev.project-connect.test',  'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into public.users
  (id, email, langues, bio, photo_url, date_naissance, age_min_prefere, age_max_prefere,
   sexe, sexe_visible, nationalites, nationalites_visible, consentement_sensibles_at)
values
  ('11111111-1111-4111-8111-000000000001', 'alice@dev.project-connect.test', '{fr,en}',
   'VIE marketing, j''arrive à Lisbonne en mars.', 'https://example.test/alice.jpg',
   '1999-04-12', 25, 40, 'femme', true, '["FR"]'::jsonb, true, now()),
  ('11111111-1111-4111-8111-000000000002', 'bruno@dev.project-connect.test', '{fr,pt,en}',
   'Détaché 6 mois par mon entreprise.', 'https://example.test/bruno.jpg',
   '1996-01-30', 25, 45, 'homme', true, '["FR","PT"]'::jsonb, false, now()),
  ('11111111-1111-4111-8111-000000000003', 'carla@dev.project-connect.test', '{es,en}',
   'Nomade, séjour ouvert.', 'https://example.test/carla.jpg',
   '2001-07-08', 22, 38, 'femme', false, '[]'::jsonb, false, null),
  ('11111111-1111-4111-8111-000000000004', 'diego@dev.project-connect.test', '{es,pt}',
   'Arrivée fin d''été.', 'https://example.test/diego.jpg',
   '1992-11-03', 25, 45, 'homme', true, '[]'::jsonb, false, null),
  ('11111111-1111-4111-8111-000000000005', 'emma@dev.project-connect.test', '{pt,en,fr}',
   'Lisboète, contente d''accueillir des nouveaux arrivants.', 'https://example.test/emma.jpg',
   '1986-02-19', 20, 60, 'femme', true, '[]'::jsonb, false, null),
  ('11111111-1111-4111-8111-000000000006', 'farid@dev.project-connect.test', '{fr,de,en}',
   'Mobilité interne vers Berlin.', 'https://example.test/farid.jpg',
   '1998-05-22', 25, 40, 'homme', true, '[]'::jsonb, false, null),
  ('11111111-1111-4111-8111-000000000007', 'gaby@dev.project-connect.test', '{en}',
   'Étudiante en échange.', 'https://example.test/gaby.jpg',
   '2008-03-01', 18, 24, 'autre', false, '[]'::jsonb, false, null),
  ('11111111-1111-4111-8111-000000000008', 'hugo@dev.project-connect.test', '{fr,en}',
   'Mission longue à Lisbonne.', 'https://example.test/hugo.jpg',
   '1994-09-14', 25, 45, 'homme', true, '[]'::jsonb, false, null)
on conflict (id) do nothing;

insert into public.profile_cards
  (id, user_id, type, ville, pays, date_debut, date_fin, statut, est_principale,
   quartier_precis, quartier_visible, entreprise, entreprise_visible)
values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001',
   'voyageur',    'Lisbonne', 'Portugal', '2027-03-10', '2027-06-10', 'actif', true,  'Alfama',   true,  null, false),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000002',
   'travailleur', 'Lisbonne', 'Portugal', '2027-03-15', '2027-09-15', 'actif', true,  'Parque das Nações', false, 'Acme SA', false),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000003',
   'voyageur',    'Lisbonne', 'Portugal', '2027-03-20', null,         'actif', true,  null,       false, null, false),
  ('22222222-2222-4222-8222-000000000004', '11111111-1111-4111-8111-000000000004',
   'voyageur',    'Lisbonne', 'Portugal', '2027-08-01', '2027-10-01', 'actif', true,  null,       false, null, false),
  ('22222222-2222-4222-8222-000000000005', '11111111-1111-4111-8111-000000000005',
   'local',       'Lisbonne', 'Portugal', null,         null,         'actif', true,  'Graça',    true,  null, false),
  ('22222222-2222-4222-8222-000000000006', '11111111-1111-4111-8111-000000000006',
   'travailleur', 'Berlin',   'Allemagne','2027-03-12', '2027-07-12', 'actif', true,  null,       false, 'Acme GmbH', true),
  ('22222222-2222-4222-8222-000000000007', '11111111-1111-4111-8111-000000000007',
   'voyageur',    'Lisbonne', 'Portugal', '2027-03-18', '2027-05-18', 'actif', true,  null,       false, null, false),
  ('22222222-2222-4222-8222-000000000008', '11111111-1111-4111-8111-000000000008',
   'voyageur',    'Lisbonne', 'Portugal', '2027-04-01', '2027-06-01', 'actif', true,  null,       false, null, false),
  -- Séjour passé d'Alice, archivé : doit rester dans l'historique sans matcher.
  ('22222222-2222-4222-8222-000000000009', '11111111-1111-4111-8111-000000000001',
   'voyageur',    'Berlin',   'Allemagne','2025-09-01', '2025-12-01', 'archive', false, null, false, null, false)
on conflict (id) do nothing;

-- Intérêts : Alice/Bruno/Carla partagent des tags, pour produire des scores > 0.
insert into public.card_hobbies (card_id, hobby_id)
select c.card_id, h.id
from (values
  ('22222222-2222-4222-8222-000000000001', array['Surf','Cafés','Musées','Tech / développement']),
  ('22222222-2222-4222-8222-000000000002', array['Surf','Cafés','Coworking','Course à pied']),
  ('22222222-2222-4222-8222-000000000003', array['Cafés','Musées','Photographie']),
  ('22222222-2222-4222-8222-000000000004', array['Football','Vie nocturne']),
  ('22222222-2222-4222-8222-000000000005', array['Cuisine','Marchés locaux','Histoire locale','Cafés']),
  ('22222222-2222-4222-8222-000000000006', array['Tech / développement','Concerts']),
  ('22222222-2222-4222-8222-000000000007', array['Cafés','Musées']),
  ('22222222-2222-4222-8222-000000000008', array['Surf','Cafés'])
) as c(card_id, noms)
cross join lateral unnest(c.noms) as n(nom)
join public.hobbies h on h.nom = n.nom
on conflict do nothing;

-- Hugo est bloqué par Alice : il ne doit plus apparaître dans ses suggestions (§9.7).
insert into public.blocks (blocker_user_id, blocked_user_id)
values ('11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000008')
on conflict do nothing;

-- Cohorte existante : Alice et Bruno, avec le chat de groupe associé.
insert into public.matching_groups
  (id, ville, pays, type_carte, fenetre_debut, fenetre_fin, description, cree_par_card_id)
values ('33333333-3333-4333-8333-000000000001', 'Lisbonne', 'Portugal', 'voyageur',
        '2027-03-01', '2027-03-31', 'Arrivées à Lisbonne — mars 2027',
        '22222222-2222-4222-8222-000000000001')
on conflict (id) do nothing;

insert into public.matching_group_members (group_id, card_id, statut) values
  ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-000000000001', 'membre'),
  ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-000000000002', 'membre')
on conflict do nothing;

insert into public.conversations (id, type, matching_group_id)
values ('44444444-4444-4444-8444-000000000001', 'groupe', '33333333-3333-4333-8333-000000000001')
on conflict (id) do nothing;

insert into public.conversation_participants (conversation_id, user_id) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000001'),
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000002')
on conflict do nothing;

insert into public.messages (conversation_id, sender_id, contenu) values
  ('44444444-4444-4444-8444-000000000001', '11111111-1111-4111-8111-000000000001',
   'Salut ! J''atterris le 10 mars, quelqu''un pour un café la première semaine ?')
on conflict do nothing;

commit;
