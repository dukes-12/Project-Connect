-- Chat 1:1 (§9.6) : ouvrir la conversation quand la mise en relation aboutit.
--
-- Il manquait le pendant de `membres_sync_conversation` : le chat de cohorte
-- s'ouvrait tout seul, mais un match individuel accepté (§8.2) ou une demande
-- de mise en relation acceptée avec un local (§8.3) ne donnait aucun moyen de
-- se parler. Même choix qu'en §8.1 : en trigger, pour que tout chemin
-- d'acceptation ouvre le chat.

-- Une conversation directe garde le lien vers ce qui l'a créée : utile pour
-- retrouver le contexte, et pour garantir qu'on n'en ouvre pas deux.
alter table public.conversations
  add column individual_match_id uuid unique
    references public.individual_matches (id) on delete cascade,
  add column connection_id uuid unique
    references public.connections (id) on delete cascade;

alter table public.conversations drop constraint conv_groupe_a_un_groupe;
alter table public.conversations add constraint conv_une_seule_origine check (
  (matching_group_id is not null)::int
  + (individual_match_id is not null)::int
  + (connection_id is not null)::int = 1
  and (type = 'groupe') = (matching_group_id is not null)
);


-- Ouvre la conversation et y place les deux participants. Idempotent : le
-- `on conflict` absorbe deux passages concurrents sur la même origine.
create or replace function app_private.ouvrir_conversation_directe(
  colonne_origine text,
  origine_id uuid,
  utilisateur_a uuid,
  utilisateur_b uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
begin
  if utilisateur_a is null or utilisateur_b is null or utilisateur_a = utilisateur_b then
    return null;
  end if;

  execute format(
    'insert into public.conversations (type, %I) values (''direct'', $1)
       on conflict (%I) do nothing', colonne_origine, colonne_origine)
  using origine_id;

  execute format('select id from public.conversations where %I = $1', colonne_origine)
  into conv_id using origine_id;

  if conv_id is null then
    return null;
  end if;

  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, utilisateur_a), (conv_id, utilisateur_b)
  on conflict do nothing;

  return conv_id;
end;
$$;


-- §8.2 : le match passe à « accepte ». `statut` étant une colonne générée, on
-- ne peut la lire qu'en AFTER trigger — elle n'est pas encore calculée en BEFORE.
create or replace function app_private.tg_conversation_sur_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ua uuid;
  ub uuid;
begin
  if new.statut <> 'accepte' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'accepte' then return new; end if;

  select pc.user_id into ua from public.profile_cards pc where pc.id = new.card_id_a;
  select pc.user_id into ub from public.profile_cards pc where pc.id = new.card_id_b;

  perform app_private.ouvrir_conversation_directe('individual_match_id', new.id, ua, ub);
  return new;
end;
$$;

create trigger matches_ouvrent_conversation
  after insert or update on public.individual_matches
  for each row execute function app_private.tg_conversation_sur_match();


-- §8.3 : le local accepte la demande de mise en relation.
create or replace function app_private.tg_conversation_sur_connexion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.statut <> 'accepte' then return new; end if;
  if tg_op = 'UPDATE' and old.statut = 'accepte' then return new; end if;

  perform app_private.ouvrir_conversation_directe(
    'connection_id', new.id, new.demandeur_user_id, new.destinataire_user_id);
  return new;
end;
$$;

create trigger connexions_ouvrent_conversation
  after insert or update on public.connections
  for each row execute function app_private.tg_conversation_sur_connexion();
