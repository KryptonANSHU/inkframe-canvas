import styles from './App.module.css';
import { CanvasHost } from './CanvasHost';

export function App() {
  return (
    <main className={styles.app} aria-label="Inkframe editor">
      <CanvasHost />
    </main>
  );
}
