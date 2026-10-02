import type { Point } from '../geometry/point';
import type { Template } from './template';

/** A wobbly hand-drawn loop around (cx, cy): fixed, so the template looks the same each time. */
function handDrawnLoop(cx: number, cy: number, rx: number, ry: number): Point[] {
  return Array.from({ length: 41 }, (_, i) => {
    const turn = (i / 40) * Math.PI * 2.1;
    const wobble = 1 + 0.04 * Math.sin(i * 1.7);
    return { x: cx + Math.cos(turn) * rx * wobble, y: cy + Math.sin(turn) * ry * wobble };
  });
}

/** A release board: to do, in progress, done, with cards and a hand-drawn note. */
export const workflow: Template = {
  id: 'workflow',
  name: 'Release workflow',
  description: 'A board of stages with task cards',
  build(kit) {
    const lanes = [0, 300, 600].map((x) =>
      kit.rect(x, 0, 260, 400, { stroke: 'Slate', fill: 'Gray' }),
    );
    const [todo, doing, done] = lanes as [(typeof lanes)[0], (typeof lanes)[0], (typeof lanes)[0]];
    const card = (x: number, y: number, text: string, fill: 'Yellow' | 'Blue' | 'Green') => {
      const box = kit.rect(x + 20, y, 220, 64, { stroke: fill, fill });
      return kit.group(box, kit.label(text, box, { size: 16 }));
    };
    return [
      kit.text('Release workflow', 0, -96, { size: 28 }),
      kit.text('Cards are grouped with their text; the circle was drawn with the pen.', 0, -52, {
        size: 16,
        color: 'Slate',
      }),
      todo,
      doing,
      done,
      kit.text('To do', 20, 20, { size: 20 }),
      kit.text('In progress', 320, 20, { size: 20 }),
      kit.text('Done', 620, 20, { size: 20 }),
      ...card(0, 80, 'Write release notes', 'Yellow'),
      ...card(0, 164, 'Update the docs', 'Yellow'),
      ...card(300, 80, 'QA pass on staging', 'Blue'),
      ...card(600, 80, 'Freeze features', 'Green'),
      ...card(600, 164, 'Tag v1.0', 'Green'),
      kit.arrow(todo, 'right', doing, 'left', { stroke: 'Slate' }),
      kit.arrow(doing, 'right', done, 'left', { stroke: 'Slate' }),
      kit.pen(handDrawnLoop(730, 196, 140, 52), { stroke: 'Red', width: 3 }),
      kit.text('Ship it!', 760, 262, { size: 22, color: 'Red' }),
    ];
  },
};
