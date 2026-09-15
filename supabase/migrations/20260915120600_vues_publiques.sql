-- Vues de lecture pour les autres utilisateurs.
--
-- Ces vues sont volontairement en SECURITY DEFINER (security_invoker = false,
-- le défaut) : c'est elles — et elles seules — qui exposent les lignes des
-- autres comptes, en appliquant le masquage colonne par colonne que RLS ne sait
-- pas faire. Chaque vue refiltre donc explicitement sur auth.uid() pour exclure
-- les comptes bloqués. L'advisor Supabase signalera `security_definer_view` :
-- c'est intentionnel et documenté ici.

create or replace view public.v_profils_publics
with (security_invoker = false) as
select
  u.id,
  u.photo_url,                                   -- toujours visible (§6.1)
  u.bio,
  u.langues,
  public.age_utilisateur(u.date_naissance) as age,  -- toujours visible, non masquable
  case when u.sexe_visible         then u.sexe          end as sexe,
  case when u.religion_visible     then u.religion      end as religion,
  case when u.nationalites_visible then u.nationalites  end as nationalites,
  case when u.origines_visible     then u.origines      end as origines
from public.users u
where not public.est_bloque(u.id, auth.uid());

comment on view public.v_profils_publics is
  'Profil global tel que les autres comptes le voient. Les champs masqués sortent à NULL ; la donnée reste intacte en base pour le matching interne (§6.1).';


create or replace view public.v_cartes_publiques
with (security_invoker = false) as
select
  c.id                as card_id,
  c.user_id,
  c.type,
  c.ville,
  c.pays,
  c.date_debut,
  c.date_fin,
  c.statut,
  case when c.quartier_visible   then c.quartier_precis end as quartier_precis,
  case when c.entreprise_visible then c.entreprise      end as entreprise,
  p.photo_url,
  p.bio,
  p.langues,
  p.age,
  p.sexe
from public.profile_cards c
join public.v_profils_publics p on p.id = c.user_id
where c.statut = 'actif';

comment on view public.v_cartes_publiques is
  'Cartes actives visibles par les autres. Le quartier et l''entreprise masqués sortent à NULL mais restent utilisables par le service de matching (§6.2).';


-- Découverte des locaux (§8.3) : les locaux actifs d'une ville, filtrables par
-- intérêts et par langue côté client.
create or replace view public.v_locaux_actifs
with (security_invoker = false) as
select
  c.card_id,
  c.user_id,
  c.ville,
  c.pays,
  c.quartier_precis,
  c.photo_url,
  c.bio,
  c.langues,
  c.age,
  c.sexe,
  coalesce(
    (select array_agg(h.nom order by h.nom)
       from public.card_hobbies ch
       join public.hobbies h on h.id = ch.hobby_id
      where ch.card_id = c.card_id),
    '{}'
  ) as hobbies
from public.v_cartes_publiques c
where c.type = 'local';


-- Agenda de la ville : uniquement les événements approuvés (§7.1).
create or replace view public.v_evenements_ville
with (security_invoker = false) as
select
  e.id, e.city_guide_id, g.ville, g.pays,
  e.titre, e.type, e.date_debut, e.date_fin, e.periode,
  e.lien, e.description, e.source
from public.ephemeral_events e
join public.city_guides g on g.id = e.city_guide_id
where e.statut_moderation = 'approuve';


revoke all on public.v_profils_publics, public.v_cartes_publiques,
               public.v_locaux_actifs, public.v_evenements_ville
  from anon, public;
grant select on public.v_profils_publics, public.v_cartes_publiques,
                public.v_locaux_actifs, public.v_evenements_ville
  to authenticated;
