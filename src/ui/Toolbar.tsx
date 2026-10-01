import {
  Circle,
  Lock,
  LockOpen,
  MousePointer2,
  MoveUpRight,
  Pencil,
  Slash,
  Square,
  Type,
  type LucideIcon,
} from 'lucide-react';
import type { MouseEvent } from 'react';
import { Toolbar as RadixToolbar } from 'radix-ui';
import type { ToolId } from '../core/tools/toolIds';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor, useEditorState } from './EditorContext';
import { Tip } from './Tip';
import styles from './Toolbar.module.css';

const TOOLS: readonly { id: ToolId; label: string; key: string; Icon: LucideIcon }[] = [
  { id: 'select', label: 'Select', key: 'V', Icon: MousePointer2 },
  { id: 'rectangle', label: 'Rectangle', key: 'R', Icon: Square },
  { id: 'ellipse', label: 'Ellipse', key: 'O', Icon: Circle },
  { id: 'line', label: 'Line', key: 'L', Icon: Slash },
  { id: 'arrow', label: 'Arrow', key: 'A', Icon: MoveUpRight },
  { id: 'pen', label: 'Pen', key: 'P', Icon: Pencil },
  { id: 'text', label: 'Text', key: 'T', Icon: Type },
];

/**
 * The drawing tools, top center. Arrow keys move between tools (Radix roving focus);
 * a pointer click hands focus straight back to the canvas, so shortcuts and drawing
 * carry on as before.
 */
export function Toolbar() {
  const editor = useEditor();
  const { activeTool, toolLocked } = useEditorState((state) => ({
    activeTool: state.activeTool,
    toolLocked: state.toolLocked,
  }));
  // detail is 0 for keyboard activation: keyboard users keep focus in the toolbar.
  const backToCanvas = (event: MouseEvent) => {
    if (event.detail > 0) editor.focus();
  };
  const LockIcon = toolLocked ? Lock : LockOpen;

  return (
    <RadixToolbar.Root className={styles.toolbar} aria-label="Tools">
      <RadixToolbar.ToggleGroup
        type="single"
        className={styles.group}
        value={activeTool}
        aria-label="Drawing tool"
        onValueChange={(tool) => {
          // Radix sends "" when the active item is clicked again; a tool stays chosen.
          if (tool !== '') editor.setTool(tool as ToolId);
        }}
      >
        {TOOLS.map(({ id, label, key, Icon }) => (
          <Tip key={id} label={label} shortcut={key}>
            <RadixToolbar.ToggleItem
              value={id}
              className={styles.tool}
              aria-label={label}
              aria-keyshortcuts={key}
              onClick={backToCanvas}
            >
              <Icon size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
            </RadixToolbar.ToggleItem>
          </Tip>
        ))}
      </RadixToolbar.ToggleGroup>
      <RadixToolbar.Separator className={styles.divider} />
      <Tip label={toolLocked ? 'Unlock tool' : 'Keep tool after drawing'} shortcut="Q">
        <RadixToolbar.Button
          className={styles.tool}
          aria-label="Keep tool after drawing"
          aria-pressed={toolLocked}
          aria-keyshortcuts="Q"
          onClick={(event) => {
            editor.perform('toggleLock');
            backToCanvas(event);
          }}
        >
          <LockIcon size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
        </RadixToolbar.Button>
      </Tip>
    </RadixToolbar.Root>
  );
}
