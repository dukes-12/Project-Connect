-- §9.7 : « la conversation existante est masquée pour B ».
--
-- La policy sur `messages` cache déjà les messages d'un compte bloqué, mais la
-- conversation elle-même restait dans la liste — une coquille vide, ce qui ne
-- correspond pas à ce que la spec demande. Cette vue applique la règle au bon
-- niveau, et fournit au passage de quoi afficher une liste utile.
--
-- Le masquage ne vaut que pour les échanges à deux : bloquer un membre d'une
-- cohorte ne doit pas faire disparaître le groupe entier. Ses messages, eux,
-- restent filtrés par la policy.

create or replace view public.v_mes_conversations
with (security_invoker = false) as
select
  c.id,
  c.type,
  c.matching_group_id,
  c.created_at,
  g.description as description_groupe,
  -- Pour un échange à deux : l'autre personne. NULL pour une cohorte.
  (select p2.user_id
     from public.conversation_participants p2
    where p2.conversation_id = c.id
      and p2.user_id <> auth.uid()
    limit 1) as autre_user_id,
  (select count(*)
     from public.conversation_participants p3
    where p3.conversation_id = c.id) as nb_participants,
  -- Dernier message visible : ceux d'un compte bloqué n'ont pas à remonter
  -- dans l'aperçu d'une cohorte.
  (select max(m.created_at)
     from public.messages m
    where m.conversation_id = c.id
      and not app_private.est_bloque(m.sender_id, auth.uid())) as dernier_message_at,
  (select m.contenu
     from public.messages m
    where m.conversation_id = c.id
      and not app_private.est_bloque(m.sender_id, auth.uid())
    order by m.created_at desc
    limit 1) as dernier_message
from public.conversations c
join public.conversation_participants p
  on p.conversation_id = c.id and p.user_id = auth.uid()
left join public.matching_groups g on g.id = c.matching_group_id
where c.type <> 'direct'
   or not exists (
     select 1
     from public.conversation_participants pa
     where pa.conversation_id = c.id
       and pa.user_id <> auth.uid()
       and app_private.est_bloque(pa.user_id, auth.uid())
   );

comment on view public.v_mes_conversations is
  'Conversations de l''appelant. Un échange à deux disparaît dès qu''un blocage existe dans un sens ou dans l''autre (§9.7) ; une cohorte reste visible, seuls les messages du compte bloqué sont filtrés.';

revoke all on public.v_mes_conversations from anon, public;
grant select on public.v_mes_conversations to authenticated;
