// Opacity of an upcoming-move indicator as a function of its distance in plies.
//
// Kept independent from rendering so the values can be tuned (or replaced by a
// different curve) without touching the board code.

/**
 * Ordered from nearest to farthest. A distance uses the first step whose
 * `maxDistance` it does not exceed; anything beyond the last step uses
 * `fallback`.
 */
export const DEFAULT_OPACITY_STEPS = Object.freeze([
  Object.freeze({ maxDistance: 1, opacity: 0.8 }),
  Object.freeze({ maxDistance: 2, opacity: 0.6 }),
  Object.freeze({ maxDistance: 3, opacity: 0.4 }),
]);

export const DEFAULT_FALLBACK_OPACITY = 0.2;

/**
 * @param {number} distance  Plies until the move; 1 = next ply.
 * @param {{ steps?: ReadonlyArray<{maxDistance:number, opacity:number}>, fallback?: number }} [config]
 * @returns {number} Opacity in [0, 1].
 */
export function opacityForDistance(distance, config = {}) {
  const steps = config.steps ?? DEFAULT_OPACITY_STEPS;
  const fallback = config.fallback ?? DEFAULT_FALLBACK_OPACITY;
  if (!Number.isFinite(distance) || distance < 1) {
    throw new RangeError(`distance must be a number >= 1, got ${distance}`);
  }
  for (const step of steps) {
    if (distance <= step.maxDistance) return step.opacity;
  }
  return fallback;
}
