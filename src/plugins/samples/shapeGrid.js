// Grid of shapes: repeats the selection as a grid, starting from where it is, with a
// small gap between copies. The copies are new shapes; the original stays in place.
inkframe.register({
  id: 'shape-grid',
  name: 'Grid of shapes',
  version: '1.0.0',
  permissions: ['selection:read', 'shapes:create', 'notify'],
  commands: [
    { id: 'grid-3', label: '3 × 3 grid' },
    { id: 'grid-5', label: '5 × 5 grid' },
  ],
});

const GAP = 24;
/** The host's limit on shapes per call. */
const MAX_SHAPES = 500;

inkframe.onCommand(async (command) => {
  const shapes = await inkframe.selection.get();
  if (shapes.length === 0) {
    await inkframe.notify('Select a shape to repeat first.');
    return;
  }
  const size = command === 'grid-5' ? 5 : 3;
  const copies = shapes.length * (size * size - 1);
  if (copies > MAX_SHAPES) {
    await inkframe.notify(
      `That would add ${copies} shapes; the limit is ${MAX_SHAPES}. Select fewer.`,
    );
    return;
  }
  const minX = Math.min(...shapes.map((s) => s.bounds.x));
  const minY = Math.min(...shapes.map((s) => s.bounds.y));
  const stepX = Math.max(...shapes.map((s) => s.bounds.x + s.bounds.width)) - minX + GAP;
  const stepY = Math.max(...shapes.map((s) => s.bounds.y + s.bounds.height)) - minY + GAP;
  const created = [];
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      if (row === 0 && column === 0) continue;
      for (const { id, zIndex, groupId, bounds, ...shape } of shapes) {
        created.push({ ...shape, x: shape.x + column * stepX, y: shape.y + row * stepY });
      }
    }
  }
  await inkframe.shapes.create(created);
  await inkframe.notify(`Added ${created.length} shapes.`);
});
