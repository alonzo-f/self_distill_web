create or replace function public.broadcast_participant_change()
returns trigger
language plpgsql
security definer
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'operation', tg_op,
    'table', tg_table_name,
    'schema', tg_table_schema,
    'record', to_jsonb(new),
    'old_record', to_jsonb(old)
  );

  perform realtime.send(
    payload,
    'participant_changed',
    'wall:participants',
    false
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists broadcast_participant_change on public.participants;
create trigger broadcast_participant_change
after insert or update or delete on public.participants
for each row execute function public.broadcast_participant_change();
