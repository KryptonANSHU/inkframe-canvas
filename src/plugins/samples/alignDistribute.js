// Align and distribute: lines up the selection, or spaces it evenly. A group moves as
// one block, so its shapes keep their places relative to each other.
inkframe.register({
  id: 'align-distribute',
  name: 'Align and distribute',
  version: '1.0.0',
  permissions: ['selection:read', 'shapes:update', 'notify'],
  commands: [
    { id: 'left', label: 'Align left' },
    { id: 'center', label: 'Align centers' },
    { id: 'right', label: 'Align right' },
    { id: 'top', label: 'Align top' },
    { id: 'middle', label: 'Align middles' },
    { id: 'bottom', label: 'Align bottom' },
    { id: 'horizontal', label: 'Distribute horizontally' },
    { id: 'vertical', label: 'Distribute vertically' },
  ],
});

/** Shapes that move together (a group, or one ungrouped shape) and their joint bounds. */
function blocksOf(shapes) {
  const blocks = new Map();
  for (const shape of shapes) {
    const key = shape.groupId ?? shape.id;
    const block = blocks.get(key) ?? {
      shapes: [],
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    };
    const { x, y, width, height } = shape.bounds;
    block.shapes.push(shape);
    block.minX = Math.min(block.minX, x);
    block.minY = Math.min(block.minY, y);
    block.maxX = Math.max(block.maxX, x + width);
    block.maxY = Math.max(block.maxY, y + height);
    blocks.set(key, block);
  }
  return [...blocks.values()];
}

/** How far each block moves along one axis to line up, measured at start/mid/end. */
function alignOffsets(blocks, axis, where) {
  const min = axis === 'x' ? 'minX' : 'minY';
  const max = axis === 'x' ? 'maxX' : 'maxY';
  const at = (block) =>
    where === 'start' ? block[min] : where === 'end' ? block[max] : (block[min] + block[max]) / 2;
  const target =
    where === 'start'
      ? Math.min(...blocks.map(at))
      : where === 'end'
        ? Math.max(...blocks.map(at))
        : (Math.min(...blocks.map((b) => b[min])) + Math.max(...blocks.map((b) => b[max]))) / 2;
  return blocks.map((block) => target - at(block));
}

/** Equal gaps between blocks, keeping the first and last where they are. */
function distributeOffsets(blocks, axis) {
  const min = axis === 'x' ? 'minX' : 'minY';
  const max = axis === 'x' ? 'maxX' : 'maxY';
  const order = [...blocks].sort((a, b) => a[min] + a[max] - (b[min] + b[max]));
  const first = order[0];
  const last = order[order.length - 1];
  const sizes = order.reduce((sum, block) => sum + block[max] - block[min], 0);
  const gap = (last[max] - first[min] - sizes) / (order.length - 1);
  const offsets = new Map();
  let next = first[min];
  for (const block of order) {
    offsets.set(block, next - block[min]);
    next += block[max] - block[min] + gap;
  }
  return blocks.map((block) => offsets.get(block));
}

const ALIGN = {
  left: ['x', 'start'],
  center: ['x', 'middle'],
  right: ['x', 'end'],
  top: ['y', 'start'],
  middle: ['y', 'middle'],
  bottom: ['y', 'end'],
};

inkframe.onCommand(async (command) => {
  const blocks = blocksOf(await inkframe.selection.get());
  const distribute = command === 'horizontal' || command === 'vertical';
  const needed = distribute ? 3 : 2;
  if (blocks.length < needed) {
    await inkframe.notify(`Select at least ${needed} shapes or groups first.`);
    return;
  }
  const axis = distribute ? (command === 'horizontal' ? 'x' : 'y') : ALIGN[command][0];
  const offsets = distribute
    ? distributeOffsets(blocks, axis)
    : alignOffsets(blocks, axis, ALIGN[command][1]);
  const updates = blocks.flatMap((block, i) =>
    offsets[i] === 0
      ? []
      : block.shapes.map((shape) => ({
          id: shape.id,
          patch: { [axis]: shape[axis] + offsets[i] },
        })),
  );
  // Already lined up: no empty undo step.
  if (updates.length > 0) await inkframe.shapes.update(updates);
});
