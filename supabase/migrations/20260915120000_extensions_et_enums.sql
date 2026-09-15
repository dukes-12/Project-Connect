-- Extensions et types énumérés partagés par tout le schéma.
-- btree_gist permet de mélanger colonnes scalaires (ville) et ranges (daterange)
-- dans un même index GIST, ce qui est la base du matching par fenêtre d'arrivée.
create extension if not exists btree_gist;

create type public.type_carte as enum ('local', 'voyageur', 'travailleur');
create type public.statut_carte as enum ('actif', 'inactif', 'archive');
create type public.type_sexe as enum ('femme', 'homme', 'autre', 'non_precise');

create type public.source_evenement as enum ('agrege', 'utilisateur');
create type public.statut_moderation as enum ('en_attente', 'approuve', 'rejete');

create type public.statut_membre_groupe as enum ('membre', 'en_attente');
create type public.decision_match as enum ('en_attente', 'accepte', 'refuse');
create type public.statut_match as enum ('propose', 'accepte', 'refuse');
create type public.statut_connexion as enum ('en_attente', 'accepte', 'refuse');

create type public.statut_checklist as enum ('a_faire', 'en_cours', 'fait');
create type public.type_conversation as enum ('direct', 'groupe');

create type public.motif_signalement as enum (
  'harcelement', 'contenu_inapproprie', 'faux_profil', 'comportement_deplace', 'autre'
);
create type public.statut_signalement as enum ('en_attente', 'en_cours', 'traite');

-- Trigger générique de mise à jour de updated_at.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
