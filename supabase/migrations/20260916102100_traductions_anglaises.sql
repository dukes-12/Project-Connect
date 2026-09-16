-- Traductions anglaises des contenus de référence (§14 : MVP en fr/en).

update public.hobbies h
   set traductions = jsonb_build_object('en', jsonb_build_object('nom', t.nom_en, 'categorie', t.cat_en))
  from (values
    ('Randonnée','Hiking','Outdoors'), ('Vélo','Cycling','Outdoors'),
    ('Course à pied','Running','Outdoors'), ('Surf','Surfing','Outdoors'),
    ('Football','Football','Sport'), ('Escalade','Climbing','Sport'),
    ('Yoga','Yoga','Sport'), ('Salle de sport','Gym','Sport'),
    ('Concerts','Live music','Culture'), ('Musées','Museums','Culture'),
    ('Cinéma','Cinema','Culture'), ('Théâtre','Theatre','Culture'),
    ('Photographie','Photography','Creative'), ('Dessin','Drawing','Creative'),
    ('Musique (pratique)','Playing music','Creative'),
    ('Cuisine','Cooking','Food & drink'), ('Restaurants','Restaurants','Food & drink'),
    ('Cafés','Coffee shops','Food & drink'), ('Marchés locaux','Local markets','Food & drink'),
    ('Jeux de société','Board games','Social'), ('Jeux vidéo','Video games','Social'),
    ('Langues / tandem','Language exchange','Social'), ('Bénévolat','Volunteering','Social'),
    ('Startups / entrepreneuriat','Startups','Professional'),
    ('Tech / développement','Tech & coding','Professional'),
    ('Coworking','Coworking','Professional'),
    ('Voyages week-end','Weekend trips','Exploring'),
    ('Histoire locale','Local history','Exploring'),
    ('Vie nocturne','Nightlife','Exploring'), ('Nature / parcs','Nature & parks','Exploring')
  ) as t(nom_fr, nom_en, cat_en)
 where h.nom = t.nom_fr;

update public.city_guides g
   set traductions = jsonb_build_object('en',
         jsonb_build_object('transport_description', t.desc_en))
  from (values
    ('Lisbonne','Portugal','Metro (4 lines), Carris buses and trams. Buy a rechargeable Navegante card at any metro station.'),
    ('Berlin','Allemagne','U-Bahn, S-Bahn, tram and bus all share one ticket. Zones AB cover the city.'),
    ('Montréal','Canada','STM metro (4 lines) and buses. Rechargeable OPUS card.')
  ) as t(ville, pays, desc_en)
 where g.ville = t.ville and g.pays = t.pays;

update public.points_of_interet p
   set traductions = jsonb_build_object('en',
         jsonb_build_object('nom', t.nom_en, 'description', t.desc_en))
  from (values
    ('Tour de Belém','Belém Tower','16th-century Manueline tower on the Tagus riverfront.'),
    ('Musée Calouste Gulbenkian','Calouste Gulbenkian Museum','Ancient and modern art, with a large park attached.'),
    ('Miradouro da Senhora do Monte','Miradouro da Senhora do Monte','The highest viewpoint in the city.'),
    ('Porte de Brandebourg','Brandenburg Gate','Symbol of reunification, at the end of Unter den Linden.'),
    ('Museumsinsel','Museum Island','Five UNESCO-listed institutions on one island.'),
    ('Mont Royal','Mount Royal','Hilltop city park with the Kondiaronk lookout.'),
    ('Musée des beaux-arts','Museum of Fine Arts','The largest art museum in Quebec.')
  ) as t(nom_fr, nom_en, desc_en)
 where p.nom = t.nom_fr;

update public.ephemeral_events e
   set traductions = jsonb_build_object('en',
         jsonb_build_object('titre', t.titre_en, 'description', t.desc_en))
  from (values
    ('Festas de Lisboa','Festas de Lisboa','A month of neighbourhood street parties, grilled sardines and parades.'),
    ('Exposition photo au MAAT','Photography exhibition at MAAT','Temporary show at the Museum of Art, Architecture and Technology.'),
    ('Berlinale','Berlinale','Berlin International Film Festival.'),
    ('Festival de jazz','Jazz Festival','Montreal International Jazz Festival.')
  ) as t(titre_fr, titre_en, desc_en)
 where e.titre = t.titre_fr;

update public.checklist_items c
   set traductions = jsonb_build_object('en',
         jsonb_build_object('titre', t.titre_en, 'description', t.desc_en))
  from (values
    ('Obtenir un NIF','Get a NIF','Portuguese tax number, required for a lease, a bank account and most contracts.'),
    ('Ouvrir un compte bancaire','Open a bank account','A local IBAN makes rent and direct debits easier.'),
    ('Carte SIM locale','Local SIM card','MEO, NOS or Vodafone — prepaid available without a NIF.'),
    ('Carte Navegante','Navegante card','Rechargeable transport card, issued at metro stations.'),
    ('Logement temporaire','Temporary housing','Allow 2 to 4 weeks before signing a long-term lease.'),
    ('Anmeldung','Anmeldung','Register your address at a Bürgeramt within 14 days of arriving.'),
    ('Compte bancaire','Bank account','Required for rent and for an employment contract.'),
    ('Assurance santé','Health insurance','Mandatory — public (TK, AOK) or private.'),
    ('Abonnement BVG','BVG travel pass','Monthly pass, zones AB.'),
    ('Numéro d''assurance sociale','Social Insurance Number','SIN is required to work; apply at Service Canada.'),
    ('Assurance santé provinciale','Provincial health insurance','RAMQ in Quebec; a waiting period may apply.'),
    ('Carte OPUS','OPUS card','STM transport card; a photo is required for the reduced fare.')
  ) as t(titre_fr, titre_en, desc_en)
 where c.titre = t.titre_fr;

-- Les items « Carte SIM locale » et « Compte bancaire » existent pour plusieurs
-- pays : la jointure sur le titre les met tous à jour, ce qui est voulu.
