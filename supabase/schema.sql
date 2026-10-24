-- Flex Up — MVP schema
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Every table is private per user, enforced by Row Level Security.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.workout_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  -- Days of the week this plan is scheduled on. 0 = Sunday … 6 = Saturday.
  days        smallint[] not null default '{}'
              check (days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  created_at  timestamptz not null default now()
);

create table if not exists public.plan_exercises (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid not null references public.workout_plans (id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 60),
  target_sets    smallint not null default 3 check (target_sets between 1 and 20),
  target_reps    smallint not null default 10 check (target_reps between 1 and 100),
  -- Top of a rep range ("6–8" → 8); null for a single target.
  target_reps_max smallint check (target_reps_max is null or target_reps_max between 1 and 100),
  target_weight  numeric(6, 2) check (target_weight is null or target_weight between 0 and 2000),
  -- Rest after each set in seconds; null uses the app's default.
  rest_seconds   smallint check (rest_seconds is null or rest_seconds between 10 and 600),
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

-- Databases created before rest times existed.
alter table public.plan_exercises
  add column if not exists rest_seconds smallint
  check (rest_seconds is null or rest_seconds between 10 and 600);

-- A logged training session. plan_name is a snapshot so history survives
-- renaming or deleting the plan.
create table if not exists public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_id       uuid references public.workout_plans (id) on delete set null,
  plan_name     text not null check (char_length(btrim(plan_name)) between 1 and 60),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz,
  notes         text check (notes is null or char_length(notes) <= 500)
);

-- One row per logged set. exercise_name is a snapshot for the same reason.
create table if not exists public.session_sets (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.workout_sessions (id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_name   text not null check (char_length(btrim(exercise_name)) between 1 and 60),
  exercise_order  integer not null default 0,
  set_number      smallint not null check (set_number between 1 and 50),
  reps            smallint check (reps is null or reps between 0 and 1000),
  weight          numeric(6, 2) check (weight is null or weight between 0 and 2000),
  rpe             numeric(3, 1) check (rpe is null or rpe between 1 and 10),
  completed       boolean not null default false,
  created_at      timestamptz not null default now()
);

-- Weight unit per exercise (kg, lb, or bw = bodyweight with optional added kg), and
-- per-hand lifts whose volume counts both sides. Sets keep a snapshot of both.
alter table public.plan_exercises
  add column if not exists weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb', 'bw')),
  add column if not exists per_side boolean not null default false;
alter table public.session_sets
  add column if not exists weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb', 'bw')),
  add column if not exists per_side boolean not null default false;

create index if not exists workout_plans_user_idx    on public.workout_plans (user_id);
create index if not exists plan_exercises_plan_idx   on public.plan_exercises (plan_id);
create index if not exists plan_exercises_user_idx   on public.plan_exercises (user_id);
create index if not exists workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);
create index if not exists workout_sessions_plan_idx on public.workout_sessions (plan_id);
create index if not exists session_sets_session_idx  on public.session_sets (session_id);
create index if not exists session_sets_user_idx     on public.session_sets (user_id);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user can only ever see or change their own rows,
-- and child rows can only point at parents the same user owns.
-- ---------------------------------------------------------------------------

alter table public.workout_plans    enable row level security;
alter table public.plan_exercises   enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.session_sets     enable row level security;

-- workout_plans
drop policy if exists "plans: select own" on public.workout_plans;
drop policy if exists "plans: insert own" on public.workout_plans;
drop policy if exists "plans: update own" on public.workout_plans;
drop policy if exists "plans: delete own" on public.workout_plans;

create policy "plans: select own" on public.workout_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "plans: insert own" on public.workout_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plans: update own" on public.workout_plans
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "plans: delete own" on public.workout_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

-- plan_exercises
drop policy if exists "exercises: select own" on public.plan_exercises;
drop policy if exists "exercises: insert own" on public.plan_exercises;
drop policy if exists "exercises: update own" on public.plan_exercises;
drop policy if exists "exercises: delete own" on public.plan_exercises;

create policy "exercises: select own" on public.plan_exercises
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "exercises: insert own" on public.plan_exercises
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workout_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );
create policy "exercises: update own" on public.plan_exercises
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workout_plans p
      where p.id = plan_id and p.user_id = (select auth.uid())
    )
  );
create policy "exercises: delete own" on public.plan_exercises
  for delete to authenticated using ((select auth.uid()) = user_id);

-- workout_sessions
drop policy if exists "sessions: select own" on public.workout_sessions;
drop policy if exists "sessions: insert own" on public.workout_sessions;
drop policy if exists "sessions: update own" on public.workout_sessions;
drop policy if exists "sessions: delete own" on public.workout_sessions;

create policy "sessions: select own" on public.workout_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sessions: insert own" on public.workout_sessions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and (
      plan_id is null
      or exists (
        select 1 from public.workout_plans p
        where p.id = plan_id and p.user_id = (select auth.uid())
      )
    )
  );
create policy "sessions: update own" on public.workout_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      plan_id is null
      or exists (
        select 1 from public.workout_plans p
        where p.id = plan_id and p.user_id = (select auth.uid())
      )
    )
  );
create policy "sessions: delete own" on public.workout_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- session_sets
drop policy if exists "sets: select own" on public.session_sets;
drop policy if exists "sets: insert own" on public.session_sets;
drop policy if exists "sets: update own" on public.session_sets;
drop policy if exists "sets: delete own" on public.session_sets;

create policy "sets: select own" on public.session_sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sets: insert own" on public.session_sets
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
create policy "sets: update own" on public.session_sets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = (select auth.uid())
    )
  );
create policy "sets: delete own" on public.session_sets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Anonymous (signed-out) clients get no access at all.
revoke all on public.workout_plans, public.plan_exercises,
              public.workout_sessions, public.session_sets from anon;
