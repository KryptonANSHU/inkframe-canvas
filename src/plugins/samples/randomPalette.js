// Random color palette: recolors the selection with hues spread evenly around the color
// wheel from a random start, so neighbors always differ. Fills get a light tint of the
// same hue; shapes without a fill keep none.
inkframe.register({
  id: 'random-palette',
  name: 'Random color palette',
  version: '1.0.0',
  permissions: ['selection:read', 'shapes:update', 'notify'],
  commands: [{ id: 'recolor', label: 'Recolor selection' }],
});

/** The golden angle: successive hues never line up, however many there are. */
const GOLDEN_ANGLE = 137.508;

/** HSL (degrees, 0–1, 0–1) to #rrggbb, the only color form shapes accept. */
function hex(hue, saturation, lightness) {
  const k = (n) => (n + hue / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n) => {
    const value = lightness - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

inkframe.onCommand(async () => {
  const shapes = await inkframe.selection.get();
  if (shapes.length === 0) {
    await inkframe.notify('Select some shapes to recolor first.');
    return;
  }
  const start = Math.random() * 360;
  const updates = shapes.map((shape, i) => {
    const hue = (start + i * GOLDEN_ANGLE) % 360;
    const style = { strokeColor: hex(hue, 0.65, 0.42) };
    if (shape.style.fillColor !== null) style.fillColor = hex(hue, 0.75, 0.86);
    return { id: shape.id, patch: { style } };
  });
  await inkframe.shapes.update(updates);
});
