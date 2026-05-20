-- v4 broadcast triggers for backdoor_attacks + operator_actions
-- Reference: docs/v4-migration-plan.md Phase 9 + 10 (fix wall not showing attacks)
--
-- Why: the participants table already broadcasts via wall:participants for
-- DB mutations, but actions that don't necessarily mutate participants
-- (CORRUPT, FLAG) emit no signal — and even those that do (SIPHON, SWAP,
-- THROTTLE, BOOST, REPORT) only show as silent number changes on the wall.
--
-- This migration adds a separate broadcast channel `wall:events` carrying
-- enriched payloads (attacker_display_id, target_display_id, action_type,
-- amount) so the wall's announcements quadrant can render them with
-- context.

-- ─── backdoor_attacks ───────────────────────────────────────────────────
create or replace function public.broadcast_backdoor_attack()
returns trigger
language plpgsql
security definer
as $$
declare
  payload jsonb;
  attacker_display text;
  target_display text;
begin
  select display_id into attacker_display from public.participants where id = new.attacker_id;
  select display_id into target_display from public.participants where id = new.target_id;

  payload := jsonb_build_object(
    'operation', 'INSERT',
    'table', 'backdoor_attacks',
    'attacker_id', new.attacker_id,
    'target_id', new.target_id,
    'attacker_display_id', attacker_display,
    'target_display_id', target_display,
    'action_type', new.action_type,
    'amount', new.amount,
    'created_at', new.created_at
  );

  perform realtime.send(
    payload,
    'backdoor_attack',
    'wall:events',
    false
  );

  return new;
end;
$$;

drop trigger if exists broadcast_backdoor_attack on public.backdoor_attacks;
create trigger broadcast_backdoor_attack
after insert on public.backdoor_attacks
for each row execute function public.broadcast_backdoor_attack();

-- ─── operator_actions ──────────────────────────────────────────────────
create or replace function public.broadcast_operator_action()
returns trigger
language plpgsql
security definer
as $$
declare
  payload jsonb;
  source_display text;
  target_display text;
begin
  select display_id into source_display from public.participants where id = new.source_participant_id;
  select display_id into target_display from public.participants where id = new.target_participant_id;

  payload := jsonb_build_object(
    'operation', 'INSERT',
    'table', 'operator_actions',
    'source_id', new.source_participant_id,
    'target_id', new.target_participant_id,
    'source_display_id', source_display,
    'target_display_id', target_display,
    'action_type', new.action_type,
    'created_at', new.created_at
  );

  perform realtime.send(
    payload,
    'operator_action',
    'wall:events',
    false
  );

  return new;
end;
$$;

drop trigger if exists broadcast_operator_action on public.operator_actions;
create trigger broadcast_operator_action
after insert on public.operator_actions
for each row execute function public.broadcast_operator_action();
