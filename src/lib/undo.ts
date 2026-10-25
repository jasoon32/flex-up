export interface UndoOffer {
  message: string;
  /** Puts things back; a rejection shows "couldn't restore". */
  undo: () => Promise<void>;
}

type Show = (offer: UndoOffer) => void;
let show: Show | null = null;

/** Lets <UndoBar /> show offers; returns a function that unregisters it. */
export function registerUndoHost(fn: Show) {
  show = fn;
  return () => {
    if (show === fn) show = null;
  };
}

/** Shows "message · Undo" at the bottom of the screen for a few seconds. */
export function offerUndo(offer: UndoOffer) {
  show?.(offer);
}
