import { supabase } from '@/lib/supabase';
import { check, must } from '@/lib/errors';
import { strings } from '@/i18n';
import { mondayOf } from './progress';

export interface FriendRow {
  user_id: string;
  is_me: boolean;
  /** The friend's lifter name; null when they haven't named theirs. */
  name: string | null;
  /** Their saved lifter look (user metadata), drawn next to their name. */
  look: Record<string, unknown> | null;
  workouts: number;
  sets: number;
  volume: number;
}

/** Your 6-character friend code, made the first time it's asked for. */
export async function myFriendCode(): Promise<string> {
  return must(await supabase.rpc('my_friend_code')) as string;
}

/** Adds a friend by code; explains a wrong code or your own code in plain words. */
export async function addFriend(code: string): Promise<void> {
  const res = await supabase.rpc('add_friend', { friend_code: code.trim().toUpperCase() });
  if (res.error?.message.includes('not_found')) throw new Error(strings().friends.notFound);
  if (res.error?.message.includes('self')) throw new Error(strings().friends.ownCode);
  check(res);
}

export async function removeFriend(id: string): Promise<void> {
  check(await supabase.rpc('remove_friend', { friend: id }));
}

/** You and your friends this week (Monday on), most workouts first, then most sets. */
export async function friendsThisWeek(): Promise<FriendRow[]> {
  const rows = must(
    await supabase.rpc('friends_week', { week_start: mondayOf(new Date()).toISOString() }),
  ) as any[];
  return rows
    .map((r) => ({
      user_id: r.user_id,
      is_me: !!r.is_me,
      name: r.name ?? null,
      look: r.look ?? null,
      workouts: Number(r.workouts),
      sets: Number(r.sets),
      volume: Number(r.volume),
    }))
    .sort((a, b) => b.workouts - a.workouts || b.sets - a.sets || b.volume - a.volume);
}
