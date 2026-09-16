-- Multilingue des contenus éditoriaux (§14 : « prévoir le multilingue dès
-- l'architecture, même si le MVP ne sort qu'en français/anglais »).
--
-- Choix : les colonnes existantes restent la langue de référence (français) et
-- chaque table porte un `traductions jsonb` de la forme
--   {"en": {"nom": "Hiking", "categorie": "Outdoors"}}
--
-- Une table de traductions séparée serait plus normalisée, mais imposerait une
-- jointure à chaque lecture pour un volume qui reste éditorial (des dizaines de
-- lignes par ville). Le jsonb garde les lectures en une requête, et la colonne
-- de référence garantit qu'il y a toujours une valeur à afficher.
--
-- Ne concerne que le contenu éditorial. Ce que les utilisateurs écrivent (bio,
-- messages, événements soumis) n'est pas traduit.

alter table public.hobbies
  add column traductions jsonb not null default '{}'::jsonb
  constraint hobbies_traductions_objet check (jsonb_typeof(traductions) = 'object');
alter table public.city_guides
  add column traductions jsonb not null default '{}'::jsonb
  constraint city_guides_traductions_objet check (jsonb_typeof(traductions) = 'object');
alter table public.points_of_interet
  add column traductions jsonb not null default '{}'::jsonb
  constraint poi_traductions_objet check (jsonb_typeof(traductions) = 'object');
alter table public.ephemeral_events
  add column traductions jsonb not null default '{}'::jsonb
  constraint events_traductions_objet check (jsonb_typeof(traductions) = 'object');
alter table public.checklist_items
  add column traductions jsonb not null default '{}'::jsonb
  constraint checklist_traductions_objet check (jsonb_typeof(traductions) = 'object');

-- Repli explicite sur la langue de référence : une traduction absente ou vide
-- rend la valeur française plutôt qu'un NULL qui viderait l'écran.
create or replace function public.traduire(
  valeur_par_defaut text,
  traductions jsonb,
  langue text,
  champ text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(traductions -> langue ->> champ, ''), valeur_par_defaut);
$$;

comment on function public.traduire is
  'Valeur d''un champ dans la langue demandée, avec repli sur la colonne de référence. Ex : traduire(h.nom, h.traductions, ''en'', ''nom'').';

grant execute on function public.traduire(text, jsonb, text, text) to authenticated;

-- L'agenda expose ses traductions comme les autres contenus.
create or replace view public.v_evenements_ville
with (security_invoker = false) as
select
  e.id, e.city_guide_id, g.ville, g.pays,
  e.titre, e.type, e.date_debut, e.date_fin, e.periode,
  e.lien, e.description, e.source, e.traductions
from public.ephemeral_events e
join public.city_guides g on g.id = e.city_guide_id
where e.statut_moderation = 'approuve';

revoke all on public.v_evenements_ville from anon, public;
grant select on public.v_evenements_ville to authenticated;
