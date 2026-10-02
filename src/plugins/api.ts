import { z } from 'zod';
import { createShapesCommand, executeCommand, updateShapesCommand } from '../core/commands';
import { describeIssue, shapeSchema } from '../core/persistence/schema';
import type { Result } from '../core/result';
import { selectedShapes } from '../core/selection/selectedShapes';
import { createShapeId, type Shape, type ShapeId } from '../core/shapes';
import type { EditorStore } from '../core/store';
import type { TextMeasurer } from '../core/text/layout';
import { remeasured } from '../core/text/textShape';
import { LIMITS, type CallError, type Method } from './protocol';

export type ApiContext = {
  readonly store: EditorStore;
  /** Labels the plugin's undo steps and notifications. */
  readonly pluginName: string;
  readonly measurer: TextMeasurer;
  readonly notify: (message: string) => void;
};

type ApiResult = Result<unknown, CallError>;

const shapesParams = z.object({ shapes: z.array(z.unknown()).min(1) });
const updatesParams = z.object({
  updates: z.array(z.object({ id: z.string(), patch: z.record(z.string(), z.unknown()) })).min(1),
});
const notifyParams = z.object({ message: z.string().trim().min(1).max(200) });

/**
 * Runs one API call for a plugin whose permission has already been checked. Every
 * parameter is validated before anything changes, and each change is one undo step
 * named after the plugin.
 */
export function callApi(method: Method, params: unknown, context: ApiContext): ApiResult {
  switch (method) {
    case 'selection.get':
      return { ok: true, value: selectedShapes(context.store.getState()) };
    case 'shapes.create':
      return createShapes(params, context);
    case 'shapes.update':
      return updateShapes(params, context);
    case 'notify': {
      const parsed = notifyParams.safeParse(params);
      if (!parsed.success) return invalid(parsed.error);
      context.notify(parsed.data.message);
      return { ok: true, value: null };
    }
  }
}

/** Shapes come in without IDs that matter: the host assigns fresh ones. */
function createShapes(params: unknown, context: ApiContext): ApiResult {
  const parsed = shapesParams.safeParse(params);
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.shapes.length > LIMITS.maxShapesPerCall) return tooMany();
  const shapes: Shape[] = [];
  for (const [i, input] of parsed.data.shapes.entries()) {
    // A placeholder ID and zIndex let the document schema check the rest; both are
    // replaced, so a plugin can never overwrite a shape by guessing its ID.
    const candidate = shapeSchema.safeParse({
      ...(typeof input === 'object' && input !== null ? input : {}),
      id: 'pending',
      zIndex: 0,
    });
    if (!candidate.success) return invalid(candidate.error, `shapes[${String(i)}]`);
    const shape = settle({ ...candidate.data, id: createShapeId() }, context);
    if (shape !== null) shapes.push(shape);
  }
  const command = createShapesCommand(`${context.pluginName}: Create shapes`, shapes);
  return run(
    context,
    command,
    shapes.map((shape) => shape.id),
  );
}

/** A patch may change anything but a shape's ID, type, and place in the draw order. */
function updateShapes(params: unknown, context: ApiContext): ApiResult {
  const parsed = updatesParams.safeParse(params);
  if (!parsed.success) return invalid(parsed.error);
  const { updates } = parsed.data;
  if (updates.length > LIMITS.maxShapesPerCall) return tooMany();
  const { shapes } = context.store.getState().document;
  const before: Shape[] = [];
  const after: Shape[] = [];
  for (const [i, { id, patch }] of updates.entries()) {
    const current = shapes.get(id as ShapeId);
    if (current === undefined) {
      return { ok: false, error: { code: 'not-found', message: `No shape with ID "${id}".` } };
    }
    const style = typeof patch['style'] === 'object' ? patch['style'] : {};
    const candidate = shapeSchema.safeParse({
      ...current,
      ...patch,
      style: { ...current.style, ...style },
      id: current.id,
      type: current.type,
      zIndex: current.zIndex,
    });
    if (!candidate.success) return invalid(candidate.error, `updates[${String(i)}]`);
    const updated = settle(candidate.data, context);
    if (updated === null) return invalid(null, `updates[${String(i)}]: text can't be blank`);
    before.push(current);
    after.push(updated);
  }
  const command = updateShapesCommand(`${context.pluginName}: Update shapes`, before, after);
  return run(
    context,
    command,
    after.map((shape) => shape.id),
  );
}

/** Text heights from a plugin are untrusted: measured again with the real font. */
function settle(shape: Shape, context: ApiContext): Shape | null {
  return shape.type === 'text' ? remeasured(shape, context.measurer) : shape;
}

function run(
  context: ApiContext,
  command: Parameters<typeof executeCommand>[1],
  ids: readonly ShapeId[],
): ApiResult {
  const result = executeCommand(context.store, command);
  return result.ok
    ? { ok: true, value: ids }
    : { ok: false, error: { code: 'invalid-params', message: result.error.message } };
}

function invalid(error: z.ZodError | null, where?: string): ApiResult {
  const detail = error === null ? '' : describeIssue(error);
  const message = [where, detail].filter((part) => part !== undefined && part !== '').join(': ');
  return { ok: false, error: { code: 'invalid-params', message } };
}

function tooMany(): ApiResult {
  return {
    ok: false,
    error: {
      code: 'too-many-shapes',
      message: `One call may change at most ${String(LIMITS.maxShapesPerCall)} shapes.`,
    },
  };
}
