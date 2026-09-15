-- Fiches de référence par ville (§7), soumission communautaire d'événements (§7.1)
-- et checklist d'installation (§9.5). Module volontairement indépendant du reste :
-- alimentable par seeds/mocks sans dépendre d'une intégration API externe (§16).

create table public.city_guides (
  id                     uuid primary key default gen_random_uuid(),
  ville                  text not null,
  pays                   text not null,
  ville_place_id         text,
  systeme_transport_nom  text,
  transport_description  text,
  apps_recommandees      jsonb not null default '[]'::jsonb,
  numeros_urgence        jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (ville, pays),
  constraint city_guides_apps_tableau check (jsonb_typeof(apps_recommandees) = 'array'),
  constraint city_guides_urgences_objet check (jsonb_typeof(numeros_urgence) = 'object')
);
comment on column public.city_guides.apps_recommandees is
  'Tableau d''objets {nom, categorie, url_ios, url_android}.';
comment on column public.city_guides.numeros_urgence is
  'Objet {police, pompiers, medical, general}.';

create trigger city_guides_set_updated_at
  before update on public.city_guides
  for each row execute function public.tg_set_updated_at();


-- Points d'intérêt permanents (§7). Nom conservé tel quel depuis la spec §13.
create table public.points_of_interet (
  id            uuid primary key default gen_random_uuid(),
  city_guide_id uuid not null references public.city_guides (id) on delete cascade,
  nom           text not null,
  type          text not null,
  description   text,
  lien          text,
  created_at    timestamptz not null default now()
);
create index poi_city_guide_id on public.points_of_interet (city_guide_id);


-- Événements éphémères (§7, §7.1) : agrégés par API ou soumis par les utilisateurs.
create table public.ephemeral_events (
  id                 uuid primary key default gen_random_uuid(),
  city_guide_id      uuid not null references public.city_guides (id) on delete cascade,
  titre              text not null,
  type               text not null,
  date_debut         date not null,
  date_fin           date,
  lien               text,
  description        text,
  source             public.source_evenement not null,
  soumis_par_user_id uuid references public.users (id) on delete set null,
  statut_moderation  public.statut_moderation not null default 'en_attente',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  periode daterange generated always as (daterange(date_debut, date_fin, '[]')) stored,

  constraint events_dates_ordonnees check (date_fin is null or date_debut <= date_fin),
  -- Traçabilité de l'auteur pour gérer les soumissions abusives (§7.1).
  constraint events_auteur_si_utilisateur check (
    source <> 'utilisateur' or soumis_par_user_id is not null
  )
);

create trigger ephemeral_events_set_updated_at
  before update on public.ephemeral_events
  for each row execute function public.tg_set_updated_at();

-- Recherche « événements de ma ville pendant mon séjour » : ville + chevauchement.
create index events_ville_periode_gist
  on public.ephemeral_events using gist (city_guide_id, periode)
  where statut_moderation = 'approuve';

create index events_file_moderation
  on public.ephemeral_events (created_at)
  where statut_moderation = 'en_attente';

create index events_soumis_par on public.ephemeral_events (soumis_par_user_id);

-- Aide à la détection de doublon avant soumission (§7.1) : titre + ville + dates proches.
create index events_titre_trgm on public.ephemeral_events (city_guide_id, lower(titre), date_debut);


create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  pays        text not null,
  ville       text,                 -- null = item valable pour tout le pays
  titre       text not null,
  description text,
  ordre       int not null default 0,
  created_at  timestamptz not null default now()
);
comment on column public.checklist_items.ville is
  'Null = item applicable à toutes les villes du pays (banque, SIM…). Renseigné = item spécifique à la ville.';
create index checklist_items_pays_ville on public.checklist_items (pays, ville, ordre);

create table public.user_checklist_status (
  user_id            uuid not null references public.users (id) on delete cascade,
  checklist_item_id  uuid not null references public.checklist_items (id) on delete cascade,
  card_id            uuid not null references public.profile_cards (id) on delete cascade,
  statut             public.statut_checklist not null default 'a_faire',
  updated_at         timestamptz not null default now(),
  primary key (user_id, checklist_item_id, card_id)
);
comment on column public.user_checklist_status.card_id is
  'Rattache l''avancement au séjour concerné : un même item est refait à chaque nouvelle installation.';

create trigger user_checklist_set_updated_at
  before update on public.user_checklist_status
  for each row execute function public.tg_set_updated_at();
