-- Flex Up Next — warm-up sets, body weight, exercise notes and friends.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again.
-- Everything here is additive, so the current Flex Up keeps working against the same database.

-- ---------------------------------------------------------------------------
-- Set types: warm-up sets are logged but don't count toward volume or records.
-- ---------------------------------------------------------------------------

alter table public.session_sets
  add column if not exists set_type text not null default 'normal'
  check (set_type in ('normal', 'warmup', 'drop', 'failure'));

-- ---------------------------------------------------------------------------
-- Body weight: one entry per day.
-- ---------------------------------------------------------------------------

create table if not exists public.body_weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null default current_date,
  weight     numeric(5, 1) not null check (weight between 20 and 900),
  unit       text not null default 'kg' check (unit in ('kg', 'lb')),
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

alter table public.body_weights enable row level security;

drop policy if exists "body weights: select own" on public.body_weights;
drop policy if exists "body weights: insert own" on public.body_weights;
drop policy if exists "body weights: update own" on public.body_weights;
drop policy if exists "body weights: delete own" on public.body_weights;

create policy "body weights: select own" on public.body_weights
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "body weights: insert own" on public.body_weights
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "body weights: update own" on public.body_weights
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "body weights: delete own" on public.body_weights
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Exercise notes: one sticky note per exercise ("seat on 4"), shown every workout.
-- ---------------------------------------------------------------------------

create table if not exists public.exercise_notes (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_name text not null check (char_length(btrim(exercise_name)) between 1 and 60),
  note          text not null check (char_length(note) <= 300),
  updated_at    timestamptz not null default now(),
  primary key (user_id, exercise_name)
);

alter table public.exercise_notes enable row level security;

drop policy if exists "notes: select own" on public.exercise_notes;
drop policy if exists "notes: insert own" on public.exercise_notes;
drop policy if exists "notes: update own" on public.exercise_notes;
drop policy if exists "notes: delete own" on public.exercise_notes;

create policy "notes: select own" on public.exercise_notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notes: insert own" on public.exercise_notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notes: update own" on public.exercise_notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "notes: delete own" on public.exercise_notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Friends: everyone gets a 6-character code; adding a code makes two people friends.
-- Friends see each other's name, lifter and this week's totals, nothing else, and only
-- through friends_week(). The tables themselves are reachable only by these functions.
-- ---------------------------------------------------------------------------

create table if not exists public.friend_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code    text not null unique check (code ~ '^[A-Z2-9]{6}$')
);

create table if not exists public.friendships (
  user_id    uuid not null references auth.users (id) on delete cascade,
  friend_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists friendships_friend_idx on public.friendships (friend_id);

alter table public.friend_codes enable row level security;
alter table public.friendships  enable row level security;
-- No policies: the client reads and writes these only through the functions below.
revoke all on public.friend_codes, public.friendships from anon, authenticated;
revoke all on public.body_weights, public.exercise_notes from anon;

/** The caller's friend code, created the first time it's asked for. */
create or replace function public.my_friend_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  result text;
  -- No 0/O or 1/I, so a code read out loud can't be misheard.
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  select code into result from public.friend_codes where user_id = me;
  while result is null loop
    result := '';
    for i in 1..6 loop
      result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.friend_codes (user_id, code) values (me, result);
    exception when unique_violation then
      result := null;
      select code into result from public.friend_codes where user_id = me;
    end;
  end loop;
  return result;
end;
$$;

/** Becomes friends with the owner of `friend_code`. Errors: 'not_found', 'self'. */
create or replace function public.add_friend(friend_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  select user_id into other from public.friend_codes where code = upper(btrim(friend_code));
  if other is null then
    raise exception 'not_found';
  end if;
  if other = me then
    raise exception 'self';
  end if;
  insert into public.friendships (user_id, friend_id) values (me, other), (other, me)
    on conflict do nothing;
end;
$$;

/** Ends a friendship both ways. */
create or replace function public.remove_friend(friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from public.friendships
    where (user_id = me and friend_id = friend) or (user_id = friend and friend_id = me);
end;
$$;

/**
 * This week's leaderboard: the caller and their friends, with finished workouts, ticked
 * working sets and volume (kg, both hands on per-hand lifts) since `week_start`.
 */
create or replace function public.friends_week(week_start timestamptz)
returns table (
  user_id uuid,
  is_me boolean,
  name text,
  look jsonb,
  workouts integer,
  sets integer,
  volume numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  return query
  with people as (
    select me as id
    union
    select f.friend_id from public.friendships f where f.user_id = me
  ),
  done as (
    select s.id, s.user_id
    from public.workout_sessions s
    join people p on p.id = s.user_id
    where s.completed_at is not null and s.started_at >= week_start
  )
  select
    p.id,
    p.id = me,
    -- Never the email: a lifter without a name shows as the app's default name.
    nullif(btrim(u.raw_user_meta_data -> 'character' ->> 'name'), ''),
    u.raw_user_meta_data -> 'character',
    (select count(*)::integer from done d where d.user_id = p.id),
    (select count(*)::integer
       from public.session_sets ss join done d on d.id = ss.session_id
       where d.user_id = p.id and ss.completed and ss.set_type <> 'warmup'),
    (select coalesce(round(sum(
         coalesce(ss.weight, 0) * (case when ss.weight_unit = 'lb' then 0.45359237 else 1 end)
         * coalesce(ss.reps, 0) * (case when ss.per_side then 2 else 1 end))), 0)
       from public.session_sets ss join done d on d.id = ss.session_id
       where d.user_id = p.id and ss.completed and ss.set_type <> 'warmup')
  from people p
  join auth.users u on u.id = p.id;
end;
$$;

revoke all on function public.my_friend_code(), public.add_friend(text), public.remove_friend(uuid),
  public.friends_week(timestamptz) from public, anon;
grant execute on function public.my_friend_code(), public.add_friend(text), public.remove_friend(uuid),
  public.friends_week(timestamptz) to authenticated;
