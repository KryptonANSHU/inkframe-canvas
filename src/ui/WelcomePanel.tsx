import { GitBranch, Network, PencilLine, SquareKanban, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Button, ChoiceCard, ICON_STROKE, Kbd, size, Surface } from '@inkframe/design';
import { templatePreview, TEMPLATES } from '../core/templates/templates';
import { useEditor, useEditorState } from './EditorContext';
import styles from './WelcomePanel.module.css';

const USES: readonly { Icon: LucideIcon; title: string; detail: string }[] = [
  { Icon: GitBranch, title: 'Flowcharts', detail: 'Steps, decisions, and loops' },
  { Icon: Network, title: 'System design', detail: 'Services and how they connect' },
  { Icon: SquareKanban, title: 'Workflows', detail: 'Stages, tasks, and hand-offs' },
  { Icon: PencilLine, title: 'Sketches', detail: 'Graphs, wireframes, quick ideas' },
];

/**
 * What an empty canvas shows: what Inkframe is for, three templates to start from,
 * and how to start blank. It steps aside once there is anything on the canvas, or as
 * soon as a drawing tool is picked, so it never gets in the way of drawing.
 */
export function WelcomePanel() {
  const editor = useEditor();
  const [dismissed, setDismissed] = useState(false);
  const shown = useEditorState(
    (state) =>
      state.autosave !== 'starting' &&
      state.document.order.length === 0 &&
      state.draft === null &&
      state.textEdit === null &&
      state.activeTool === 'select',
  );
  const theme = useEditorState((state) => state.theme);
  if (!shown || dismissed) {
    return null;
  }

  return (
    <Surface as="section" className={styles.panel} aria-labelledby="welcome-title">
      <header className={styles.header}>
        <h2 id="welcome-title" className={styles.title}>
          Draw diagrams that stay crisp
        </h2>
        <p className={styles.lead}>
          Inkframe is a fast canvas for thinking in boxes and arrows. Everything stays editable,
          works offline, and can be shared to draw together.
        </p>
      </header>
      <ul className={styles.uses} aria-label="What it's for">
        {USES.map(({ Icon, title, detail }) => (
          <li key={title} className={styles.use}>
            <Icon className={styles.icon} size={size.icon} strokeWidth={ICON_STROKE} aria-hidden />
            <span>
              <span className={styles.useTitle}>{title}</span>
              <span className={styles.useDetail}>{detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <h3 className={styles.subtitle}>Start from a template</h3>
      <div className={styles.templates}>
        {TEMPLATES.map((template) => (
          <ChoiceCard
            key={template.id}
            title={template.name}
            description={template.description}
            preview={templatePreview(template, theme)}
            onChoose={() => {
              if (editor.loadTemplate(template)) editor.focus();
            }}
          />
        ))}
      </div>
      <footer className={styles.footer}>
        <p className={styles.hint}>
          Or pick a tool or press <Kbd shortcut="R" /> to draw a rectangle. Press{' '}
          <Kbd shortcut="?" /> for every shortcut.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDismissed(true);
            editor.focus();
          }}
        >
          Start blank
        </Button>
      </footer>
    </Surface>
  );
}
