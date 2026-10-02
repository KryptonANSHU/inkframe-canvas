import type { Template } from './template';

/** A sign-up flow: start and end ovals, steps, a decision with a loop back. */
export const flowchart: Template = {
  id: 'flowchart',
  name: 'Sign-up flowchart',
  description: 'Steps, a decision, and a loop back',
  build(kit) {
    const start = kit.ellipse(-70, 0, 140, 60, { stroke: 'Green', fill: 'Green' });
    const enter = kit.rect(-110, 120, 220, 70, { stroke: 'Blue', fill: 'Blue' });
    // The diamond's tips aren't anchors, so arrows meet them free at that end and stay
    // attached to the step box at the other.
    const valid = kit.diamond(0, 340, 110, { stroke: 'Yellow', fill: 'Yellow' });
    const reach = 110 / Math.SQRT2;
    const tip = {
      top: { x: 0, y: 340 - reach },
      right: { x: reach, y: 340 },
      bottom: { x: 0, y: 340 + reach },
    };
    const welcome = kit.rect(-110, 500, 220, 70, { stroke: 'Blue', fill: 'Blue' });
    const done = kit.ellipse(-70, 630, 140, 60, { stroke: 'Green', fill: 'Green' });
    const error = kit.rect(220, 305, 200, 70, { stroke: 'Red', fill: 'Red' });
    return [
      kit.text('Sign-up flow', -110, -80, { size: 28 }),
      ...kit.group(start, kit.label('Start', start)),
      ...kit.group(enter, kit.label('Enter email', enter)),
      ...kit.group(valid, kit.label('Valid?', valid)),
      ...kit.group(welcome, kit.label('Send welcome email', welcome)),
      ...kit.group(done, kit.label('Done', done)),
      ...kit.group(error, kit.label('Show an error', error)),
      kit.arrow(start, 'bottom', enter, 'top'),
      kit.connect({ shape: enter, anchor: 'bottom' }, tip.top),
      kit.connect(tip.bottom, { shape: welcome, anchor: 'top' }, { stroke: 'Green' }),
      kit.text('Yes', 12, 440, { color: 'Green' }),
      kit.connect(tip.right, { shape: error, anchor: 'left' }, { stroke: 'Red' }),
      kit.text('No', 120, 310, { color: 'Red' }),
      kit.arrow(error, 'top', enter, 'right', { stroke: 'Slate' }),
      kit.text('Try again', 270, 200, { color: 'Slate', size: 16 }),
      kit.arrow(welcome, 'bottom', done, 'top'),
    ];
  },
};
