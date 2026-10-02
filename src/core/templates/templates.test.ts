import { describe, expect, it } from 'vitest';
import { invariantViolations } from '../invariants';
import { documentFromShapes } from '../persistence/fileFormat';
import { shapeSchema } from '../persistence/schema';
import { createEditorStore } from '../store';
import { fakeMeasurer } from '../testing/factories';
import { buildTemplate, templatePreview, TEMPLATES } from './templates';

describe.each(TEMPLATES)('template "$name"', (template) => {
  const shapes = buildTemplate(template, fakeMeasurer);

  it('builds a valid drawing: schema, invariants, attachments', () => {
    for (const shape of shapes) expect(shapeSchema.safeParse(shape).success).toBe(true);
    const document = documentFromShapes(shapes);
    expect(document.order).toHaveLength(shapes.length);
    expect(invariantViolations(createEditorStore({ document }).getState())).toEqual([]);
  });

  it('keeps every attached arrow attached when loaded', () => {
    const document = documentFromShapes(shapes);
    const attached = shapes.filter((shape) => shape.type === 'arrow' && shape.start !== undefined);
    expect(attached.length).toBeGreaterThan(0);
    for (const arrow of attached) {
      expect(document.shapes.get(arrow.id)).toMatchObject({ start: expect.anything() as unknown });
    }
  });

  it('gets fresh IDs every time, so loading twice never collides', () => {
    const again = buildTemplate(template, fakeMeasurer);
    expect(again[0]?.id).not.toBe(shapes[0]?.id);
  });

  it('has a preview in both themes', () => {
    expect(templatePreview(template, 'light')).toMatch(/^data:image\/svg\+xml/);
    expect(templatePreview(template, 'dark')).not.toBe(templatePreview(template, 'light'));
  });
});
