-- Fonctions de recherche de candidats (§8.1, §8.2).
--
-- Elles ne DÉCIDENT rien : elles retournent des candidats classés. La création
-- des groupes, l'envoi des propositions et les règles métier restent dans le
-- service de matching applicatif (edge function), isolé et testable (§12, §16).
--
-- Note d'implémentation : toutes les références de colonnes sont qualifiées par
-- un alias de table. Les noms de sortie (card_id, user_id…) sont aussi des
-- paramètres OUT de la fonction ; une référence non qualifiée serait ambiguë.

-- Nombre de jours de chevauchement entre deux séjours. Un séjour ouvert
-- (date_fin nulle → borne haute infinie) est ramené à un horizon de 365 jours
-- pour rester comparable. STABLE et non IMMUTABLE : dépend de current_date.
create or replace function public.jours_chevauchement(a daterange, b daterange)
returns int
language sql
stable
set search_path = ''
as $$
  with bornes as (
    select
      coalesce(lower(a), current_date) as a_debut,
      coalesce(upper(a), coalesce(lower(a), current_date) + 365) as a_fin,
      coalesce(lower(b), current_date) as b_debut,
      coalesce(upper(b), coalesce(lower(b), current_date) + 365) as b_fin
  )
  select greatest(0, (least(bornes.a_fin, bornes.b_fin)
                      - greatest(bornes.a_debut, bornes.b_debut)))::int
  from bornes;
$$;


-- Groupes existants compatibles avec une carte (§8.1.1).
-- `tolerance_jours` permet d'élargir la fenêtre quand une ville est peu peuplée (§14).
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
    and (auth.uid() is null or public.possede_carte(carte_id, auth.uid()))
    -- Pas de proposition pour un groupe déjà rejoint.
    and not exists (
      select 1 from public.matching_group_members mm
      where mm.group_id = g.id and mm.card_id = c.id
    )
  group by g.id, g.description, g.fenetre_debut, g.fenetre_fin, c.type
  order by (g.type_carte = c.type) desc, count(m.card_id) desc;
$$;


-- Candidats pour le matching individuel (§8.2), classés par score.
-- Score = 60 % intérêts communs (Jaccard) + 40 % proportion du séjour partagée.
-- Religion, nationalité et origine n'entrent JAMAIS dans ce calcul (§6.1, §14).
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
      -- Même garde-fou que groupes_compatibles.
      and (auth.uid() is null or public.possede_carte(carte_id, auth.uid()))
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
    -- Tranche d'âge préférée, appliquée dans les deux sens (§6.1).
    where public.age_utilisateur(u.date_naissance)
            between moi.age_min_prefere and moi.age_max_prefere
      and moi.mon_age between u.age_min_prefere and u.age_max_prefere
      and not public.est_bloque(moi.user_id, c.user_id)
      -- Pas de re-proposition d'une paire déjà traitée.
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

revoke all on function public.jours_chevauchement(daterange, daterange) from public, anon;
revoke all on function public.groupes_compatibles(uuid, int) from public, anon;
revoke all on function public.candidats_individuels(uuid, int, int) from public, anon;
grant execute on function public.jours_chevauchement(daterange, daterange) to authenticated;
grant execute on function public.groupes_compatibles(uuid, int) to authenticated;
grant execute on function public.candidats_individuels(uuid, int, int) to authenticated;
