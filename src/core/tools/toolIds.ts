/** Tools that create shapes. Text arrives in M3d; selection in M4. */
export type ToolId = 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'pen';

export const DEFAULT_TOOL: ToolId = 'rectangle';

/** Single-key shortcuts (PRD 1A), matched case-insensitively. */
export const TOOL_SHORTCUTS: Readonly<Record<string, ToolId>> = {
  r: 'rectangle',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  p: 'pen',
};
