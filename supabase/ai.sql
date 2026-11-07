-- Flex Up Pro — AI coach (wave 1): workout recaps, weekly reports and the daily AI cap.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again.
-- Everything here is additive: existing tables only gain one optional column.

-- ---------------------------------------------------------------------------
-- The coach's note on a finished workout, written once and shown again in History.
-- ---------------------------------------------------------------------------

alter table public.workout_sessions
  add column if not exists ai_recap text check (ai_recap is null or char_length(ai_recap) <= 600);

-- ---------------------------------------------------------------------------
-- Daily AI cap: one row per person per day. Only ai_take() touches it.
-- ---------------------------------------------------------------------------

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- No policies: the table is reachable only through ai_take() below.

/** Counts one AI request for the signed-in person today and returns today's total. */
create or replace function public.ai_take()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.ai_usage (user_id, day, count)
  values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  return n;
end;
$$;

revoke all on function public.ai_take() from public, anon;
grant execute on function public.ai_take() to authenticated;

-- ---------------------------------------------------------------------------
-- Sunday report card: one per person per week (week_start is that week's Monday).
-- ---------------------------------------------------------------------------

create table if not exists public.ai_reports (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  week_start date not null,
  body       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

alter table public.ai_reports enable row level security;

drop policy if exists "reports: select own" on public.ai_reports;
drop policy if exists "reports: insert own" on public.ai_reports;
drop policy if exists "reports: update own" on public.ai_reports;

create policy "reports: select own" on public.ai_reports
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reports: insert own" on public.ai_reports
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reports: update own" on public.ai_reports
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
