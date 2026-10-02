import { useSyncExternalStore } from 'react';

/** The phone layout's breakpoint; the CSS media queries use the same 640px. */
const PHONE = '(max-width: 640px)';

const subscribe = (onChange: () => void) => {
  const query = matchMedia(PHONE);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
};

/** True on phone-sized screens, updating as the window is resized or rotated. */
export function usePhoneLayout(): boolean {
  return useSyncExternalStore(subscribe, () => matchMedia(PHONE).matches);
}
