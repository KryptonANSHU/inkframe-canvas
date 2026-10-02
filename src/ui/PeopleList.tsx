import { useEditorState } from './EditorContext';
import styles from './PeopleList.module.css';

/** Who is in the room: this user first, then everyone else, each with their color. */
export function PeopleList() {
  // A string, so cursor moves (which change `peers` 20 times a second) don't re-render.
  const people = useEditorState((state) => {
    const collab = state.collab;
    if (collab === null) return '';
    const everyone = [
      { name: `${collab.self.name} (you)`, color: collab.self.color },
      ...collab.peers,
    ];
    return JSON.stringify(everyone.map(({ name, color }) => [name, color]));
  });
  const rows = people === '' ? [] : (JSON.parse(people) as [string, string][]);
  return (
    <section aria-labelledby="people-title">
      <h3 id="people-title" className={styles.title}>
        In this room ({rows.length})
      </h3>
      <ul className={styles.list}>
        {rows.map(([name, color], index) => (
          // Names can repeat across browsers; position plus name keys a row.
          <li key={`${String(index)}-${name}`} className={styles.person}>
            <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
            {name}
          </li>
        ))}
      </ul>
    </section>
  );
}
