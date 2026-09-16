-- Planification de l'archivage (§6.2) et chat temps réel (§12).

create extension if not exists pg_cron;

-- Tous les jours à 03:00 UTC. La fonction est idempotente : un jour sauté
-- (base en pause, migration en cours) est rattrapé au passage suivant.
select cron.schedule(
  'archivage-cartes-expirees',
  '0 3 * * *',
  $$select public.archiver_cartes_expirees()$$
);

-- Realtime sur les messages : c'est ce qui rend le chat vivant (§9.6, §12).
-- La publication respecte la RLS, donc un abonné ne reçoit que les messages
-- des conversations dont il est participant, et rien d'un compte qui l'a bloqué.
alter publication supabase_realtime add table public.messages;

-- REPLICA IDENTITY FULL : sans ça, les événements UPDATE/DELETE ne portent que
-- la clé primaire, et le client ne peut pas filtrer sur conversation_id.
alter table public.messages replica identity full;
