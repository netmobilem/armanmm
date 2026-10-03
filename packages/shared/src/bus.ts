export type BusEvent = { type: string } & Record<string, unknown>;

/** Reserved local-bus event type carrying an on-demand job (Redis-less fallback). */
export const LOCAL_JOB_EVENT = 'vira:job';

type Listener = (event: BusEvent) => void;
const listeners = new Set<Listener>();

/** Subscribe to in-process events. Returns an unsubscribe function. */
export function onLocalEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Emit an event to every in-process listener (used when Redis is unavailable). */
export function emitLocalEvent(event: BusEvent): void {
  for (const fn of [...listeners]) {
    try {
      fn(event);
    } catch {
      // a misbehaving listener must never break the emitter
    }
  }
}
