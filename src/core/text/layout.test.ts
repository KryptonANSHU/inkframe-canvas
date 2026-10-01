import { describe, expect, it } from 'vitest';
import { fakeMeasurer, makeText } from '../testing/factories';
import { createTextLayoutCache, layoutText, type TextMeasurer } from './layout';

// fakeMeasurer: 10 units per character, 20-unit lines, 16 ascent.
const lines = (text: string, width: number) =>
  layoutText(text, width, 20, fakeMeasurer).lines.map((line) => line.text);

describe('layoutText', () => {
  it('keeps text that fits on one line', () => {
    expect(lines('Hello world', 200)).toEqual(['Hello world']);
  });

  it('wraps at word boundaries, dropping the space at the break', () => {
    expect(lines('Hello brave new world', 120)).toEqual(['Hello brave', 'new world']);
  });

  it('keeps line breaks the user typed, including empty lines', () => {
    expect(lines('one\n\ntwo', 200)).toEqual(['one', '', 'two']);
  });

  it('breaks a word wider than the box between characters', () => {
    expect(lines('abcdefghij', 40)).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('continues after a broken word on the same line when there is room', () => {
    expect(lines('abcdefg hi', 40)).toEqual(['abcd', 'efg', 'hi']);
  });

  it('never splits a grapheme, even in a box narrower than one', () => {
    const family = '👨‍👩‍👧';
    expect(lines(`${family}${family}`, 5)).toEqual([family, family]);
  });

  it('keeps spacing inside a line', () => {
    expect(lines('a  b', 200)).toEqual(['a  b']);
  });

  it('gives empty text one empty line', () => {
    expect(layoutText('', 100, 20, fakeMeasurer)).toMatchObject({
      lines: [{ text: '', width: 0 }],
      height: 20,
    });
  });

  it('measures each line and the total height from the font metrics', () => {
    expect(layoutText('Hello brave new world', 120, 20, fakeMeasurer)).toEqual({
      ascent: 16,
      lineHeight: 20,
      height: 40,
      lines: [
        { text: 'Hello brave', width: 110 },
        { text: 'new world', width: 90 },
      ],
    });
  });
});

describe('createTextLayoutCache', () => {
  it('lays out a shape once, until reset', () => {
    let measured = 0;
    const counting: TextMeasurer = {
      width: (text, size) => {
        measured++;
        return fakeMeasurer.width(text, size);
      },
      metrics: (size) => fakeMeasurer.metrics(size),
    };
    const cache = createTextLayoutCache(counting);
    const shape = makeText();
    expect(cache.layout(shape)).toBe(cache.layout(shape));
    const afterFirst = measured;
    cache.reset();
    cache.layout(shape);
    expect(measured).toBeGreaterThan(afterFirst);
  });
});
