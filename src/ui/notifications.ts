import { createStore } from 'zustand/vanilla';

/** A message for the user, shown as a toast until dismissed. */
export type Notice = { readonly id: number; readonly message: string };

type NoticeState = { readonly notices: readonly Notice[] };

let nextId = 0;

/** Errors the user should hear about, from anywhere in the app. */
export const notices = createStore<NoticeState>()(() => ({ notices: [] }));

export function notify(message: string): void {
  const { notices: current } = notices.getState();
  // The same message twice in a row is one toast, not a stack.
  if (current.at(-1)?.message === message) {
    return;
  }
  notices.setState({ notices: [...current, { id: nextId++, message }] });
}

export function dismissNotice(id: number): void {
  notices.setState({ notices: notices.getState().notices.filter((notice) => notice.id !== id) });
}
