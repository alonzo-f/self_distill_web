alter table public.participants replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.participants;
exception
  when duplicate_object then null;
end;
$$;
