import { useState } from 'react';
import type { Editor } from '../core/dom/createEditor';
import styles from './App.module.css';
import { CanvasHost } from './CanvasHost';
import { FileBar } from './FileBar';
import { StorageBanner } from './StorageBanner';

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  return (
    <main className={styles.app} aria-label="Inkframe editor">
      <CanvasHost onEditorChange={setEditor} />
      {editor !== null && <FileBar editor={editor} />}
      {editor !== null && <StorageBanner editor={editor} />}
    </main>
  );
}
