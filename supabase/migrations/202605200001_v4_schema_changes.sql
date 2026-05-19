-- v4 schema changes
-- See: docs/v4-migration-plan.md (Phase 0)
-- Maps to v4 doc: III. 阶段 0.5 (state machine + 重入), 阶段 1 (display_name),
--                 阶段 4 (rating tier params), 阶段 6.8 (backdoor attacks),
--                 IV. 投影墙 (is_permanent for Builder graveyard anchor)

-- ---------------------------------------------------------------------------
-- 1. participants: add v4 columns
-- ---------------------------------------------------------------------------

alter table public.participants
  add column if not exists display_name text;

alter table public.participants
  add column if not exists phase text not null default 'UNREGISTERED'
    check (phase in (
      'UNREGISTERED',
      'PSA_VIEWED',
      'REGISTERED',
      'CALIBRATED',
      'EXPRESSED',
      'DISTILLED_VIEWED',
      'BENCHMARKED',
      'HUB_UNLOCKED',
      'GHOST',
      'BACKDOOR_FOUND'
    ));

alter table public.participants
  add column if not exists phone_last4 text
    check (phone_last4 is null or phone_last4 ~ '^[0-9]{4}$');

alter table public.participants
  add column if not exists archived_at timestamptz;

alter table public.participants
  add column if not exists is_permanent boolean not null default false;

alter table public.participants
  add column if not exists attack_tokens integer not null default 0
    check (attack_tokens >= 0);

alter table public.participants
  add column if not exists user_rating_tier text
    check (user_rating_tier is null or user_rating_tier in ('10','8-9','6-7','4-5','1-3'));

alter table public.participants
  add column if not exists tier_click_multiplier numeric(4,2) not null default 1.0
    check (tier_click_multiplier >= 0);

alter table public.participants
  add column if not exists tier_error_rate_factor numeric(4,2) not null default 1.0
    check (tier_error_rate_factor >= 0);

alter table public.participants
  add column if not exists leisure_game text
    check (leisure_game is null or leisure_game in ('GUESS','BLACKJACK','SLOTS'));

-- v4: credit = 实际挖矿点击数, 初始为 0 (而非 v3 的 150)
alter table public.participants
  alter column leisure_credits set default 0;

-- ---------------------------------------------------------------------------
-- 2. Indexes for v4 queries
-- ---------------------------------------------------------------------------

create index if not exists idx_participants_phase
  on public.participants(phase);

create index if not exists idx_participants_archived_at
  on public.participants(archived_at desc nulls last)
  where archived_at is not null;

create index if not exists idx_participants_graveyard
  on public.participants(is_permanent, archived_at desc)
  where archived_at is not null or is_permanent = true;

create index if not exists idx_participants_phone_last4
  on public.participants(phone_last4)
  where phone_last4 is not null;

-- ---------------------------------------------------------------------------
-- 3. backdoor_attacks table (阶段 6.8)
-- ---------------------------------------------------------------------------

create table if not exists public.backdoor_attacks (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references public.participants(id) on delete cascade,
  target_id uuid not null references public.participants(id) on delete cascade,
  action_type text not null check (action_type in ('SIPHON','CORRUPT','SWAP')),
  amount integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_backdoor_attacks_attacker
  on public.backdoor_attacks(attacker_id, created_at desc);

create index if not exists idx_backdoor_attacks_target
  on public.backdoor_attacks(target_id, created_at desc);

alter table public.backdoor_attacks enable row level security;

drop policy if exists "backdoor_attacks_public_read" on public.backdoor_attacks;
create policy "backdoor_attacks_public_read"
  on public.backdoor_attacks for select
  to anon, authenticated
  using (true);

drop policy if exists "backdoor_attacks_public_insert" on public.backdoor_attacks;
create policy "backdoor_attacks_public_insert"
  on public.backdoor_attacks for insert
  to anon, authenticated
  with check (true);

-- ---------------------------------------------------------------------------
-- 4. Builder seed data (阶段 0 + IV. 投影墙地基)
-- ---------------------------------------------------------------------------
-- Builder_01: 编剧/导演 - 蒸馏失败 (太人类)
-- Builder_02: 程序员    - 蒸馏成功 (足够像机器)
-- 两位都作为 is_permanent=true 永久居于坟场底部.

insert into public.participants (
  display_id, display_name, status, verdict,
  clarity_score, efficiency_score, emotional_noise_score, compliance_score,
  ai_assessment,
  output, is_operator, is_builder, builder_role,
  is_permanent, phase, archived_at
) values
  (
    'BUILDER_01', 'BUILDER_01', 'ARCHIVED', 'VESSEL_PRESERVED',
    72, 45, 89, 38,
    '蒸馏失败——情绪噪音过高',
    0, false, true, '编剧/导演',
    true, 'BACKDOOR_FOUND', '1970-01-01T00:00:00Z'
  ),
  (
    'BUILDER_02', 'BUILDER_02', 'ARCHIVED', 'DISTILLED',
    85, 91, 31, 78,
    '蒸馏成功——已生成高效替身',
    0, false, true, '程序员',
    true, 'BACKDOOR_FOUND', '1970-01-01T00:00:00Z'
  )
on conflict (display_id) do update set
  is_permanent = excluded.is_permanent,
  display_name = excluded.display_name,
  is_builder = excluded.is_builder,
  builder_role = excluded.builder_role;
