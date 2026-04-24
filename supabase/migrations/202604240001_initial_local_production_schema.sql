create extension if not exists "pgcrypto";

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  display_id text not null unique,
  status text not null default 'UNPROCESSED',
  verdict text check (verdict in ('DISTILLED', 'VESSEL_PRESERVED')),
  output integer not null default 0,
  is_operator boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  photo_url text,
  avatar_url text,
  original_text text,
  distilled_text text,
  clarity_score integer check (clarity_score between 0 and 100),
  efficiency_score integer check (efficiency_score between 0 and 100),
  emotional_noise_score integer check (emotional_noise_score between 0 and 100),
  compliance_score integer check (compliance_score between 0 and 100),
  ai_assessment text,
  operator_eligible boolean not null default false,
  user_rating_of_ai integer check (user_rating_of_ai between 1 and 10),
  mining_credits integer not null default 0,
  leisure_credits integer not null default 150,
  engagement_points integer not null default 0,
  backend_unlocked boolean not null default false,
  is_builder boolean not null default false,
  builder_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calibration_answers (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  question_key text not null,
  selected_option text not null,
  response_time_ms integer not null,
  changed_answer boolean not null default false,
  change_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.operator_actions (
  id uuid primary key default gen_random_uuid(),
  source_participant_id uuid references public.participants(id) on delete set null,
  target_participant_id uuid references public.participants(id) on delete cascade,
  action_type text not null check (action_type in ('FLAG', 'THROTTLE', 'BOOST', 'REPORT')),
  action_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.leisure_actions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  action_type text not null,
  wager integer,
  result integer,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants(id) on delete cascade,
  contact text not null,
  channel text not null check (channel in ('email', 'sms')),
  message_content text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'failed', 'cancelled')),
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_participants_status_output on public.participants(status, output desc);
create index if not exists idx_participants_last_seen_at on public.participants(last_seen_at desc);
create index if not exists idx_calibration_answers_participant_id on public.calibration_answers(participant_id);
create index if not exists idx_operator_actions_target_created on public.operator_actions(target_participant_id, created_at desc);
create index if not exists idx_leisure_actions_participant_created on public.leisure_actions(participant_id, created_at desc);
create index if not exists idx_scheduled_messages_due on public.scheduled_messages(status, scheduled_for);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_participants_updated_at on public.participants;
create trigger set_participants_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

alter table public.participants enable row level security;
alter table public.calibration_answers enable row level security;
alter table public.operator_actions enable row level security;
alter table public.leisure_actions enable row level security;
alter table public.scheduled_messages enable row level security;

drop policy if exists "participants_public_read" on public.participants;
create policy "participants_public_read"
on public.participants for select
to anon, authenticated
using (true);

drop policy if exists "participants_public_insert" on public.participants;
create policy "participants_public_insert"
on public.participants for insert
to anon, authenticated
with check (true);

drop policy if exists "participants_public_update" on public.participants;
create policy "participants_public_update"
on public.participants for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "calibration_answers_public_all" on public.calibration_answers;
create policy "calibration_answers_public_all"
on public.calibration_answers for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "operator_actions_public_all" on public.operator_actions;
create policy "operator_actions_public_all"
on public.operator_actions for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "leisure_actions_public_all" on public.leisure_actions;
create policy "leisure_actions_public_all"
on public.leisure_actions for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "scheduled_messages_service_role_all" on public.scheduled_messages;
create policy "scheduled_messages_service_role_all"
on public.scheduled_messages for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'participant-photos',
  'participant-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "participant_photos_public_read" on storage.objects;
create policy "participant_photos_public_read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'participant-photos');

drop policy if exists "participant_photos_public_write" on storage.objects;
create policy "participant_photos_public_write"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'participant-photos');

drop policy if exists "participant_photos_public_update" on storage.objects;
create policy "participant_photos_public_update"
on storage.objects for update
to anon, authenticated
using (bucket_id = 'participant-photos')
with check (bucket_id = 'participant-photos');
