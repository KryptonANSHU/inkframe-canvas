import {
  ArrowDown,
  ArrowUp,
  BringToFront,
  Copy,
  Group,
  SendToBack,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { canGroup } from '../core/groups';
import { selectedShapes } from '../core/selection/selectedShapes';
import { IconButton } from '@inkframe/design';
import { useEditor, useEditorState } from './EditorContext';
import { useBackToCanvas } from './useBackToCanvas';

/** Draw order: send back or bring forward, one step or all the way. */
export function LayerButtons() {
  const editor = useEditor();
  const backToCanvas = useBackToCanvas();
  return (
    <>
      {(
        [
          ['back', 'Send to back', SendToBack, 'Mod+Shift+['],
          ['backward', 'Send backward', ArrowDown, 'Mod+['],
          ['forward', 'Bring forward', ArrowUp, 'Mod+]'],
          ['front', 'Bring to front', BringToFront, 'Mod+Shift+]'],
        ] as const
      ).map(([action, label, Icon, shortcut]) => (
        <IconButton
          key={action}
          label={label}
          Icon={Icon}
          shortcut={shortcut}
          onClick={backToCanvas(() => {
            editor.perform(action);
          })}
        />
      ))}
    </>
  );
}

/** What can be done with the selection: group, duplicate, delete, ungroup. */
export function SelectionActions() {
  const editor = useEditor();
  const backToCanvas = useBackToCanvas();
  const grouping = useEditorState((state) => {
    const shapes = selectedShapes(state);
    return {
      canGroup: canGroup(shapes),
      canUngroup: shapes.some((shape) => shape.groupId !== undefined),
    };
  });
  return (
    <>
      {grouping.canGroup && (
        <IconButton
          label="Group"
          Icon={Group}
          shortcut="Mod+G"
          onClick={backToCanvas(() => {
            editor.perform('group');
          })}
        />
      )}
      <IconButton
        label="Duplicate"
        Icon={Copy}
        shortcut="Mod+D"
        onClick={backToCanvas(() => {
          editor.perform('duplicate');
        })}
      />
      <IconButton
        label="Delete"
        Icon={Trash2}
        shortcut="Delete"
        onClick={backToCanvas(() => {
          editor.perform('delete');
        })}
      />
      {grouping.canUngroup && (
        <IconButton
          label="Ungroup"
          Icon={Ungroup}
          shortcut="Mod+Shift+G"
          onClick={backToCanvas(() => {
            editor.perform('ungroup');
          })}
        />
      )}
    </>
  );
}
