# Flex Up — MVP Workout Tracker

A mobile workout tracker built with **Expo (SDK 58) + Expo Router + Supabase**.
Create workout plans, schedule them on days of the week, log sets / reps / weight / RPE,
and review your training history. A pixel-art placeholder character sits on the home screen
as the foundation for future progression features.

The UI follows the **"Flex Up — MVP Screens"** design canvas: warm grey ground `#F4F4F0`, ink `#111111`,
lime accent `#C6F432`, Space Grotesk headings and Inter body text. All tokens live in `src/theme.ts`.

## Features (MVP)

- Email + password accounts (Supabase Auth); the session persists on the device.
- **Home**: placeholder character, week strip, today's scheduled workouts with
  *Start / Resume / ✓ Completed* status, and a banner to resume any unfinished workout.
- **Plans**: create, rename, and delete plans; assign them to days of the week; add, edit,
  reorder, and delete exercises (target sets × reps @ weight).
- **Workout logging**: sets are pre-filled from the plan, with last time's weights. A "Last"
  column shows what you lifted for each set last time. Edit weight, reps, and optional RPE
  (1–10), tick sets done (reps are required to tick), add sets, long-press a set number to
  delete it, and add extra exercises mid-workout. *Finish* marks the workout completed
  (optionally discarding unticked sets) and shows a "Workout saved" summary. Finished workouts
  can be edited, reopened, or deleted.
- **History**: every session with date, duration, sets completed, and volume. Tap one to
  review or edit it.
- **Settings** tab: switch the whole app between **English** and **简体中文** (remembered on the
  device; also switchable on the sign-in screen), see your account, and sign out. All strings
  live in `src/i18n/en.ts` and `src/i18n/zh.ts`.
- Rep ranges: plan targets can be a single number or a range like `6-8`.
- Validation on every input (client side **and** database `CHECK` constraints), plus
  friendly error messages for network, auth, and permission failures.

## 1. Set up Supabase

1. Create a free project at <https://supabase.com/dashboard>.
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql),
   and click **Run**. This creates the 4 tables, indexes, and Row Level Security policies.
   The script is safe to run again.
   - Databases created before rep ranges existed: run [`supabase/seed-routine.sql`](supabase/seed-routine.sql)
     (it adds the `target_reps_max` column). The same script also loads the ULPPL routine into the
     project's only user account, skipping plans that already exist.
3. **Authentication → Sign In / Providers → Email**: make sure Email is enabled.
   - For quick testing, you can turn **off** "Confirm email" so new accounts sign in immediately.
     If you leave it on, the app tells you to confirm via the emailed link first.
     (The link opens in a browser; then come back and sign in.)
4. **Project Settings → API** (or the **Connect** button): copy the **Project URL** and the
   **Publishable key** (called the `anon` key on older projects).

### Data model & security

| Table              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `workout_plans`    | Named plan + `days` (`smallint[]`, 0 = Sun … 6 = Sat)            |
| `plan_exercises`   | Exercises in a plan with targets and order (`position`)        |
| `workout_sessions` | One logged workout. `completed_at` is null while in progress   |
| `session_sets`     | Logged sets: weight, reps, RPE, completed                      |

RLS is enabled on every table. Users can only select, insert, update, or delete rows where
`user_id = auth.uid()`. Inserts and updates of child rows also check that the parent plan or
session belongs to the same user. Signed-out (`anon`) clients have no access. Sessions and
sets store snapshots of the plan and exercise names, so history survives when a plan is
edited or deleted.

## 2. Environment variables

Copy `.env.example` to **`.env.local`** (git-ignored) and fill in:

| Variable                               | Where to find it                       |
| -------------------------------------- | -------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`             | Project Settings → API → Project URL   |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Project Settings → API → Publishable / anon key |

`EXPO_PUBLIC_*` values are bundled into the app, so **never** put the `service_role` / secret
key or the database password here. RLS is what protects the data. If the variables are
missing, the app shows a setup screen instead of crashing.

## 3. Run on your iPhone with Expo Go

Requirements: Node.js LTS, the **Expo Go** app from the App Store, and an iPhone that supports
the current Expo Go (SDK 58).

```bash
npm install
npx expo start
```

Scan the QR code with the iPhone **Camera** app; it opens in Expo Go. Your phone and computer
must be on the same Wi‑Fi network. If they can't connect (public Wi‑Fi, VPN, or Windows
firewall), use a tunnel instead:

```bash
npx expo start --tunnel
```

After changing `.env.local`, restart with `npx expo start --clear`.

## Manual test checklist (main flows)

1. Create an account → you land on Home with the character and "No plans yet".
2. Plans → **+ New plan** → name it, select today + another day → Create.
3. Add 2–3 exercises; edit one; reorder with the arrows; delete one.
4. Home now shows the plan under **Today** → **Start workout**.
5. Change a weight, reps, and RPE (try invalid values like `RPE 15` → you get an error and
   the value reverts). Tick some sets, **+ Add set**, **+ Add exercise**.
6. Leave the screen mid-workout → Home shows **Resume**.
7. **Finish workout** → choose to discard unticked sets → Home shows **✓ Completed**.
8. History lists the session; open it, edit a set, reopen or delete it.
9. Sign out, then sign in with a second account → the first account's data is not visible.
10. Turn on Airplane mode and try saving → you see a "No connection" message and nothing breaks.

## Project structure

```
src/
  app/                    Expo Router routes (every file is a screen)
    _layout.tsx           Root stack + auth guard (Stack.Protected)
    sign-in.tsx
    (tabs)/               Home, Plans, History tabs
    plan/[id].tsx         Create ("new") / edit a plan and its exercises
    workout/[id].tsx      Log or review a workout session
  components/             UI primitives, PixelCharacter, SetRow, ExerciseEditor, DayPicker
  data/                   All Supabase queries (plans.ts, sessions.ts)
  hooks/                  useFocusData (reload on screen focus)
  lib/                    supabase client, types, validation, errors, date helpers
  providers/              AuthProvider (session state)
  theme.ts                Colors, spacing, weight unit
supabase/schema.sql       Database schema + RLS policies
```

Screens never call Supabase directly. They go through `src/data/*`, so the storage layer can
change (offline cache, edge functions, and so on) without touching the UI.

## Extending later

The MVP intentionally leaves out XP, levels, achievements, AI features, shop or payments, and
social sharing. Natural extension points:

- **Character**: replace `src/components/PixelCharacter.tsx` (the sprite is a simple grid)
  with real art or customization. Equipped items would go in a new `profiles` table.
- **Progression**: derive XP from `session_sets` (for example, in a Postgres view or edge
  function) without changing the logging flow.
- **Units**: `WEIGHT_UNIT` in `src/theme.ts`; add a user setting when needed.

## Scripts

```bash
npx tsc --noEmit     # typecheck
npx expo lint        # lint
npx expo-doctor      # dependency health check
```

> `.npmrc` sets `legacy-peer-deps=true` because an optional web-only dependency of
> expo-router declares a stricter React peer range than SDK 58 ships.
