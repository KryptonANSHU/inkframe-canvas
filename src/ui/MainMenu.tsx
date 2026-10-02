import {
  Eraser,
  FileCode,
  FolderOpen,
  ImageDown,
  Keyboard,
  LayoutTemplate,
  Menu as MenuIcon,
  Monitor,
  Moon,
  Save,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import {
  Divider,
  IconTrigger,
  Menu,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuSeparator,
  shortcutText,
  Surface,
} from '@inkframe/design';
import { TEMPLATES } from '../core/templates/templates';
import { useEditor, useEditorState } from './EditorContext';
import styles from './MainMenu.module.css';
import { notify } from './notifications';
import { applyThemePreference, readThemePreference, type ThemePreference } from './themePreference';

const THEMES = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

/** File actions, export, theme, and help, top left. */
export function MainMenu() {
  const editor = useEditor();
  const { files } = editor;
  const hasSelection = useEditorState((state) => state.selectedIds.size > 0);
  const isEmpty = useEditorState((state) => state.document.order.length === 0);
  // The wordmark for the theme in use: logo-light has dark ink, logo-dark light ink.
  const drawnTheme = useEditorState((state) => state.theme);
  const [theme, setTheme] = useState(readThemePreference);
  const what = hasSelection ? 'selection' : 'drawing';

  return (
    <Surface layout="bar" className={styles.place}>
      <Menu
        trigger={<IconTrigger label="Menu" Icon={MenuIcon} />}
        // Back to the canvas, not the menu button, so shortcuts keep working.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          editor.focus();
        }}
      >
        <MenuItem
          icon={FolderOpen}
          label="Open…"
          shortcut="Mod+O"
          onSelect={() => {
            files.open();
          }}
        />
        <MenuItem
          icon={Save}
          label="Save as JSON"
          shortcut="Mod+S"
          onSelect={() => {
            files.save();
          }}
        />
        <MenuSeparator />
        <MenuItem
          icon={ImageDown}
          label={`Export ${what} as PNG`}
          onSelect={() => void files.exportImage('png')}
        />
        <MenuItem
          icon={FileCode}
          label={`Export ${what} as SVG`}
          onSelect={() => void files.exportImage('svg')}
        />
        <MenuSeparator />
        <MenuLabel>New from template</MenuLabel>
        {TEMPLATES.map((template) => (
          <MenuItem
            key={template.id}
            icon={LayoutTemplate}
            label={template.name}
            onSelect={() => {
              const replacing = !isEmpty;
              if (editor.loadTemplate(template) && replacing) {
                notify(
                  `Loaded “${template.name}”. Press ${shortcutText('Mod+Z')} to get your drawing back.`,
                  'info',
                );
              }
            }}
          />
        ))}
        <MenuSeparator />
        <MenuItem
          icon={Eraser}
          label="Clear canvas"
          danger
          disabled={isEmpty}
          onSelect={() => {
            editor.perform('clear');
            // One undo step brings it all back, so a toast beats an "Are you sure?".
            notify(`Canvas cleared. Press ${shortcutText('Mod+Z')} to undo.`, 'info');
          }}
        />
        <MenuSeparator />
        <MenuRadioGroup<ThemePreference>
          label="Theme"
          value={theme}
          options={THEMES}
          onChange={(preference) => {
            applyThemePreference(preference);
            setTheme(preference);
          }}
        />
        <MenuSeparator />
        <MenuItem
          icon={Keyboard}
          label="Keyboard shortcuts"
          shortcut="?"
          onSelect={() => {
            editor.perform('help');
          }}
        />
      </Menu>
      <Divider />
      <img
        className={styles.logo}
        src={`${import.meta.env.BASE_URL}logos/logo-${drawnTheme}.svg`}
        alt="Inkframe"
        draggable={false}
      />
    </Surface>
  );
}
