import { useState } from 'react';
import type { Editor } from '../core/dom/createEditor';
import { AppCrash } from './AppCrash';
import styles from './App.module.css';
import { AreaError } from './AreaError';
import { CanvasHost } from './CanvasHost';
import { ErrorBoundary } from './ErrorBoundary';
import { FileBar } from './FileBar';
import { StorageBanner } from './StorageBanner';

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <ErrorBoundary area="Inkframe" fallback={<AppCrash />}>
      <main className={styles.app} aria-label="Inkframe editor">
        <CanvasHost onEditorChange={setEditor} />
        {editor !== null && (
          <ErrorBoundary
            area="File bar"
            fallback={
              <AreaError message="The file controls failed. Reload the page to bring them back." />
            }
          >
            <FileBar editor={editor} />
          </ErrorBoundary>
        )}
        {editor !== null && (
          <ErrorBoundary
            area="Storage banner"
            fallback={
              <AreaError message="Autosave status can't be shown. Save a copy to be safe." />
            }
          >
            <StorageBanner editor={editor} />
          </ErrorBoundary>
        )}
      </main>
    </ErrorBoundary>
  );
}
