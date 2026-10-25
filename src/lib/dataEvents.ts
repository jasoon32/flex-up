type Listener = () => void;
const listeners = new Set<Listener>();

/** Tells every screen showing data to load it again (e.g. after an undo restored a workout). */
export function notifyDataChanged() {
  listeners.forEach((l) => l());
}

/** Calls `listener` whenever data changes; returns a function that stops listening. */
export function onDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
