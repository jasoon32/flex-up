import { Alert as NativeAlert, Platform, type AlertButton } from 'react-native';

export interface WebDialog {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

type Show = (dialog: WebDialog) => void;
let show: Show | null = null;

/** Lets <AlertHost /> show dialogs on web; returns a function that unregisters it. */
export function registerAlertHost(fn: Show) {
  show = fn;
  return () => {
    if (show === fn) show = null;
  };
}

/**
 * Drop-in for React Native's Alert. On web, where Alert.alert does nothing, the app's own
 * dialog (<AlertHost />) shows every button just like the phone; before it has mounted,
 * the browser's alert/confirm is the fallback (a confirm() runs the last non-cancel button).
 */
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons);

    const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    if (show) return show({ title, message, buttons: list });

    const text = message ? `${title}\n\n${message}` : title;
    const actions = list.filter((b) => b.style !== 'cancel');
    if (actions.length === 0) {
      window.alert(text);
      list[0]?.onPress?.();
      return;
    }
    const action = actions[actions.length - 1];
    if (window.confirm(`${text}\n\n→ ${action.text ?? 'OK'}?`)) action.onPress?.();
    else list.find((b) => b.style === 'cancel')?.onPress?.();
  },
};
