-- Données de référence (non liées à l'activité utilisateur) : liste de hobbies
-- catégorisée (§6.3), fiches ville (§7) et checklist d'installation (§9.5).

insert into public.hobbies (nom, categorie, icone) values
  ('Randonnée', 'Plein air', 'hiking'),
  ('Vélo', 'Plein air', 'bike'),
  ('Course à pied', 'Plein air', 'run'),
  ('Surf', 'Plein air', 'surf'),
  ('Football', 'Sport', 'football'),
  ('Escalade', 'Sport', 'climbing'),
  ('Yoga', 'Sport', 'yoga'),
  ('Salle de sport', 'Sport', 'gym'),
  ('Concerts', 'Culture', 'music'),
  ('Musées', 'Culture', 'museum'),
  ('Cinéma', 'Culture', 'cinema'),
  ('Théâtre', 'Culture', 'theatre'),
  ('Photographie', 'Création', 'camera'),
  ('Dessin', 'Création', 'pencil'),
  ('Musique (pratique)', 'Création', 'guitar'),
  ('Cuisine', 'Gastronomie', 'cooking'),
  ('Restaurants', 'Gastronomie', 'restaurant'),
  ('Cafés', 'Gastronomie', 'coffee'),
  ('Marchés locaux', 'Gastronomie', 'market'),
  ('Jeux de société', 'Social', 'boardgame'),
  ('Jeux vidéo', 'Social', 'gamepad'),
  ('Langues / tandem', 'Social', 'language'),
  ('Bénévolat', 'Social', 'volunteer'),
  ('Startups / entrepreneuriat', 'Professionnel', 'rocket'),
  ('Tech / développement', 'Professionnel', 'code'),
  ('Coworking', 'Professionnel', 'desk'),
  ('Voyages week-end', 'Découverte', 'plane'),
  ('Histoire locale', 'Découverte', 'history'),
  ('Vie nocturne', 'Découverte', 'night'),
  ('Nature / parcs', 'Découverte', 'tree')
on conflict (categorie, nom) do nothing;


insert into public.city_guides
  (ville, pays, systeme_transport_nom, transport_description, apps_recommandees, numeros_urgence)
values
  ('Lisbonne', 'Portugal', 'Carris / Metro de Lisboa',
   'Métro (4 lignes), bus et tramways Carris. Carte rechargeable Navegante à acheter en station.',
   '[{"nom":"Carris/Metro","categorie":"transport"},{"nom":"Bolt","categorie":"vtc"},
     {"nom":"Revolut","categorie":"banque"},{"nom":"Uber Eats","categorie":"livraison"}]'::jsonb,
   '{"general":"112","police":"112","pompiers":"112","medical":"112"}'::jsonb),
  ('Berlin', 'Allemagne', 'BVG',
   'U-Bahn, S-Bahn, tram et bus couverts par un même titre. Zones AB suffisantes en ville.',
   '[{"nom":"BVG Fahrinfo","categorie":"transport"},{"nom":"FreeNow","categorie":"vtc"},
     {"nom":"N26","categorie":"banque"},{"nom":"Lieferando","categorie":"livraison"}]'::jsonb,
   '{"general":"112","police":"110","pompiers":"112","medical":"112"}'::jsonb),
  ('Montréal', 'Canada', 'STM',
   'Métro (4 lignes) et bus STM. Carte OPUS rechargeable.',
   '[{"nom":"Chrono STM","categorie":"transport"},{"nom":"Uber","categorie":"vtc"},
     {"nom":"Wealthsimple","categorie":"banque"},{"nom":"DoorDash","categorie":"livraison"}]'::jsonb,
   '{"general":"911","police":"911","pompiers":"911","medical":"911"}'::jsonb)
on conflict (ville, pays) do nothing;


insert into public.points_of_interet (city_guide_id, nom, type, description, lien)
select g.id, v.nom, v.type, v.description, null
from public.city_guides g
join (values
  ('Lisbonne', 'Portugal', 'Tour de Belém',           'monument', 'Tour manuéline du XVIe siècle, en bord de Tage.'),
  ('Lisbonne', 'Portugal', 'Musée Calouste Gulbenkian','musee',    'Collection d''art ancien et moderne, grand parc attenant.'),
  ('Lisbonne', 'Portugal', 'Miradouro da Senhora do Monte', 'point_de_vue', 'Le plus haut belvédère de la ville.'),
  ('Berlin',   'Allemagne','Porte de Brandebourg',     'monument', 'Symbole de la réunification, au bout de Unter den Linden.'),
  ('Berlin',   'Allemagne','Museumsinsel',             'musee',    'Île aux musées, cinq institutions classées UNESCO.'),
  ('Montréal', 'Canada',   'Mont Royal',               'parc',     'Parc urbain surplombant la ville, belvédère Kondiaronk.'),
  ('Montréal', 'Canada',   'Musée des beaux-arts',     'musee',    'Plus grand musée d''art du Québec.')
) as v(ville, pays, nom, type, description) on v.ville = g.ville and v.pays = g.pays;


insert into public.ephemeral_events
  (city_guide_id, titre, type, date_debut, date_fin, description, source, statut_moderation)
select g.id, v.titre, v.type, v.date_debut, v.date_fin, v.description, 'agrege', 'approuve'
from public.city_guides g
join (values
  ('Lisbonne', 'Portugal', 'Festas de Lisboa',        'festival', date '2027-06-01', date '2027-06-30', 'Un mois de fêtes de quartier, sardines et marches populaires.'),
  ('Lisbonne', 'Portugal', 'Exposition photo au MAAT','expo',     date '2027-03-05', date '2027-05-20', 'Exposition temporaire au musée d''art, architecture et technologie.'),
  ('Berlin',   'Allemagne','Berlinale',               'festival', date '2027-02-11', date '2027-02-21', 'Festival international du film de Berlin.'),
  ('Montréal', 'Canada',   'Festival de jazz',        'festival', date '2027-06-25', date '2027-07-04', 'Festival international de jazz de Montréal.')
) as v(ville, pays, titre, type, date_debut, date_fin, description) on v.ville = g.ville and v.pays = g.pays;


-- Checklist : ville NULL = item valable partout dans le pays.
insert into public.checklist_items (pays, ville, titre, description, ordre) values
  ('Portugal', null, 'Obtenir un NIF',            'Numéro fiscal portugais, exigé pour un bail, une banque et un abonnement.', 1),
  ('Portugal', null, 'Ouvrir un compte bancaire', 'Un IBAN local facilite loyer et prélèvements.', 2),
  ('Portugal', null, 'Carte SIM locale',          'MEO, NOS ou Vodafone — prépayé disponible sans NIF.', 3),
  ('Portugal', 'Lisbonne', 'Carte Navegante',     'Carte de transport rechargeable, à faire en station de métro.', 4),
  ('Portugal', null, 'Logement temporaire',       'Prévoir 2 à 4 semaines avant de signer un bail longue durée.', 5),
  ('Allemagne', null, 'Anmeldung',                'Déclaration de domicile en Bürgeramt, dans les 14 jours suivant l''arrivée.', 1),
  ('Allemagne', null, 'Compte bancaire',          'Nécessaire pour le loyer et le contrat de travail.', 2),
  ('Allemagne', null, 'Assurance santé',          'Obligatoire — publique (TK, AOK) ou privée.', 3),
  ('Allemagne', null, 'Carte SIM locale',         'Telekom, Vodafone, O2 — activation avec pièce d''identité.', 4),
  ('Allemagne', 'Berlin', 'Abonnement BVG',       'Abonnement mensuel zones AB.', 5),
  ('Canada', null, 'Numéro d''assurance sociale', 'NAS obligatoire pour travailler, à demander à Service Canada.', 1),
  ('Canada', null, 'Compte bancaire',             'Desjardins, RBC, BMO — ouverture possible dès l''arrivée.', 2),
  ('Canada', null, 'Assurance santé provinciale', 'RAMQ au Québec, délai de carence possible.', 3),
  ('Canada', null, 'Carte SIM locale',            'Fizz, Koodo, Public Mobile.', 4),
  ('Canada', 'Montréal', 'Carte OPUS',            'Carte de transport STM, photo requise pour le tarif réduit.', 5);
