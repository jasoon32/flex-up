import { getActiveSession } from '@/data/sessions';
import { trName } from '@/data/names';
import { strings } from '@/i18n';
import { Alert } from './alert';

export type UnfinishedChoice = { action: 'start' } | { action: 'resume'; id: string } | { action: 'cancel' };

/**
 * Before starting a workout: if another one is still unfinished, ask whether to resume it or
 * start the new one anyway, so a half-done workout doesn't quietly drop out of sight on Home.
 */
export async function checkUnfinished(nextPlanName: string): Promise<UnfinishedChoice> {
  const active = await getActiveSession().catch(() => null);
  if (!active) return { action: 'start' };
  const t = strings();
  return new Promise((resolve) =>
    Alert.alert(
      t.home.unfinishedQ,
      t.home.unfinishedMsg(trName(active.plan_name, 'plan'), trName(nextPlanName.trim(), 'plan') || '—'),
      [
        { text: t.common.cancel, style: 'cancel', onPress: () => resolve({ action: 'cancel' }) },
        { text: t.home.resumeWorkout, onPress: () => resolve({ action: 'resume', id: active.id }) },
        // Last is the primary choice (and the one the web confirm() offers): the user did tap Start.
        { text: t.home.startAnyway, onPress: () => resolve({ action: 'start' }) },
      ],
    ),
  );
}
