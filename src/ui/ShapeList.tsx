import { useState } from 'react';
import { Listbox, Surface } from '@inkframe/design';
import { describeShape, shapeKind } from '../core/a11y/describeShape';
import type { ShapeId } from '../core/shapes';
import { useEditor, useEditorState } from './EditorContext';
import styles from './ShapeList.module.css';

/**
 * The drawing as a list, for screen readers and keyboard users: every shape, top first,
 * named in words. Arrow keys move, Space selects, Shift + Space adds to the selection,
 * Escape goes back to the canvas. Selection is shared with the canvas both ways.
 */
export function ShapeList() {
  const editor = useEditor();
  const { order, shapes, selectedIds } = useEditorState((state) => ({
    order: state.document.order,
    shapes: state.document.shapes,
    selectedIds: state.selectedIds,
  }));
  const [activeId, setActiveId] = useState<ShapeId | null>(null);
  const count = order.length;
  // Top of the drawing first, as a sighted user scans it.
  const idAt = (index: number): ShapeId | undefined => order[count - 1 - index];
  const activeIndex = activeId === null ? 0 : Math.max(0, count - 1 - order.indexOf(activeId));

  return (
    <>
      <Surface as="section" className={styles.region} aria-labelledby="shape-list-title">
        <h2 id="shape-list-title" className={styles.title}>
          Shapes ({count})
        </h2>
        {count === 0 ? (
          <p className={styles.hint}>No shapes yet.</p>
        ) : (
          <Listbox
            label="Shapes, top first"
            count={count}
            activeIndex={activeIndex}
            itemAt={(index) => {
              const id = idAt(index);
              const shape = id === undefined ? undefined : shapes.get(id);
              return {
                id: id ?? String(index),
                label: shape === undefined ? '' : describeShape(shape),
                selected: id !== undefined && selectedIds.has(id),
              };
            }}
            onActiveIndexChange={(index) => {
              setActiveId(idAt(index) ?? null);
            }}
            onSelect={(index, additive) => {
              const id = idAt(index);
              if (id === undefined) return;
              const next = new Set(additive ? selectedIds : []);
              if (additive && next.has(id)) next.delete(id);
              else next.add(id);
              editor.store.setState({ selectedIds: next });
            }}
            onEscape={() => {
              editor.focus();
            }}
          />
        )}
      </Surface>
      <SelectionStatus />
    </>
  );
}

/** Announces selection changes politely, wherever they came from. */
function SelectionStatus() {
  const message = useEditorState((state) => {
    const { size } = state.selectedIds;
    if (size !== 1) return size === 0 ? '' : `${String(size)} shapes selected`;
    const [id] = state.selectedIds;
    const shape = id === undefined ? undefined : state.document.shapes.get(id);
    return shape === undefined ? '' : `${shapeKind(shape)} selected`;
  });
  return (
    <p className={styles.status} role="status">
      {message}
    </p>
  );
}
