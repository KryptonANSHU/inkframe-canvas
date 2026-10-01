import { useStore } from 'zustand';
import type { Editor } from '../core/dom/createEditor';
import styles from './StorageBanner.module.css';

type StorageBannerProps = { readonly editor: Editor };

/** Shown when autosave can't store anything, so the user knows to save a copy. */
export function StorageBanner({ editor }: StorageBannerProps) {
  const autosave = useStore(editor.store, (state) => state.autosave);
  if (autosave !== 'unavailable') {
    return null;
  }
  return (
    <div className={styles.banner} role="alert">
      Autosave is off: this browser isn't letting Inkframe store data, so your drawing is kept only
      until you close this tab.{' '}
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          editor.files.save();
          editor.focus();
        }}
      >
        Save a copy
      </button>
    </div>
  );
}
