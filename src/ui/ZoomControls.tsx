import { Minus, Plus } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { EditAction } from '../core/editActions';
import { MAX_ZOOM, MIN_ZOOM } from '../core/camera';
import { useEditor, useEditorState } from './EditorContext';
import { IconButton } from './IconButton';
import { shortcutText } from './shortcutLabel';
import { Tip } from './Tip';
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
  const zoom = useEditorState((state) => state.camera.zoom);
  const percent = `${String(Math.round(zoom * 100))}%`;

  return (
    <div className={styles.zoom} role="group" aria-label="Zoom">
      <IconButton
        label="Zoom out"
        Icon={Minus}
        shortcut="Mod+-"
        disabled={zoom <= MIN_ZOOM}
        onClick={() => {
          editor.perform('zoomOut');
        }}
      />
      <DropdownMenu.Root>
        <Tip label="Zoom options" side="top">
          <DropdownMenu.Trigger className={styles.level} aria-label={`Zoom ${percent}`}>
            {percent}
          </DropdownMenu.Trigger>
        </Tip>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.menu}
            side="top"
            align="start"
            sideOffset={8}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.focus();
            }}
          >
            {ZOOM_ITEMS.map(({ action, label, shortcut }) => (
              <DropdownMenu.Item
                key={action}
                className={styles.item}
                onSelect={() => {
                  editor.perform(action);
                }}
              >
                {label}
                <span className={styles.shortcut}>{shortcutText(shortcut)}</span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <IconButton
        label="Zoom in"
        Icon={Plus}
        shortcut="Mod+="
        disabled={zoom >= MAX_ZOOM}
        onClick={() => {
          editor.perform('zoomIn');
        }}
      />
    </div>
  );
}
