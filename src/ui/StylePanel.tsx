import { Palette } from 'lucide-react';
import { useState } from 'react';
import { selectedShapes } from '../core/selection/selectedShapes';
import { selectionStyle } from '../core/style';
import { Divider, IconButton, Surface } from '@inkframe/design';
import { useEditorState } from './EditorContext';
import { LayerButtons, SelectionActions } from './SelectionActions';
import { Section, StyleSections } from './StyleControls';
import styles from './StylePanel.module.css';
import { usePhoneLayout } from './usePhoneLayout';

/**
 * The selection's style and actions. On larger screens, a panel on the right. On
 * phones, a compact bar (Style, Duplicate, Delete…) above the bottom bars, so the
 * selection stays in view; Style opens the full sheet above it.
 */
export function StylePanel() {
  // Selected separately: each selector returns primitives (or an object of them), so
  // the shallow comparison sees "unchanged" and the panel re-renders only on a change.
  const style = useEditorState((state) => selectionStyle(selectedShapes(state)));
  const editingText = useEditorState((state) => state.textEdit !== null);
  const phone = usePhoneLayout();
  const [sheetOpen, setSheetOpen] = useState(false);
  if (style === null || editingText) {
    return null;
  }

  if (phone) {
    return (
      <>
        {sheetOpen && (
          <Surface as="aside" className={styles.sheet} aria-label="Style">
            <StyleSections style={style} />
            <Section title="Layer">
              <div className={styles.row}>
                <LayerButtons />
              </div>
            </Section>
          </Surface>
        )}
        <Surface layout="bar" className={styles.quickBar} role="group" aria-label="Selection">
          <IconButton
            label="Style"
            Icon={Palette}
            pressed={sheetOpen}
            onClick={() => {
              setSheetOpen(!sheetOpen);
            }}
          />
          <Divider />
          <SelectionActions />
        </Surface>
      </>
    );
  }

  return (
    <Surface as="aside" className={styles.panel} aria-label="Style">
      <StyleSections style={style} />
      <Section title="Layer">
        <div className={styles.row}>
          <LayerButtons />
        </div>
      </Section>
      <Section title="Actions">
        <div className={styles.actions}>
          <SelectionActions />
        </div>
      </Section>
    </Surface>
  );
}
