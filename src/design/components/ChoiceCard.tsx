import styles from './ChoiceCard.module.css';

type ChoiceCardProps = {
  readonly title: string;
  readonly description: string;
  /** A picture of the choice (an image URL); decorative, the title names it. */
  readonly preview: string;
  readonly onChoose: () => void;
};

/** A large button for picking a starting point, e.g. a template: picture, title, one line. */
export function ChoiceCard({ title, description, preview, onChoose }: ChoiceCardProps) {
  return (
    <button type="button" className={styles.card} onClick={onChoose}>
      {preview !== '' && <img className={styles.preview} src={preview} alt="" />}
      <span className={styles.title}>{title}</span>
      <span className={styles.description}>{description}</span>
    </button>
  );
}
