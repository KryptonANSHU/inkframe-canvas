import styles from './AreaError.module.css';

type AreaErrorProps = { readonly message: string };

/** What a failed panel shows instead of itself. */
export function AreaError({ message }: AreaErrorProps) {
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}
