import { Button } from '@inkframe/design';
import styles from './AppCrash.module.css';

/** The last line of defense: the whole app failed to render. */
export function AppCrash() {
  return (
    <div className={styles.crash} role="alert">
      <h1 className={styles.title}>Inkframe stopped because of an error</h1>
      <p className={styles.body}>
        Your drawing was autosaved. Reload the page to pick up where you left off.
      </p>
      <Button
        variant="primary"
        onClick={() => {
          location.reload();
        }}
      >
        Reload
      </Button>
    </div>
  );
}
