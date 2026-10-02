import type { Shape } from '../shapes';
import type { TemplateKit } from './kit';

/** A ready-made drawing to start from, built fresh (new IDs) each time it's loaded. */
export type Template = {
  readonly id: string;
  readonly name: string;
  /** One short line for the template's card. */
  readonly description: string;
  readonly build: (kit: TemplateKit) => Shape[];
};
