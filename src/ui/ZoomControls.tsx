import { Grid3x3, Minus, Plus } from 'lucide-react';
import type { EditAction } from '../core/editActions';
import { MAX_ZOOM, MIN_ZOOM } from '../core/camera';
import { Button, Divider, IconButton, Menu, MenuItem, Surface } from '@inkframe/design';
import { useEditor, useEditorState } from './EditorContext';
import { useBackToCanvas } from './useBackToCanvas';
import styles from './ZoomControls.module.css';

const ZOOM_ITEMS: readonly { action: EditAction; label: string; shortcut: string }[] = [
  { action: 'zoomIn', label: 'Zoom in', shortcut: 'Mod+=' },
  { action: 'zoomOut', label: 'Zoom out', shortcut: 'Mod+-' },
  { action: 'zoomReset', label: 'Zoom to 100%', shortcut: 'Mod+0' },
  { action: 'zoomFit', label: 'Zoom to fit', shortcut: 'Shift+1' },
];

/** Zoom out, the current zoom (a menu of zoom actions), and zoom in, bottom left. */
export function ZoomControls() {
  const editor = useEditor();
  const backToCanvas = useBackToCanvas();
  const zoom = useEditorState((state) => state.camera.zoom);
  const gridVisible = useEditorState((state) => state.gridVisible);
  const percent = `${String(Math.round(zoom * 100))}%`;

  return (
    <Surface layout="bar" className={styles.place} role="group" aria-label="Zoom">
      <span className={styles.desktopOnly}>
        <IconButton
          label="Zoom out"
          Icon={Minus}
          shortcut="Mod+-"
          disabled={zoom <= MIN_ZOOM}
          onClick={backToCanvas(() => {
            editor.perform('zoomOut');
          })}
        />
      </span>
      <Menu
        side="top"
        trigger={
          // No tooltip: the menu explains itself, and a focus tooltip would outlive it.
          <Button variant="ghost" className={styles.level} aria-label={`Zoom ${percent}`}>
            {percent}
          </Button>
        }
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.focus();
        }}
      >
        {ZOOM_ITEMS.map(({ action, label, shortcut }) => (
          <MenuItem
            key={action}
            label={label}
            shortcut={shortcut}
            onSelect={() => {
              editor.perform(action);
            }}
          />
        ))}
      </Menu>
      <span className={styles.desktopOnly}>
        <IconButton
          label="Zoom in"
          Icon={Plus}
          shortcut="Mod+="
          disabled={zoom >= MAX_ZOOM}
          onClick={backToCanvas(() => {
            editor.perform('zoomIn');
          })}
        />
      </span>
      <Divider />
      <IconButton
        label="Grid"
        Icon={Grid3x3}
        shortcut="Mod+'"
        pressed={gridVisible}
        onClick={backToCanvas(() => {
          editor.perform('toggleGrid');
        })}
      />
    </Surface>
  );
}
