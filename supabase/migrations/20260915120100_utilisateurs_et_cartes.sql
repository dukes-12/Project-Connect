-- Profil global (§6.1) + système de cartes (§6.2) + hobbies (§6.3).

create table public.users (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text not null,
  langues             text[] not null default '{}',
  bio                 text,
  photo_url           text not null,                 -- §6.1 : photo obligatoire
  date_naissance      date not null,                 -- l'âge en dérive, toujours visible
  age_min_prefere     int  not null,
  age_max_prefere     int  not null,

  -- Donnée masquable MAIS utilisable en interne pour le matching (§6.1).
  sexe                public.type_sexe not null default 'non_precise',
  sexe_visible        boolean not null default true,

  -- Données RGPD art. 9 : purement déclaratives, jamais utilisées en matching (§6.1, §14).
  religion            text,
  religion_visible    boolean not null default false,
  nationalites        jsonb not null default '[]'::jsonb,
  nationalites_visible boolean not null default false,
  origines            jsonb not null default '[]'::jsonb,
  origines_visible    boolean not null default false,
  -- Consentement explicite et distinct à la collecte des données sensibles (§14).
  consentement_sensibles_at timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint users_age_prefere_coherent check (age_min_prefere between 16 and 120
                                           and age_max_prefere between 16 and 120
                                           and age_min_prefere <= age_max_prefere),
  constraint users_majeur check (date_naissance <= current_date - interval '16 years'),
  constraint users_nationalites_tableau check (jsonb_typeof(nationalites) = 'array'),
  constraint users_origines_tableau check (jsonb_typeof(origines) = 'array'),
  -- Pas de donnée sensible stockée sans consentement enregistré.
  constraint users_consentement_requis check (
    consentement_sensibles_at is not null
    or (religion is null and nationalites = '[]'::jsonb and origines = '[]'::jsonb)
  )
);
comment on table public.users is
  'Profil global, commun à toutes les cartes. Étend auth.users. Les colonnes *_visible ne pilotent que l''affichage : le masquage est appliqué par les vues v_* et non par RLS (RLS est ligne-à-ligne, pas colonne-à-colonne).';

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.tg_set_updated_at();

create or replace function public.age_utilisateur(date_naissance date)
returns int
language sql
immutable
set search_path = ''
as $$ select date_part('year', age(date_naissance))::int $$;


create table public.profile_cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users (id) on delete cascade,
  type              public.type_carte not null,
  ville             text not null,
  pays              text not null,
  ville_place_id    text,                       -- normalisation Google Places (§12)
  date_debut        date,
  date_fin          date,
  statut            public.statut_carte not null default 'actif',
  -- Carte mise en avant dans le fil de l'utilisateur (§6.2). Une seule à la fois.
  est_principale    boolean not null default false,
  quartier_precis   text,
  quartier_visible  boolean not null default false,
  entreprise        text,
  entreprise_visible boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- daterange généré : borne haute infinie si le séjour est ouvert (date_fin nulle).
  -- '[)' = borne basse incluse, borne haute exclue.
  sejour daterange generated always as (
    case when type = 'local' then null
         else daterange(date_debut, date_fin, '[)')
    end
  ) stored,

  constraint cards_local_sans_dates check (
    type <> 'local' or (date_debut is null and date_fin is null)
  ),
  constraint cards_sejour_a_une_date_debut check (
    type = 'local' or date_debut is not null
  ),
  constraint cards_dates_ordonnees check (
    date_fin is null or date_debut is null or date_debut < date_fin
  ),
  constraint cards_entreprise_reservee_travailleur check (
    type = 'travailleur' or entreprise is null
  )
);
comment on table public.profile_cards is
  'Une situation géographique/temporelle du compte. Chaque nouveau projet de déplacement crée une NOUVELLE carte (§6.2), ce qui relance un cycle de matching indépendant.';
comment on column public.profile_cards.est_principale is
  'Carte affichée en priorité dans le fil de l''utilisateur. Distincte de statut : plusieurs cartes peuvent être actives simultanément (une Local + un séjour), une seule est principale.';

create trigger cards_set_updated_at
  before update on public.profile_cards
  for each row execute function public.tg_set_updated_at();

-- Une seule carte Local par ville et par compte.
create unique index cards_une_local_par_ville
  on public.profile_cards (user_id, ville, pays)
  where type = 'local';

-- Une seule carte principale par compte.
create unique index cards_une_seule_principale
  on public.profile_cards (user_id)
  where est_principale;

-- Index de matching : ville + chevauchement de dates en une seule recherche GIST.
create index cards_matching_gist
  on public.profile_cards using gist (ville, type, sejour)
  where statut = 'actif' and type <> 'local';

create index cards_locaux_actifs
  on public.profile_cards (ville, pays)
  where statut = 'actif' and type = 'local';

create index cards_user_id on public.profile_cards (user_id);


create table public.hobbies (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null,
  categorie text not null,
  icone     text,
  unique (categorie, nom)
);

create table public.card_hobbies (
  card_id  uuid not null references public.profile_cards (id) on delete cascade,
  hobby_id uuid not null references public.hobbies (id) on delete cascade,
  primary key (card_id, hobby_id)
);
comment on table public.card_hobbies is
  'Les intérêts sont rattachés à la carte et non au compte (§6.3) : ils varient selon le contexte du séjour.';

create index card_hobbies_hobby_id on public.card_hobbies (hobby_id);
