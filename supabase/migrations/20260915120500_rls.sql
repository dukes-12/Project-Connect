-- Row Level Security.
--
-- Principe : RLS filtre les LIGNES, pas les COLONNES. Le masquage des champs
-- (sexe, religion, nationalités, origines, quartier, entreprise) ne peut donc
-- pas être fait ici. La règle appliquée est stricte :
--   * un client authentifié ne lit JAMAIS la ligne brute d'un autre compte ;
--   * tout ce qu'il voit des autres passe par les vues v_* (migration suivante),
--     qui appliquent le masquage colonne par colonne ;
--   * les données masquées restent intactes en base et exploitables par le
--     service de matching (service_role / edge function), conformément à §6.1.

alter table public.users                    enable row level security;
alter table public.profile_cards            enable row level security;
alter table public.hobbies                  enable row level security;
alter table public.card_hobbies             enable row level security;
alter table public.city_guides              enable row level security;
alter table public.points_of_interet        enable row level security;
alter table public.ephemeral_events         enable row level security;
alter table public.checklist_items          enable row level security;
alter table public.user_checklist_status    enable row level security;
alter table public.matching_groups          enable row level security;
alter table public.matching_group_members   enable row level security;
alter table public.individual_matches       enable row level security;
alter table public.connections              enable row level security;
alter table public.conversations            enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                 enable row level security;
alter table public.blocks                   enable row level security;
alter table public.reports                  enable row level security;

-- Rien n'est accessible sans être connecté.
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------- profil global
create policy users_lit_son_profil on public.users
  for select to authenticated using (id = (select auth.uid()));
create policy users_cree_son_profil on public.users
  for insert to authenticated with check (id = (select auth.uid()));
create policy users_modifie_son_profil on public.users
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------- cartes
create policy cards_gere_ses_cartes on public.profile_cards
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy card_hobbies_gere_les_siens on public.card_hobbies
  for all to authenticated
  using (public.possede_carte(card_id, (select auth.uid())))
  with check (public.possede_carte(card_id, (select auth.uid())));

-- --------------------------------------------------- référentiels en lecture seule
-- Écriture réservée au service_role (qui contourne RLS) et à la modération.
create policy hobbies_lecture on public.hobbies
  for select to authenticated using (true);
create policy city_guides_lecture on public.city_guides
  for select to authenticated using (true);
create policy poi_lecture on public.points_of_interet
  for select to authenticated using (true);
create policy checklist_items_lecture on public.checklist_items
  for select to authenticated using (true);

-- ------------------------------------------------- événements éphémères (§7.1)
create policy events_lecture_approuves on public.ephemeral_events
  for select to authenticated
  using (statut_moderation = 'approuve' or soumis_par_user_id = (select auth.uid()));

-- Une soumission entre forcément en file de modération : l'utilisateur ne peut
-- ni choisir son statut, ni se faire passer pour une source agrégée.
create policy events_soumission on public.ephemeral_events
  for insert to authenticated
  with check (
    source = 'utilisateur'
    and soumis_par_user_id = (select auth.uid())
    and statut_moderation = 'en_attente'
  );

create policy events_corrige_sa_soumission on public.ephemeral_events
  for update to authenticated
  using (soumis_par_user_id = (select auth.uid()) and statut_moderation = 'en_attente')
  with check (
    soumis_par_user_id = (select auth.uid())
    and statut_moderation = 'en_attente'
    and source = 'utilisateur'
  );

-- ------------------------------------------------------------------- checklist
create policy checklist_statut_personnel on public.user_checklist_status
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- --------------------------------------------------------- groupes de matching
-- Ville, fenêtre et description sont visibles pour permettre de s'identifier au
-- groupe avant de le rejoindre (§8.1.4). La liste des membres, elle, est fermée.
create policy groupes_lecture on public.matching_groups
  for select to authenticated using (true);
create policy groupes_creation on public.matching_groups
  for insert to authenticated
  with check (cree_par_card_id is null
              or public.possede_carte(cree_par_card_id, (select auth.uid())));
create policy groupes_edition_par_membres on public.matching_groups
  for update to authenticated
  using (public.est_membre_groupe(id, (select auth.uid())))
  with check (public.est_membre_groupe(id, (select auth.uid())));

create policy membres_lecture_si_membre on public.matching_group_members
  for select to authenticated
  using (public.est_membre_groupe(group_id, (select auth.uid()))
         or public.possede_carte(card_id, (select auth.uid())));
create policy membres_rejoint_avec_sa_carte on public.matching_group_members
  for insert to authenticated
  with check (public.possede_carte(card_id, (select auth.uid())));
create policy membres_quitte_le_groupe on public.matching_group_members
  for delete to authenticated
  using (public.possede_carte(card_id, (select auth.uid())));

-- --------------------------------------------------------- matching individuel
-- Lecture seule côté client : la réponse passe par repondre_match(), pour
-- qu'un utilisateur ne puisse pas écrire la décision de l'autre (RLS ne sait
-- pas restreindre une policy UPDATE à une colonne précise).
create policy matches_lecture_des_siens on public.individual_matches
  for select to authenticated
  using (public.possede_carte(card_id_a, (select auth.uid()))
         or public.possede_carte(card_id_b, (select auth.uid())));

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

  if public.possede_carte(ligne.card_id_a, uid) then
    update public.individual_matches set decision_a = reponse
      where id = match_id returning * into ligne;
  elsif public.possede_carte(ligne.card_id_b, uid) then
    update public.individual_matches set decision_b = reponse
      where id = match_id returning * into ligne;
  else
    raise exception 'Ce match ne vous concerne pas';
  end if;

  return ligne;
end;
$$;
revoke all on function public.repondre_match(uuid, public.decision_match) from public, anon;
grant execute on function public.repondre_match(uuid, public.decision_match) to authenticated;

-- --------------------------------------------- mise en relation avec les locaux
create policy connexions_lecture_des_siennes on public.connections
  for select to authenticated
  using (demandeur_user_id = (select auth.uid())
         or destinataire_user_id = (select auth.uid()));
create policy connexions_demande on public.connections
  for insert to authenticated
  with check (
    demandeur_user_id = (select auth.uid())
    and statut = 'en_attente'
    and not public.est_bloque((select auth.uid()), destinataire_user_id)
  );
create policy connexions_reponse_du_destinataire on public.connections
  for update to authenticated
  using (destinataire_user_id = (select auth.uid()))
  with check (destinataire_user_id = (select auth.uid()));

-- ------------------------------------------------------------------ messagerie
create policy conversations_lecture_si_participant on public.conversations
  for select to authenticated
  using (public.est_participant(id, (select auth.uid())));

create policy participants_lecture_si_participant on public.conversation_participants
  for select to authenticated
  using (public.est_participant(conversation_id, (select auth.uid())));

-- Un blocage masque la conversation côté bloqueur sans rien supprimer (§9.7).
create policy messages_lecture on public.messages
  for select to authenticated
  using (
    public.est_participant(conversation_id, (select auth.uid()))
    and not public.est_bloque(sender_id, (select auth.uid()))
  );

create policy messages_envoi on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.est_participant(conversation_id, (select auth.uid()))
    and not exists (
      select 1
      from public.conversation_participants p
      where p.conversation_id = messages.conversation_id
        and p.user_id <> (select auth.uid())
        and public.est_bloque(p.user_id, (select auth.uid()))
    )
  );

-- --------------------------------------------------------------- modération
create policy blocks_gere_les_siens on public.blocks
  for all to authenticated
  using (blocker_user_id = (select auth.uid()))
  with check (blocker_user_id = (select auth.uid()));

create policy reports_signale on public.reports
  for insert to authenticated
  with check (reporter_user_id = (select auth.uid()) and statut = 'en_attente');
create policy reports_lecture_des_siens on public.reports
  for select to authenticated
  using (reporter_user_id = (select auth.uid()));
