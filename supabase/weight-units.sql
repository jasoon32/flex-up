-- Flex Up — per-exercise weight units (kg / lb / bodyweight) and per-hand lifts.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again.

alter table public.plan_exercises
  add column if not exists weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb', 'bw')),
  add column if not exists per_side boolean not null default false;
alter table public.session_sets
  add column if not exists weight_unit text not null default 'kg' check (weight_unit in ('kg', 'lb', 'bw')),
  add column if not exists per_side boolean not null default false;

-- Bodyweight exercises: a blank weight means bodyweight, a number is added weight.
update public.plan_exercises set weight_unit = 'bw' where name in ('Neutral-Grip Pull-Ups', 'Captain''s Chair');
update public.session_sets set weight_unit = 'bw' where exercise_name in ('Neutral-Grip Pull-Ups', 'Captain''s Chair');

-- Dumbbell lifts logged per hand: volume counts both hands.
update public.plan_exercises set per_side = true
  where name in ('Incline DB Bench Press', 'DB Bicep Curl', 'Dumbbell Romanian Deadlift', 'Lateral Raise');
update public.session_sets set per_side = true
  where exercise_name in ('Incline DB Bench Press', 'DB Bicep Curl', 'Dumbbell Romanian Deadlift', 'Lateral Raise');
