import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

/**
 * Drop-in for React Native's Alert. On web, where Alert.alert does nothing,
 * falls back to the browser's alert/confirm: a dialog with a non-cancel
 * button becomes a confirm() that runs that button when accepted.
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons);

    const text = message ? `${title}\n\n${message}` : title;
    const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
    if (actions.length === 0) {
      window.alert(text);
      buttons?.[0]?.onPress?.();
      return;
    }
    // With several actions, the last one is the primary choice (e.g. "Finish & discard").
    const action = actions[actions.length - 1];
    if (window.confirm(`${text}\n\n→ ${action.text ?? 'OK'}?`)) action.onPress?.();
    else buttons?.find((b) => b.style === 'cancel')?.onPress?.();
  },
};
