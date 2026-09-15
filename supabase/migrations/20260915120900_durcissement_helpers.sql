-- Durcissement remonté par l'advisor Supabase.
--
-- 1) Les helpers SECURITY DEFINER (est_bloque, est_participant, est_membre_groupe,
--    possede_carte) étaient dans `public`, donc exposés par PostgREST en
--    /rest/v1/rpc/... y compris à `anon`. Même sans lire les tables, un appelant
--    pouvait sonder « est-ce que A a bloqué B ? » ou « est-ce que cette carte
--    appartient à cet utilisateur ? ». Ils passent dans un schéma privé
--    `app_private`, non exposé par l'API REST : les policies et les vues peuvent
--    toujours les appeler, personne ne peut plus les appeler de l'extérieur.
--
-- 2) btree_gist est déplacé hors de `public` vers `extensions`.
--
-- Restent volontairement appelables par `authenticated` (ce sont des points
-- d'entrée applicatifs, chacun avec son propre contrôle d'accès interne) :
-- repondre_match, groupes_compatibles, candidats_individuels.

alter extension btree_gist set schema extensions;

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated, service_role;

create or replace function app_private.est_bloque(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_user_id = a and blocked_user_id = b)
       or (blocker_user_id = b and blocked_user_id = a)
  );
$$;

create or replace function app_private.est_participant(conv_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = uid
  );
$$;

create or replace function app_private.est_membre_groupe(grp_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.matching_group_members m
    join public.profile_cards c on c.id = m.card_id
    where m.group_id = grp_id and c.user_id = uid and m.statut = 'membre'
  );
$$;

create or replace function app_private.possede_carte(carte_id uuid, uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profile_cards where id = carte_id and user_id = uid
  );
$$;

revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to authenticated, service_role;


-- ------------------------------------------------- vues : bascule vers app_private
create or replace view public.v_profils_publics
with (security_invoker = false) as
select
  u.id,
  u.photo_url,
  u.bio,
  u.langues,
  public.age_utilisateur(u.date_naissance) as age,
  case when u.sexe_visible         then u.sexe          end as sexe,
  case when u.religion_visible     then u.religion      end as religion,
  case when u.nationalites_visible then u.nationalites  end as nationalites,
  case when u.origines_visible     then u.origines      end as origines
from public.users u
where not app_private.est_bloque(u.id, auth.uid());


-- --------------------------------------------- policies : bascule vers app_private
drop policy card_hobbies_gere_les_siens on public.card_hobbies;
create policy card_hobbies_gere_les_siens on public.card_hobbies
  for all to authenticated
  using (app_private.possede_carte(card_id, (select auth.uid())))
  with check (app_private.possede_carte(card_id, (select auth.uid())));

drop policy groupes_creation on public.matching_groups;
create policy groupes_creation on public.matching_groups
  for insert to authenticated
  with check (cree_par_card_id is null
              or app_private.possede_carte(cree_par_card_id, (select auth.uid())));

drop policy groupes_edition_par_membres on public.matching_groups;
create policy groupes_edition_par_membres on public.matching_groups
  for update to authenticated
  using (app_private.est_membre_groupe(id, (select auth.uid())))
  with check (app_private.est_membre_groupe(id, (select auth.uid())));

drop policy membres_lecture_si_membre on public.matching_group_members;
create policy membres_lecture_si_membre on public.matching_group_members
  for select to authenticated
  using (app_private.est_membre_groupe(group_id, (select auth.uid()))
         or app_private.possede_carte(card_id, (select auth.uid())));

drop policy membres_rejoint_avec_sa_carte on public.matching_group_members;
create policy membres_rejoint_avec_sa_carte on public.matching_group_members
  for insert to authenticated
  with check (app_private.possede_carte(card_id, (select auth.uid())));

drop policy membres_quitte_le_groupe on public.matching_group_members;
create policy membres_quitte_le_groupe on public.matching_group_members
  for delete to authenticated
  using (app_private.possede_carte(card_id, (select auth.uid())));

drop policy matches_lecture_des_siens on public.individual_matches;
create policy matches_lecture_des_siens on public.individual_matches
  for select to authenticated
  using (app_private.possede_carte(card_id_a, (select auth.uid()))
         or app_private.possede_carte(card_id_b, (select auth.uid())));

drop policy connexions_demande on public.connections;
create policy connexions_demande on public.connections
  for insert to authenticated
  with check (
    demandeur_user_id = (select auth.uid())
    and statut = 'en_attente'
    and not app_private.est_bloque((select auth.uid()), destinataire_user_id)
  );

drop policy conversations_lecture_si_participant on public.conversations;
create policy conversations_lecture_si_participant on public.conversations
  for select to authenticated
  using (app_private.est_participant(id, (select auth.uid())));

drop policy participants_lecture_si_participant on public.conversation_participants;
create policy participants_lecture_si_participant on public.conversation_participants
  for select to authenticated
  using (app_private.est_participant(conversation_id, (select auth.uid())));

drop policy messages_lecture on public.messages;
create policy messages_lecture on public.messages
  for select to authenticated
  using (
    app_private.est_participant(conversation_id, (select auth.uid()))
    and not app_private.est_bloque(sender_id, (select auth.uid()))
  );

drop policy messages_envoi on public.messages;
create policy messages_envoi on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and app_private.est_participant(conversation_id, (select auth.uid()))
    and not exists (
      select 1
      from public.conversation_participants p
      where p.conversation_id = messages.conversation_id
        and p.user_id <> (select auth.uid())
        and app_private.est_bloque(p.user_id, (select auth.uid()))
    )
  );


-- ------------------------------------- points d'entrée applicatifs : mêmes appels
create or replace function public.repondre_match(match_id uuid, reponse public.decision_match)
returns public.individual_matches
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid   uuid := auth.uid();
  ligne public.individual_matches;
begin
  if reponse = 'en_attente' then
    raise exception 'Réponse invalide : accepte ou refuse attendu';
  end if;

  select * into ligne from public.individual_matches where id = match_id;
  if not found then
    raise exception 'Match introuvable';
  end if;

  if app_private.possede_carte(ligne.card_id_a, uid) then
    update public.individual_matches set decision_a = reponse
      where id = match_id returning * into ligne;
  elsif app_private.possede_carte(ligne.card_id_b, uid) then
    update public.individual_matches set decision_b = reponse
      where id = match_id returning * into ligne;
  else
    raise exception 'Ce match ne vous concerne pas';
  end if;

  return ligne;
end;
$$;

create or replace function public.groupes_compatibles(
  carte_id uuid,
  tolerance_jours int default 0
)
returns table (
  group_id uuid,
  description text,
  fenetre_debut date,
  fenetre_fin date,
  meme_type boolean,
  nb_membres bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.description,
    g.fenetre_debut,
    g.fenetre_fin,
    g.type_carte = c.type as meme_type,
    count(m.card_id) as nb_membres
  from public.profile_cards c
  join public.matching_groups g
    on g.ville = c.ville
   and g.pays  = c.pays
   -- « type de carte proche » : voyageur et travailleur sont compatibles entre eux.
   and g.type_carte <> 'local'
   and g.fenetre && daterange(
         lower(c.sejour) - tolerance_jours,
         upper(c.sejour) + tolerance_jours,
         '[]')
  left join public.matching_group_members m on m.group_id = g.id
  where c.id = carte_id
    and c.type <> 'local'
    and c.statut = 'actif'
    -- Garde-fou : la fonction est SECURITY DEFINER, on vérifie que l'appelant
    -- possède bien la carte. auth.uid() est NULL pour service_role (edge
    -- function de matching), qui reste autorisé.
    and (auth.uid() is null or app_private.possede_carte(carte_id, auth.uid()))
    and not exists (
      select 1 from public.matching_group_members mm
      where mm.group_id = g.id and mm.card_id = c.id
    )
  group by g.id, g.description, g.fenetre_debut, g.fenetre_fin, c.type
  order by (g.type_carte = c.type) desc, count(m.card_id) desc;
$$;

create or replace function public.candidats_individuels(
  carte_id uuid,
  limite int default 20,
  tolerance_jours int default 0
)
returns table (
  card_id uuid,
  user_id uuid,
  score numeric,
  interets_communs int,
  jours_communs int
)
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (
    select mc.*, mu.age_min_prefere, mu.age_max_prefere,
           public.age_utilisateur(mu.date_naissance) as mon_age
    from public.profile_cards mc
    join public.users mu on mu.id = mc.user_id
    where mc.id = carte_id
      and mc.type <> 'local'
      and mc.statut = 'actif'
      and (auth.uid() is null or app_private.possede_carte(carte_id, auth.uid()))
  ),
  mes_hobbies as (
    select mh.hobby_id from public.card_hobbies mh where mh.card_id = carte_id
  ),
  candidats as (
    select
      c.id      as cand_card_id,
      c.user_id as cand_user_id,
      public.jours_chevauchement(moi.sejour, c.sejour) as cand_jours_communs,
      (select count(*)::int
         from public.card_hobbies ch
        where ch.card_id = c.id
          and ch.hobby_id in (select mes_hobbies.hobby_id from mes_hobbies)
      ) as cand_interets_communs,
      (select count(*)::int from (
          select ch2.hobby_id from public.card_hobbies ch2 where ch2.card_id = c.id
          union
          select mes_hobbies.hobby_id from mes_hobbies
       ) u_) as cand_interets_union,
      public.jours_chevauchement(moi.sejour, moi.sejour) as cand_mes_jours
    from moi
    join public.profile_cards c
      on c.ville = moi.ville
     and c.pays  = moi.pays
     and c.type <> 'local'
     and c.statut = 'actif'
     and c.user_id <> moi.user_id
     and c.sejour && daterange(lower(moi.sejour) - tolerance_jours,
                               upper(moi.sejour) + tolerance_jours, '[]')
    join public.users u on u.id = c.user_id
    where public.age_utilisateur(u.date_naissance)
            between moi.age_min_prefere and moi.age_max_prefere
      and moi.mon_age between u.age_min_prefere and u.age_max_prefere
      and not app_private.est_bloque(moi.user_id, c.user_id)
      and not exists (
        select 1 from public.individual_matches im
        where im.card_id_a = least(moi.id, c.id)
          and im.card_id_b = greatest(moi.id, c.id)
      )
  )
  select
    cd.cand_card_id,
    cd.cand_user_id,
    round(
      0.6 * (cd.cand_interets_communs::numeric / greatest(cd.cand_interets_union, 1))
      + 0.4 * (cd.cand_jours_communs::numeric / greatest(cd.cand_mes_jours, 1)),
      4
    ),
    cd.cand_interets_communs,
    cd.cand_jours_communs
  from candidats cd
  order by 3 desc, cd.cand_jours_communs desc
  limit limite;
$$;


-- Les anciens helpers publics n'ont plus de dépendants.
drop function public.est_bloque(uuid, uuid);
drop function public.est_participant(uuid, uuid);
drop function public.est_membre_groupe(uuid, uuid);
drop function public.possede_carte(uuid, uuid);

-- jours_chevauchement reste dans public (appelée par candidats_individuels et
-- potentiellement par le client) mais n'expose aucune donnée : SECURITY INVOKER.
revoke execute on function public.jours_chevauchement(daterange, daterange) from public, anon;
