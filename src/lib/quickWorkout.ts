import { router } from 'expo-router';
import { startQuickSession } from '@/data/sessions';
import { strings } from '@/i18n';
import { Alert } from './alert';
import { errorMessage } from './errors';
import { checkUnfinished } from './unfinished';

/** Starts an empty workout (or resumes an unfinished one, if the user picks that) and opens it. */
export async function openQuickWorkout(): Promise<void> {
  const other = await checkUnfinished('Quick Workout');
  if (other.action === 'cancel') return;
  if (other.action === 'resume') return router.push(`/workout/${other.id}`);
  try {
    const id = await startQuickSession();
    router.push(`/workout/${id}`);
  } catch (e) {
    Alert.alert(strings().home.couldntStart, errorMessage(e));
  }
}
