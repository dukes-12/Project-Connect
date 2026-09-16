-- Deux exigences de la spec restées sans implémentation.
--   §9.7 : « Plusieurs signalements convergents sur un même profil déclenchent
--           une revue prioritaire (seuil configurable) »
--   §7.1 : « Avant soumission, une vérification de doublon est proposée
--           (recherche sur titre + ville + dates proches) »

create extension if not exists pg_trgm schema extensions;

-- ---------------------------------------------------------------------------
-- Paramètres d'exploitation, modifiables sans migration.
create table app_private.parametres (
  cle        text primary key,
  valeur     jsonb not null,
  description text
);

insert into app_private.parametres (cle, valeur, description) values
  ('seuil_signalements', '3'::jsonb,
   'Nombre de signalements ouverts sur un même profil à partir duquel la revue passe en priorité haute (§9.7).'),
  ('tolerance_doublon_jours', '3'::jsonb,
   'Écart de dates en deçà duquel deux événements de même ville sont considérés comme potentiellement identiques (§7.1).'),
  ('similarite_titre_minimale', '0.4'::jsonb,
   'Score de similarité trigramme à partir duquel deux titres sont rapprochés (§7.1).');

create or replace function app_private.parametre(p_cle text, p_defaut numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select valeur::text::numeric from app_private.parametres where cle = p_cle), p_defaut);
$$;


-- ---------------------------------------------------------------------------
-- §9.7 : revue prioritaire sur signalements convergents.
create type public.priorite_signalement as enum ('normale', 'haute');

alter table public.reports
  add column priorite public.priorite_signalement not null default 'normale';

-- Le passage en priorité haute touche TOUS les signalements ouverts du profil,
-- pas seulement le dernier : un modérateur qui trie par priorité doit voir le
-- dossier complet remonter d'un coup, pas une ligne isolée.
create or replace function app_private.tg_priorite_signalements_convergents()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ouverts int;
  seuil   int := app_private.parametre('seuil_signalements', 3)::int;
begin
  select count(*) into ouverts
    from public.reports
   where reported_user_id = new.reported_user_id
     and statut <> 'traite';

  if ouverts >= seuil then
    update public.reports
       set priorite = 'haute'
     where reported_user_id = new.reported_user_id
       and statut <> 'traite'
       and priorite <> 'haute';
  end if;
  return new;
end;
$$;

create trigger reports_revue_prioritaire
  after insert on public.reports
  for each row execute function app_private.tg_priorite_signalements_convergents();

create index reports_priorite on public.reports (priorite, created_at)
  where statut <> 'traite';


-- ---------------------------------------------------------------------------
-- §7.1 : doublons avant soumission d'un événement.
--
-- SECURITY DEFINER volontaire : la recherche doit aussi voir les soumissions
-- encore en attente de modération, y compris celles d'autres utilisateurs —
-- c'est précisément le doublon qu'on veut éviter. Seuls le titre et les dates
-- sont renvoyés, pas l'auteur.
create or replace function public.evenements_similaires(
  p_ville text,
  p_pays text,
  p_titre text,
  p_date_debut date
)
returns table (
  id uuid,
  titre text,
  date_debut date,
  date_fin date,
  statut_moderation public.statut_moderation,
  similarite real
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id,
    e.titre,
    e.date_debut,
    e.date_fin,
    e.statut_moderation,
    extensions.similarity(lower(e.titre), lower(p_titre)) as similarite
  from public.ephemeral_events e
  join public.city_guides g on g.id = e.city_guide_id
  where g.ville = p_ville
    and g.pays = p_pays
    and e.statut_moderation <> 'rejete'
    and abs(e.date_debut - p_date_debut)
        <= app_private.parametre('tolerance_doublon_jours', 3)::int
    and extensions.similarity(lower(e.titre), lower(p_titre))
        >= app_private.parametre('similarite_titre_minimale', 0.4)
  order by 6 desc, e.date_debut;
$$;

revoke all on function public.evenements_similaires(text, text, text, date) from public, anon;
grant execute on function public.evenements_similaires(text, text, text, date) to authenticated;

-- L'index posé initialement sous le nom `events_titre_trgm` était un btree, donc
-- inutilisable pour une recherche par similarité. Le vrai index trigramme :
drop index if exists public.events_titre_trgm;
create index events_titre_similarite
  on public.ephemeral_events using gin (lower(titre) extensions.gin_trgm_ops);
create index events_ville_date on public.ephemeral_events (city_guide_id, date_debut);
