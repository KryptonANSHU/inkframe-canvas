import { z } from 'zod';

/**
 * The plugin protocol: every message between the editor and a plugin's sandboxed
 * iframe. Plugin messages are untrusted input, so each one is validated here before the
 * host looks at it; anything that doesn't match is dropped.
 */

/** Marks our messages, so stray postMessages from other code are ignored. */
export const PROTOCOL = 'inkframe-plugin';
/** Version of the message envelope itself. */
export const PROTOCOL_VERSION = 1;
/** Plugin API versions this host can serve; a plugin asks for one in its handshake. */
export const SUPPORTED_API_VERSIONS: readonly number[] = [1];

/** Resource limits (security rules): enforced by the host for every plugin. */
export const LIMITS = {
  /** Calls without an answer by then fail in the plugin. */
  callTimeoutMs: 2000,
  /** A plugin that hasn't said hello by then is stopped. */
  handshakeTimeoutMs: 3000,
  /** Larger messages are rejected. */
  maxMessageBytes: 256 * 1024,
  /** More calls than this in any one second stops the plugin as a flood. */
  maxCallsPerSecond: 50,
  /** Shapes one call may create or change. */
  maxShapesPerCall: 500,
} as const;

export const PERMISSIONS = ['selection:read', 'shapes:create', 'shapes:update', 'notify'] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const METHODS = ['selection.get', 'shapes.create', 'shapes.update', 'notify'] as const;
export type Method = (typeof METHODS)[number];

/** What each API method needs; calls outside the granted list are rejected. */
export const METHOD_PERMISSION: Readonly<Record<Method, Permission>> = {
  'selection.get': 'selection:read',
  'shapes.create': 'shapes:create',
  'shapes.update': 'shapes:update',
  notify: 'notify',
};

/** What a plugin declares about itself in its handshake, and asks the user to approve. */
export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'lower-case letters, digits, and dashes'),
  name: z.string().trim().min(1).max(60),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'a version like 1.0.0'),
  permissions: z.array(z.enum(PERMISSIONS)).max(PERMISSIONS.length),
});
export type Manifest = z.infer<typeof manifestSchema>;

const envelope = { protocol: z.literal(PROTOCOL), version: z.literal(PROTOCOL_VERSION) };

/** Every message a plugin may send. */
export const pluginMessageSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelope,
    type: z.literal('handshake'),
    apiVersion: z.number().int().positive(),
    manifest: manifestSchema,
  }),
  z.object({
    ...envelope,
    type: z.literal('call'),
    id: z.number().int().nonnegative(),
    method: z.enum(METHODS),
    // Checked per method by the API, once the permission is known to be granted.
    params: z.unknown(),
  }),
  z.object({
    ...envelope,
    type: z.literal('crashed'),
    message: z.string().max(500),
  }),
]);
export type PluginMessage = z.infer<typeof pluginMessageSchema>;

export type ErrorCode =
  | 'permission-denied'
  | 'invalid-params'
  | 'too-large'
  | 'too-many-shapes'
  | 'not-ready'
  | 'not-found';

export type CallError = { readonly code: ErrorCode; readonly message: string };

/** Every message the host sends to a plugin. */
export type HostMessage = { readonly protocol: typeof PROTOCOL; readonly version: number } & (
  | { readonly type: 'handshake-ok'; readonly apiVersion: number }
  | { readonly type: 'refused'; readonly reason: string }
  | { readonly type: 'start'; readonly permissions: readonly Permission[] }
  | { readonly type: 'result'; readonly id: number; readonly ok: true; readonly value: unknown }
  | { readonly type: 'result'; readonly id: number; readonly ok: false; readonly error: CallError }
);

type Unenveloped<T> = T extends unknown ? Omit<T, 'protocol' | 'version'> : never;

export function hostMessage(message: Unenveloped<HostMessage>): HostMessage {
  return { protocol: PROTOCOL, version: PROTOCOL_VERSION, ...message };
}
