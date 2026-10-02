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
import {
  Toolbar as ToolbarRoot,
  ToolbarChoice,
  ToolbarOption,
  ToolbarSeparator,
  ToolbarToggle,
} from '@inkframe/design';
import type { ToolId } from '../core/tools/toolIds';
import { useEditor, useEditorState } from './EditorContext';
import styles from './Toolbar.module.css';
import { useBackToCanvas } from './useBackToCanvas';

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
  const backToCanvas = useBackToCanvas();
  const { activeTool, toolLocked } = useEditorState((state) => ({
    activeTool: state.activeTool,
    toolLocked: state.toolLocked,
  }));

  return (
    <ToolbarRoot label="Tools" className={styles.place}>
      <ToolbarChoice<ToolId>
        label="Drawing tool"
        value={activeTool}
        onChange={(tool) => {
          editor.setTool(tool);
        }}
      >
        {TOOLS.map(({ id, label, key, Icon }) => (
          <ToolbarOption
            key={id}
            value={id}
            label={label}
            Icon={Icon}
            shortcut={key}
            onClick={backToCanvas(() => undefined)}
          />
        ))}
      </ToolbarChoice>
      <ToolbarSeparator />
      <ToolbarToggle
        label="Keep tool after drawing"
        tip={toolLocked ? 'Unlock tool' : 'Keep tool after drawing'}
        Icon={toolLocked ? Lock : LockOpen}
        shortcut="Q"
        pressed={toolLocked}
        onClick={backToCanvas(() => {
          editor.perform('toggleLock');
        })}
      />
    </ToolbarRoot>
  );
}
