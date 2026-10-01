import { createStore } from 'zustand/vanilla';

/** A message for the user, shown as a toast: an error, or news about an action. */
export type Notice = { readonly id: number; readonly message: string; readonly kind: NoticeKind };
export type NoticeKind = 'error' | 'info';

type NoticeState = { readonly notices: readonly Notice[] };

let nextId = 0;

/** Messages the user should see, from anywhere in the app. */
export const notices = createStore<NoticeState>()(() => ({ notices: [] }));

export function notify(message: string, kind: NoticeKind = 'error'): void {
  const { notices: current } = notices.getState();
  // The same message twice in a row is one toast, not a stack.
  if (current.at(-1)?.message === message) {
    return;
  }
  notices.setState({ notices: [...current, { id: nextId++, message, kind }] });
}

export function dismissNotice(id: number): void {
  notices.setState({ notices: notices.getState().notices.filter((notice) => notice.id !== id) });
}
