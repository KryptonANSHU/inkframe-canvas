import type { Permission } from '../plugins/protocol';
import type { PluginState } from '../plugins/session';

/** What each permission lets a plugin do, in the user's words. */
export const PERMISSION_TEXT: Readonly<Record<Permission, string>> = {
  'selection:read': 'See the shapes you select',
  'shapes:create': 'Add shapes to your drawing',
  'shapes:update': 'Change shapes in your drawing',
  notify: 'Show you messages',
};

/** Short labels for the permission chips in the panel. */
export const PERMISSION_LABEL: Readonly<Record<Permission, string>> = {
  'selection:read': 'Read selection',
  'shapes:create': 'Add shapes',
  'shapes:update': 'Change shapes',
  notify: 'Messages',
};

export function stateText(state: PluginState): string {
  switch (state.kind) {
    case 'loading':
      return 'Starting…';
    case 'approving':
      return 'Waiting for your approval';
    case 'running':
      return 'Running';
    case 'stopped':
      return state.reason;
  }
}
