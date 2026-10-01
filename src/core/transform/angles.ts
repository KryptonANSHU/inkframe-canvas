const TAU = Math.PI * 2;
const RIGHT_ANGLE = Math.PI / 2;

/** Radians in [0, 2π), as shapes store them (PRD 1C). */
export function normalizeAngle(angle: number): number {
  const wrapped = angle % TAU;
  const positive = wrapped < 0 ? wrapped + TAU : wrapped;
  return positive >= TAU ? 0 : positive;
}

/** Nearest multiple of `step` radians. */
export function snapAngle(angle: number, step: number): number {
  return Math.round(angle / step) * step;
}

/** Whether the angle is a whole number of quarter turns (within float noise). */
export function isRightAngleMultiple(angle: number): boolean {
  const quarterTurns = angle / RIGHT_ANGLE;
  return Math.abs(quarterTurns - Math.round(quarterTurns)) < 1e-9;
}

/** Whether a quarter-turn multiple is an odd one (90°, 270°), which swaps x and y. */
export function isOddQuarterTurn(angle: number): boolean {
  return Math.abs(Math.round(angle / RIGHT_ANGLE)) % 2 === 1;
}
