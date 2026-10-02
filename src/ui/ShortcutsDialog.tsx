import { Dialog, Kbd } from '@inkframe/design';
import { useEditor, useEditorState } from './EditorContext';
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
      ['Shape inside a group', 'Mod+Click'],
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
      ['No snapping or attaching', 'Mod+Drag'],
    ],
  },
  {
    title: 'Arrange',
    rows: [
      ['Bring forward', 'Mod+]'],
      ['Send backward', 'Mod+['],
      ['Bring to front', 'Mod+Shift+]'],
      ['Send to back', 'Mod+Shift+['],
      ['Group', 'Mod+G'],
      ['Ungroup', 'Mod+Shift+G'],
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
      ['Show or hide the grid', "Mod+'"],
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

/** Every shortcut, grouped. Opens with ? or from the menu. */
export function ShortcutsDialog() {
  const editor = useEditor();
  const open = useEditorState((state) => state.helpOpen);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        editor.store.setState({ helpOpen: next });
      }}
      title="Keyboard shortcuts"
      description="Shortcuts work while the canvas or the toolbar has focus."
      width="wide"
      closable
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        editor.focus();
      }}
    >
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
    </Dialog>
  );
}
