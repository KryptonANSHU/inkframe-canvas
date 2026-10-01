/** Surfaces errors so they are never swallowed. Moves to toasts in M7. */
export function reportError(error: Error): void {
  // eslint-disable-next-line no-console -- the only error surface until toasts exist (M7)
  console.error(error);
}
