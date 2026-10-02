import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { Divider, Surface, TooltipProvider } from '@inkframe/design';
import type { Editor } from '../core/dom/createEditor';
import { AppCrash } from './AppCrash';
import styles from './App.module.css';
import { AreaError } from './AreaError';
import { CanvasHost } from './CanvasHost';
import { EditorProvider } from './EditorContext';
import { ErrorBoundary } from './ErrorBoundary';
import { HistoryControls } from './HistoryControls';
import { MainMenu } from './MainMenu';
import { PluginsArea } from './PluginsArea';
import { ShapeList } from './ShapeList';
import { ShareArea } from './ShareArea';
import { ShortcutsDialog } from './ShortcutsDialog';
import { StorageBanner } from './StorageBanner';
import { StylePanel } from './StylePanel';
import { Toaster } from './Toaster';
import { Toolbar } from './Toolbar';
import { WelcomePanel } from './WelcomePanel';
import { ZoomControls } from './ZoomControls';

/** The ?debug=1 performance meter, loaded only when asked for. */
const DebugOverlay = lazy(() =>
  import('./DebugOverlay').then((module) => ({ default: module.DebugOverlay })),
);
const debug = new URLSearchParams(location.search).get('debug') === '1';

/** Keeps a failure inside one area, with a message saying what stopped working. */
function Area({ name, message, children }: { name: string; message: string; children: ReactNode }) {
  return (
    <ErrorBoundary area={name} fallback={<AreaError message={message} />}>
      {children}
    </ErrorBoundary>
  );
}

/** `npm run bench` loads the app with ?bench to drive it; nobody else pays for it. */
const bench = new URLSearchParams(location.search).has('bench');

function attachBenchWhenAsked(editor: Editor | null): void {
  if (bench && editor !== null) {
    void import('../../bench/driver').then(({ attachBench }) => {
      attachBench(editor);
    });
  }
}

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const onEditorChange = useCallback((next: Editor | null) => {
    setEditor(next);
    attachBenchWhenAsked(next);
  }, []);
  return (
    <ErrorBoundary area="Inkframe" fallback={<AppCrash />}>
      <main className={styles.app} aria-label="Inkframe editor">
        <CanvasHost onEditorChange={onEditorChange} />
        {editor !== null && (
          <EditorProvider editor={editor}>
            <TooltipProvider>
              <Area name="Welcome" message="The welcome panel failed. Pick a tool to start.">
                <WelcomePanel />
              </Area>
              <Area name="Shape list" message="The shape list failed. Reload to bring it back.">
                <ShapeList />
              </Area>
              {debug && (
                <Suspense fallback={null}>
                  <DebugOverlay />
                </Suspense>
              )}
              <Area name="Menu" message="The menu failed. Reload the page to bring it back.">
                <MainMenu />
              </Area>
              <Area
                name="Toolbar"
                message="The toolbar failed. Shortcuts still work; reload to bring it back."
              >
                <Toolbar />
              </Area>
              <Surface layout="bar" className={styles.topEnd}>
                <Area
                  name="Sharing"
                  message="Drawing together failed. Reload the page to bring it back."
                >
                  <ShareArea />
                </Area>
                <Divider />
                <Area
                  name="Plugins"
                  message="The plugin panel failed. Reload the page to bring it back."
                >
                  <PluginsArea />
                </Area>
              </Surface>
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
            </TooltipProvider>
          </EditorProvider>
        )}
      </main>
    </ErrorBoundary>
  );
}
