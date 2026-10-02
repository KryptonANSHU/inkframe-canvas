import alignDistribute from './alignDistribute.js?raw';
import randomPalette from './randomPalette.js?raw';
import shapeGrid from './shapeGrid.js?raw';

/** A plugin shipped with Inkframe. It runs sandboxed exactly like one from a file. */
export type BuiltinPlugin = {
  readonly name: string;
  /** One line for the plugin panel. */
  readonly description: string;
  readonly code: string;
};

export const BUILTIN_PLUGINS: readonly BuiltinPlugin[] = [
  {
    name: 'Align and distribute',
    description: 'Line up the selection, or space it evenly.',
    code: alignDistribute,
  },
  {
    name: 'Random color palette',
    description: 'Recolor the selection with a fresh palette.',
    code: randomPalette,
  },
  {
    name: 'Grid of shapes',
    description: 'Repeat the selection as a grid.',
    code: shapeGrid,
  },
];
