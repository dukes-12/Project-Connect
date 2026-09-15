-- Messagerie (§9.6) et sécurité des échanges (§9.7).
-- La table `conversations` est absente de la spec §13 alors que `messages`
-- référence un conversation_id : elle est introduite ici, avec le lien optionnel
-- vers le groupe de matching pour le chat de cohorte.

create table public.conversations (
  id                uuid primary key default gen_random_uuid(),
  type              public.type_conversation not null,
  matching_group_id uuid unique references public.matching_groups (id) on delete cascade,
  created_at        timestamptz not null default now(),
  constraint conv_groupe_a_un_groupe check (
    (type = 'groupe') = (matching_group_id is not null)
  )
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conv_participants_user_id on public.conversation_participants (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.users (id) on delete cascade,
  contenu         text not null,
  created_at      timestamptz not null default now(),
  constraint messages_contenu_non_vide check (length(btrim(contenu)) > 0)
);
create index messages_conversation on public.messages (conversation_id, created_at desc);


-- Blocage : action immédiate et autonome de l'utilisateur (§9.7).
create table public.blocks (
  id               uuid primary key default gen_random_uuid(),
  blocker_user_id  uuid not null references public.users (id) on delete cascade,
  blocked_user_id  uuid not null references public.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  constraint blocks_pas_soi_meme check (blocker_user_id <> blocked_user_id),
  unique (blocker_user_id, blocked_user_id)
);
create index blocks_blocked_user on public.blocks (blocked_user_id);

-- Signalement : passe par la file de modération (§9.7). Les données de la
-- conversation ne sont jamais supprimées côté base pour garder la trace.
create table public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_user_id  uuid not null references public.users (id) on delete cascade,
  reported_user_id  uuid not null references public.users (id) on delete cascade,
  conversation_id   uuid references public.conversations (id) on delete set null,
  message_id        uuid references public.messages (id) on delete set null,
  motif             public.motif_signalement not null,
  description       text,
  statut            public.statut_signalement not null default 'en_attente',
  action_prise      text,
  traite_par        uuid references public.users (id) on delete set null,
  traite_at         timestamptz,
  created_at        timestamptz not null default now(),
  constraint reports_pas_soi_meme check (reporter_user_id <> reported_user_id)
);
-- Seuil de signalements convergents : compter les signalements ouverts par profil (§9.7).
create index reports_profil_signale on public.reports (reported_user_id, statut);
create index reports_file_moderation on public.reports (created_at) where statut <> 'traite';


-- Y a-t-il un blocage dans un sens ou dans l'autre entre deux comptes ?
-- SECURITY DEFINER : appelée depuis les policies RLS et les vues, doit voir
-- toute la table blocks quel que soit l'appelant.
create or replace function public.est_bloque(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_user_id = a and blocked_user_id = b)
       or (blocker_user_id = b and blocked_user_id = a)
  );
$$;

-- Helpers d'appartenance, en SECURITY DEFINER pour éviter la récursion RLS
-- (une policy sur conversation_participants qui lirait conversation_participants).
create or replace function public.est_participant(conv_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = uid
  );
$$;

create or replace function public.est_membre_groupe(grp_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.matching_group_members m
    join public.profile_cards c on c.id = m.card_id
    where m.group_id = grp_id and c.user_id = uid and m.statut = 'membre'
  );
$$;

create or replace function public.possede_carte(carte_id uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profile_cards where id = carte_id and user_id = uid
  );
$$;
