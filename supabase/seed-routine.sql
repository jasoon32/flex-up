-- 1) Migration for databases created before rep ranges existed.
alter table public.plan_exercises
  add column if not exists target_reps_max smallint
  check (target_reps_max is null or target_reps_max between 1 and 100);

-- 2) Load the ULPPL routine (Mon Upper, Tue Lower, Wed rest, Thu Push, Fri Pull,
--    Sat Legs, Sun run) into the project's only user account.
--    Plans that already exist with the same name are skipped, so this is safe to re-run.
do $$
declare
  uid uuid;
  users int;
  plan record;
  pid uuid;
begin
  select count(*) into users from auth.users;
  if users <> 1 then
    raise exception 'Expected exactly 1 user account, found %. Edit this script to pick one.', users;
  end if;
  select id into uid from auth.users limit 1;

  for plan in
    select * from (values
      ('Upper', array[1]::smallint[], 1),
      ('Lower', array[2]::smallint[], 2),
      ('Push',  array[4]::smallint[], 3),
      ('Pull',  array[5]::smallint[], 4),
      ('Legs',  array[6]::smallint[], 5)
    ) as p(name, days, sort)
    order by sort
  loop
    if exists (select 1 from public.workout_plans where user_id = uid and name = plan.name) then
      raise notice 'Skipping %, it already exists', plan.name;
      continue;
    end if;

    insert into public.workout_plans (user_id, name, days, created_at)
    values (uid, plan.name, plan.days, now() + make_interval(secs => plan.sort))
    returning id into pid;

    insert into public.plan_exercises (plan_id, user_id, name, target_sets, target_reps, target_reps_max, position)
    select pid, uid, e.name, e.sets, e.reps, e.reps_max, e.pos - 1
    from (values
      -- Upper
      ('Upper', 1, 'Incline DB Bench Press', 3, 6, 8),
      ('Upper', 2, 'Pec Deck', 2, 10, 12),
      ('Upper', 3, 'Neutral-Grip Pull-Ups', 3, 6, 8),
      ('Upper', 4, 'Lateral Raise', 2, 8, 10),
      ('Upper', 5, 'Pendlay Row', 2, 8, 10),
      ('Upper', 6, 'Cable Overhead Triceps Extension', 2, 8, 10),
      ('Upper', 7, 'Preacher Curl', 2, 8, 10),
      ('Upper', 8, 'Abs Crunch Machine', 3, 12, 15),
      ('Upper', 9, 'Captain''s Chair', 3, 10, 15),
      -- Lower
      ('Lower', 1, 'Leg Curl', 2, 10, 15),
      ('Lower', 2, 'Smith Machine Squat', 3, 8, 12),
      ('Lower', 3, 'Dumbbell Romanian Deadlift', 3, 8, 12),
      ('Lower', 4, 'Leg Extension', 2, 10, 15),
      ('Lower', 5, 'Hip Adductor', 2, 12, 20),
      ('Lower', 6, 'Hip Abductor', 2, 12, 20),
      ('Lower', 7, 'Calf Raise', 3, 10, 15),
      ('Lower', 8, 'Abs Crunch Machine', 3, 12, 15),
      ('Lower', 9, 'Captain''s Chair', 3, 10, 15),
      -- Push
      ('Push', 1, 'Smith Machine Flat Bench Press', 3, 6, 8),
      ('Push', 2, 'Pec Deck', 2, 10, 12),
      ('Push', 3, 'High-to-Low Cable Fly', 2, 10, 12),
      ('Push', 4, 'Shoulder Press', 3, 8, 10),
      ('Push', 5, 'Lateral Raise', 2, 8, 10),
      ('Push', 6, 'Triceps Pushdown', 2, 8, 10),
      ('Push', 7, 'Cable Overhead Triceps Extension', 2, 8, 10),
      ('Push', 8, 'Abs Crunch Machine', 3, 12, 15),
      ('Push', 9, 'Captain''s Chair', 3, 10, 15),
      -- Pull
      ('Pull', 1, 'Neutral-Grip Pull-Ups', 3, 6, 8),
      ('Pull', 2, 'Machine Lat Pulldown', 3, 8, 12),
      ('Pull', 3, 'Seated DB Row', 3, 8, 12),
      ('Pull', 4, 'Back Pulldown + Row', 3, 8, 12),
      ('Pull', 5, 'Rear Delt Machine', 2, 10, 15),
      ('Pull', 6, 'DB Bicep Curl', 2, 8, 12),
      ('Pull', 7, 'Preacher Curl', 2, 8, 10),
      ('Pull', 8, 'Abs Crunch Machine', 3, 12, 15),
      ('Pull', 9, 'Captain''s Chair', 3, 10, 15),
      -- Legs
      ('Legs', 1, 'Leg Curl', 2, 10, 15),
      ('Legs', 2, 'Smith Machine Squat', 3, 8, 12),
      ('Legs', 3, 'Dumbbell Romanian Deadlift', 3, 8, 12),
      ('Legs', 4, 'Leg Extension', 2, 10, 15),
      ('Legs', 5, 'Hip Adductor', 2, 12, 20),
      ('Legs', 6, 'Hip Abductor', 2, 12, 20),
      ('Legs', 7, 'Calf Raise', 3, 10, 15),
      ('Legs', 8, 'Abs Crunch Machine', 3, 12, 15),
      ('Legs', 9, 'Captain''s Chair', 3, 10, 15)
    ) as e(plan_name, pos, name, sets, reps, reps_max)
    where e.plan_name = plan.name;

    raise notice 'Added %', plan.name;
  end loop;
end $$;

-- Shows what was loaded.
select p.name as plan, p.days, count(e.id) as exercises
from public.workout_plans p
left join public.plan_exercises e on e.plan_id = p.id
group by p.id, p.name, p.days, p.created_at
order by p.created_at;
