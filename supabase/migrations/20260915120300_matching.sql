-- Matching de groupe (§8.1), matching individuel (§8.2), mise en relation
-- avec les locaux (§8.3). La logique applicative vit dans une edge function ;
-- ce schéma fournit les structures, les contraintes d'intégrité et les
-- fonctions de recherche de candidats (testables isolément, §16).

create table public.matching_groups (
  id            uuid primary key default gen_random_uuid(),
  ville         text not null,
  pays          text not null,
  type_carte    public.type_carte not null,
  fenetre_debut date not null,
  fenetre_fin   date not null,
  description   text not null,       -- générée à la création, éditable par les membres (§8.1)
  cree_par_card_id uuid references public.profile_cards (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  fenetre daterange generated always as (daterange(fenetre_debut, fenetre_fin, '[]')) stored,

  constraint groupes_fenetre_ordonnee check (fenetre_debut <= fenetre_fin),
  constraint groupes_pas_de_local check (type_carte <> 'local')
);
comment on table public.matching_groups is
  'Cohorte d''arrivée : même ville, même type de carte, fenêtre de dates qui se chevauchent (§8.1). Le groupe est aussi le chat de groupe, via conversations.matching_group_id.';

create trigger matching_groups_set_updated_at
  before update on public.matching_groups
  for each row execute function public.tg_set_updated_at();

-- Recherche de groupes compatibles : ville + type + chevauchement de fenêtre.
create index groupes_matching_gist
  on public.matching_groups using gist (ville, type_carte, fenetre);


create table public.matching_group_members (
  group_id  uuid not null references public.matching_groups (id) on delete cascade,
  card_id   uuid not null references public.profile_cards (id) on delete cascade,
  statut    public.statut_membre_groupe not null default 'membre',
  joined_at timestamptz not null default now(),
  primary key (group_id, card_id)
);
create index group_members_card_id on public.matching_group_members (card_id);


-- Matching individuel. La paire est ordonnée (card_id_a < card_id_b) pour
-- garantir l'unicité ; chaque côté garde sa propre décision et le statut global
-- en est dérivé.
create table public.individual_matches (
  id         uuid primary key default gen_random_uuid(),
  card_id_a  uuid not null references public.profile_cards (id) on delete cascade,
  card_id_b  uuid not null references public.profile_cards (id) on delete cascade,
  decision_a public.decision_match not null default 'en_attente',
  decision_b public.decision_match not null default 'en_attente',
  score      numeric(5,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  statut public.statut_match generated always as (
    case
      when decision_a = 'refuse' or decision_b = 'refuse' then 'refuse'::public.statut_match
      when decision_a = 'accepte' and decision_b = 'accepte' then 'accepte'::public.statut_match
      else 'propose'::public.statut_match
    end
  ) stored,

  constraint matches_paire_ordonnee check (card_id_a < card_id_b),
  constraint matches_score_normalise check (score between 0 and 1),
  unique (card_id_a, card_id_b)
);
comment on table public.individual_matches is
  'Une proposition par paire de cartes. La connexion (et donc la conversation) ne s''ouvre que si les deux côtés acceptent (§8.2).';

create trigger individual_matches_set_updated_at
  before update on public.individual_matches
  for each row execute function public.tg_set_updated_at();

create index matches_card_b on public.individual_matches (card_id_b);
create index matches_en_attente_a on public.individual_matches (card_id_a) where decision_a = 'en_attente';
create index matches_en_attente_b on public.individual_matches (card_id_b) where decision_b = 'en_attente';


-- Demandes de mise en relation arrivant ↔ local (§8.3). Contrairement au
-- matching individuel, la direction compte : quelqu'un demande, l'autre répond.
create table public.connections (
  id                   uuid primary key default gen_random_uuid(),
  demandeur_user_id    uuid not null references public.users (id) on delete cascade,
  destinataire_user_id uuid not null references public.users (id) on delete cascade,
  message_intro        text,
  statut               public.statut_connexion not null default 'en_attente',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint connexions_pas_soi_meme check (demandeur_user_id <> destinataire_user_id),
  unique (demandeur_user_id, destinataire_user_id)
);

create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.tg_set_updated_at();

create index connexions_destinataire on public.connections (destinataire_user_id, statut);
