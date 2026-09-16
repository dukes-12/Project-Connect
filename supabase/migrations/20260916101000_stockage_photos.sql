-- Stockage des photos de profil (§6.1 : photo obligatoire, toujours visible).
--
-- Bucket privé plutôt que public : l'accès passe par une URL signée, donc les
-- règles ci-dessous s'appliquent réellement — un compte bloqué ne peut pas
-- récupérer la photo de celui qui l'a bloqué, alors qu'un bucket public
-- laisserait l'image accessible à quiconque connaît son chemin.
--
-- Convention de chemin : `<user_id>/<nom de fichier>`. Le premier segment est
-- le propriétaire, ce sur quoi s'appuient toutes les policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos-profil', 'photos-profil', false,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- Propriétaire déduit du chemin. Renvoie NULL si le premier segment n'est pas
-- un uuid, plutôt que de faire échouer le cast au milieu d'une policy.
create or replace function app_private.proprietaire_fichier(chemin text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select substring(
    chemin from '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
  )::uuid;
$$;

-- Lecture : tout compte connecté, sauf blocage dans un sens ou dans l'autre (§9.7).
create policy photos_profil_lecture on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos-profil'
    and app_private.proprietaire_fichier(name) is not null
    and not app_private.est_bloque(app_private.proprietaire_fichier(name), (select auth.uid()))
  );

-- Écriture : uniquement dans son propre dossier.
create policy photos_profil_depot on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos-profil'
    and app_private.proprietaire_fichier(name) = (select auth.uid())
  );

create policy photos_profil_remplacement on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos-profil'
    and app_private.proprietaire_fichier(name) = (select auth.uid())
  )
  with check (
    bucket_id = 'photos-profil'
    and app_private.proprietaire_fichier(name) = (select auth.uid())
  );

create policy photos_profil_suppression on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos-profil'
    and app_private.proprietaire_fichier(name) = (select auth.uid())
  );

comment on column public.users.photo_url is
  'Chemin dans le bucket `photos-profil`, au format `<user_id>/<fichier>`. Le bucket étant privé, le client demande une URL signée ; les policies de storage.objects filtrent alors les comptes bloqués.';
