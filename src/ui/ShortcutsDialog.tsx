import { X } from 'lucide-react';
import { useRef } from 'react';
import { Dialog } from 'radix-ui';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor, useEditorState } from './EditorContext';
import { Kbd } from './Kbd';
import styles from './ShortcutsDialog.module.css';

type Group = { readonly title: string; readonly rows: readonly (readonly [string, string])[] };

const GROUPS: readonly Group[] = [
  {
    title: 'Tools',
    rows: [
      ['Select', 'V'],
      ['Rectangle', 'R'],
      ['Ellipse', 'O'],
      ['Line', 'L'],
      ['Arrow', 'A'],
      ['Pen', 'P'],
      ['Text', 'T'],
      ['Text anywhere', 'Double-click'],
      ['Keep tool after drawing', 'Q'],
    ],
  },
  {
    title: 'Edit',
    rows: [
      ['Undo', 'Mod+Z'],
      ['Redo', 'Mod+Shift+Z'],
      ['Copy', 'Mod+C'],
      ['Cut', 'Mod+X'],
      ['Paste', 'Mod+V'],
      ['Duplicate', 'Mod+D'],
      ['Delete', 'Delete'],
      ['Edit text', 'Double-click'],
    ],
  },
  {
    title: 'Selection',
    rows: [
      ['Select all', 'Mod+A'],
      ['Add or remove', 'Shift+Click'],
      ['Shape underneath', 'Alt+Click'],
      ['Select touched shapes', 'Mod+Drag'],
      ['Nudge', '←↑→↓'],
      ['Nudge by 10', 'Shift+←↑→↓'],
      ['Deselect', 'Esc'],
    ],
  },
  {
    title: 'Transform',
    rows: [
      ['Resize from center', 'Alt+Drag'],
      ['Keep proportions', 'Shift+Drag'],
      ['Rotate in 15° steps', 'Shift+Drag'],
    ],
  },
  {
    title: 'Arrange',
    rows: [
      ['Bring forward', 'Mod+]'],
      ['Send backward', 'Mod+['],
      ['Bring to front', 'Mod+Shift+]'],
      ['Send to back', 'Mod+Shift+['],
    ],
  },
  {
    title: 'View',
    rows: [
      ['Pan', 'Space+Drag'],
      ['Zoom in', 'Mod+='],
      ['Zoom out', 'Mod+-'],
      ['Zoom to 100%', 'Mod+0'],
      ['Zoom to fit', 'Shift+1'],
    ],
  },
  {
    title: 'File',
    rows: [
      ['Open', 'Mod+O'],
      ['Save as JSON', 'Mod+S'],
    ],
  },
];

/** Every shortcut, grouped (CLAUDE.md §9). Opens with ? or from the menu. */
export function ShortcutsDialog() {
  const editor = useEditor();
  const open = useEditorState((state) => state.helpOpen);
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        editor.store.setState({ helpOpen: next });
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className={styles.scrim} />
        <Dialog.Content
          className={styles.dialog}
          // Focus the dialog itself, not its close button: no ring until the user tabs.
          ref={content}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.focus();
          }}
        >
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>Keyboard shortcuts</Dialog.Title>
            <Dialog.Close className={styles.close} aria-label="Close">
              <X size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
            </Dialog.Close>
          </header>
          <Dialog.Description className={styles.description}>
            Shortcuts work while the canvas or the toolbar has focus.
          </Dialog.Description>
          <div className={styles.groups}>
            {GROUPS.map((group) => (
              <section key={group.title} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.title}</h3>
                <dl className={styles.list}>
                  {group.rows.map(([label, shortcut]) => (
                    <div key={label} className={styles.row}>
                      <dt>{label}</dt>
                      <dd className={styles.keys}>
                        <Kbd shortcut={shortcut} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
