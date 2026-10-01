import {
  FileCode,
  FolderOpen,
  ImageDown,
  Keyboard,
  Menu,
  Monitor,
  Moon,
  Save,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { DropdownMenu } from 'radix-ui';
import { ICON_STROKE, size } from '../design/tokens';
import { useEditor, useEditorState } from './EditorContext';
import styles from './MainMenu.module.css';
import { shortcutText } from './shortcutLabel';
import { Tip } from './Tip';
import { applyThemePreference, readThemePreference, type ThemePreference } from './themePreference';

const THEMES: readonly { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

type ItemProps = {
  readonly Icon: LucideIcon;
  readonly label: string;
  readonly shortcut?: string;
  readonly onSelect: () => void;
};

function Item({ Icon, label, shortcut, onSelect }: ItemProps) {
  return (
    <DropdownMenu.Item className={styles.item} onSelect={onSelect}>
      <Icon className={styles.icon} size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
      {label}
      {shortcut !== undefined && <span className={styles.shortcut}>{shortcutText(shortcut)}</span>}
    </DropdownMenu.Item>
  );
}

/** File actions, export, theme, and help, top left (the PRD's "file menu"). */
export function MainMenu() {
  const editor = useEditor();
  const { files } = editor;
  const hasSelection = useEditorState((state) => state.selectedIds.size > 0);
  const [theme, setTheme] = useState(readThemePreference);
  const what = hasSelection ? 'selection' : 'drawing';

  return (
    <DropdownMenu.Root>
      <div className={styles.bar}>
        <Tip label="Menu">
          <DropdownMenu.Trigger className={styles.trigger} aria-label="Menu">
            <Menu size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
          </DropdownMenu.Trigger>
        </Tip>
      </div>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menu}
          align="start"
          sideOffset={8}
          // Back to the canvas, not the menu button, so shortcuts keep working.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            editor.focus();
          }}
        >
          <Item
            Icon={FolderOpen}
            label="Open…"
            shortcut="Mod+O"
            onSelect={() => {
              files.open();
            }}
          />
          <Item
            Icon={Save}
            label="Save as JSON"
            shortcut="Mod+S"
            onSelect={() => {
              files.save();
            }}
          />
          <DropdownMenu.Separator className={styles.separator} />
          <Item
            Icon={ImageDown}
            label={`Export ${what} as PNG`}
            onSelect={() => void files.exportImage('png')}
          />
          <Item
            Icon={FileCode}
            label={`Export ${what} as SVG`}
            onSelect={() => void files.exportImage('svg')}
          />
          <DropdownMenu.Separator className={styles.separator} />
          <DropdownMenu.Label className={styles.label}>Theme</DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={theme}
            onValueChange={(value) => {
              const preference = value as ThemePreference;
              applyThemePreference(preference);
              setTheme(preference);
            }}
          >
            {THEMES.map(({ value, label, Icon }) => (
              <DropdownMenu.RadioItem key={value} value={value} className={styles.item}>
                <Icon
                  className={styles.icon}
                  size={size.icon}
                  strokeWidth={ICON_STROKE}
                  aria-hidden
                />
                {label}
                <DropdownMenu.ItemIndicator className={styles.check} />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className={styles.separator} />
          <Item
            Icon={Keyboard}
            label="Keyboard shortcuts"
            shortcut="?"
            onSelect={() => {
              editor.perform('help');
            }}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
