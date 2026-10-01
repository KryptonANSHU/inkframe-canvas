import { describe, expect, it } from 'vitest';
import { fakeMeasurer, testShapeId } from '../testing/factories';
import { DEFAULT_FONT_SIZE, DEFAULT_TEXT_WIDTH } from './font';
import { createTextShape } from './textShape';

const placement = { id: testShapeId('t'), x: 30, y: 40 };

describe('createTextShape', () => {
  it('builds a text shape at the placement with the measured height', () => {
    expect(createTextShape(placement, 'one\ntwo', fakeMeasurer)).toMatchObject({
      id: 't',
      type: 'text',
      x: 30,
      y: 40,
      width: DEFAULT_TEXT_WIDTH,
      height: 40,
      text: 'one\ntwo',
      fontSize: DEFAULT_FONT_SIZE,
    });
  });

  it('drops trailing whitespace so blank lines add no height', () => {
    expect(createTextShape(placement, 'one\n\n  ', fakeMeasurer)).toMatchObject({
      text: 'one',
      height: 20,
    });
  });

  it('creates nothing for blank text', () => {
    expect(createTextShape(placement, ' \n\t', fakeMeasurer)).toBeNull();
  });
});
