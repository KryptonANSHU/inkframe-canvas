export type ToolId = 'select' | 'rectangle' | 'ellipse' | 'line' | 'arrow' | 'pen' | 'text';

export const DEFAULT_TOOL: ToolId = 'select';

/** Single-key shortcuts (PRD 1A), matched case-insensitively. */
export const TOOL_SHORTCUTS: Readonly<Record<string, ToolId>> = {
  v: 'select',
  r: 'rectangle',
  o: 'ellipse',
  l: 'line',
  a: 'arrow',
  p: 'pen',
  t: 'text',
};
