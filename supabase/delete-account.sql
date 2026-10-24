-- Flex Up — in-app account deletion (required by the App Store for apps with sign-up).
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run. Safe to run again.
--
-- A signed-in user can delete only their own account. Their plans, workouts and sets go with
-- it through the existing `on delete cascade` foreign keys to auth.users.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
