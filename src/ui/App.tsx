import { useState, type ReactNode } from 'react';
import { Tooltip } from 'radix-ui';
import type { Editor } from '../core/dom/createEditor';
import { AppCrash } from './AppCrash';
import styles from './App.module.css';
import { AreaError } from './AreaError';
import { CanvasHost } from './CanvasHost';
import { EditorProvider } from './EditorContext';
import { EmptyHint } from './EmptyHint';
import { ErrorBoundary } from './ErrorBoundary';
import { HistoryControls } from './HistoryControls';
import { MainMenu } from './MainMenu';
import { ShortcutsDialog } from './ShortcutsDialog';
import { StorageBanner } from './StorageBanner';
import { StylePanel } from './StylePanel';
import { Toaster } from './Toaster';
import { Toolbar } from './Toolbar';
import { ZoomControls } from './ZoomControls';

/** Tooltips wait a beat before showing, then switch instantly while moving along a bar. */
const TOOLTIP_DELAY_MS = 400;

/** Keeps a failure inside one area, with a message saying what stopped working. */
function Area({ name, message, children }: { name: string; message: string; children: ReactNode }) {
  return (
    <ErrorBoundary area={name} fallback={<AreaError message={message} />}>
      {children}
    </ErrorBoundary>
  );
}

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <ErrorBoundary area="Inkframe" fallback={<AppCrash />}>
      <main className={styles.app} aria-label="Inkframe editor">
        <CanvasHost onEditorChange={setEditor} />
        {editor !== null && (
          <EditorProvider editor={editor}>
            <Tooltip.Provider delayDuration={TOOLTIP_DELAY_MS}>
              <EmptyHint />
              <Area name="Menu" message="The menu failed. Reload the page to bring it back.">
                <MainMenu />
              </Area>
              <Area
                name="Toolbar"
                message="The toolbar failed. Shortcuts still work; reload to bring it back."
              >
                <Toolbar />
              </Area>
              <Area
                name="Style panel"
                message="The style panel failed. Reload the page to bring it back."
              >
                <StylePanel />
              </Area>
              <Area
                name="Zoom controls"
                message="The zoom controls failed. Ctrl/⌘ + and − still zoom."
              >
                <ZoomControls />
              </Area>
              <Area
                name="History controls"
                message="Undo and redo buttons failed. Ctrl/⌘ + Z still works."
              >
                <HistoryControls />
              </Area>
              <Area
                name="Storage banner"
                message="Autosave status can't be shown. Save a copy to be safe."
              >
                <StorageBanner editor={editor} />
              </Area>
              <Area
                name="Notifications"
                message="Notifications failed. Reload the page to see errors again."
              >
                <Toaster />
              </Area>
              <Area name="Shortcuts dialog" message="The shortcuts list failed to open.">
                <ShortcutsDialog />
              </Area>
            </Tooltip.Provider>
          </EditorProvider>
        )}
      </main>
    </ErrorBoundary>
  );
}
