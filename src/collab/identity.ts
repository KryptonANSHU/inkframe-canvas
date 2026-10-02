import { peerColors } from '../design/tokens';

/** How this user appears to others: a friendly name and a color, kept per browser. */
export type Identity = { readonly name: string; readonly color: string };

const STORAGE_KEY = 'inkframe.collab.identity';
const ADJECTIVES = [
  'Coral',
  'Amber',
  'Mossy',
  'Swift',
  'Quiet',
  'Bright',
  'Misty',
  'Brave',
  'Lucky',
  'Sunny',
];
const ANIMALS = ['fox', 'heron', 'otter', 'lynx', 'wren', 'badger', 'koi', 'moth', 'hare', 'owl'];

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('Nothing to pick from.');
  return item;
}

/** The same name and color across visits, so collaborators recognize each other. */
export function loadIdentity(): Identity {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (isIdentity(saved)) return saved;
  } catch {
    // Blocked or corrupt storage: a fresh identity this time.
  }
  const identity = { name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: pick(peerColors) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Not remembered; it still works for this visit.
  }
  return identity;
}

function isIdentity(value: unknown): value is Identity {
  if (typeof value !== 'object' || value === null) return false;
  const { name, color } = value as Record<string, unknown>;
  return (
    typeof name === 'string' &&
    name.length <= 40 &&
    typeof color === 'string' &&
    peerColors.includes(color)
  );
}
