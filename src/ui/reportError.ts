import { notify } from './notifications';

/** Surfaces errors so they are never swallowed: a toast for the user, the console for us. */
export function reportError(error: Error): void {
  // eslint-disable-next-line no-console -- the full error, with its cause, for debugging
  console.error(error);
  notify(error.message);
}
