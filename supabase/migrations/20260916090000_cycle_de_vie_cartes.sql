-- Cycle de vie des cartes (§6.2) et conversation de cohorte (§8.1.4).
--
-- Deux automatismes qui n'ont pas à vivre dans le code applicatif :
--   1. rejoindre un groupe de matching = rejoindre son chat, toujours ;
--   2. une carte dont la date de fin est passée s'archive.

-- ---------------------------------------------------------------------------
-- 1. Le chat de groupe suit l'appartenance au groupe.
--
-- En trigger plutôt qu'en code applicatif : quel que soit le chemin
-- d'insertion (edge function, back-office, migration), un membre du groupe est
-- toujours participant de la conversation, et un seul chat existe par groupe.
create or replace function app_private.tg_sync_conversation_groupe()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conv_id uuid;
  uid     uuid;
begin
  if tg_op = 'INSERT' then
    -- on conflict plutôt que select-puis-insert : deux arrivées simultanées
    -- dans un groupe neuf ne doivent pas créer deux conversations.
    insert into public.conversations (type, matching_group_id)
    values ('groupe', new.group_id)
    on conflict (matching_group_id) do nothing;

    select c.id into conv_id
      from public.conversations c where c.matching_group_id = new.group_id;
    select pc.user_id into uid
      from public.profile_cards pc where pc.id = new.card_id;

    if conv_id is not null and uid is not null then
      insert into public.conversation_participants (conversation_id, user_id)
      values (conv_id, uid)
      on conflict do nothing;
    end if;
    return new;
  end if;

  -- DELETE : ne retirer du chat que si l'utilisateur n'a plus aucune autre
  -- carte dans ce groupe (il peut en avoir deux : Voyageur puis Travailleur).
  select c.id into conv_id
    from public.conversations c where c.matching_group_id = old.group_id;
  select pc.user_id into uid
    from public.profile_cards pc where pc.id = old.card_id;

  if conv_id is not null and uid is not null and not exists (
    select 1
    from public.matching_group_members m
    join public.profile_cards pc on pc.id = m.card_id
    where m.group_id = old.group_id and pc.user_id = uid and m.card_id <> old.card_id
  ) then
    delete from public.conversation_participants
    where conversation_id = conv_id and user_id = uid;
  end if;
  return old;
end;
$$;

create trigger membres_sync_conversation
  after insert or delete on public.matching_group_members
  for each row execute function app_private.tg_sync_conversation_groupe();


-- ---------------------------------------------------------------------------
-- 2. Archivage des cartes dont le séjour est terminé (§6.2).
--
-- La carte reste consultable dans l'historique du profil, mais sort du matching
-- et des vues publiques (qui filtrent sur statut = 'actif').
create or replace function public.archiver_cartes_expirees()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  nb int;
begin
  update public.profile_cards
     set statut = 'archive', est_principale = false
   where type <> 'local'
     and statut <> 'archive'
     and date_fin is not null
     and date_fin < current_date;
  get diagnostics nb = row_count;
  return nb;
end;
$$;

comment on function public.archiver_cartes_expirees is
  'À appeler quotidiennement (pg_cron ou edge function planifiée). Retourne le nombre de cartes archivées.';

-- Appelable uniquement par le service_role : ce n'est pas une action utilisateur.
revoke all on function public.archiver_cartes_expirees() from public, anon, authenticated;
grant execute on function public.archiver_cartes_expirees() to service_role;

-- L'archivage libère le flag est_principale ; l'index unique partiel
-- cards_une_seule_principale reste satisfait.
