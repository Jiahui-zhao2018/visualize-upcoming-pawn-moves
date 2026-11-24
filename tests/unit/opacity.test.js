import { describe, it, expect } from 'vitest';
import { opacityForDistance } from '../../src/opacity.js';

describe('opacityForDistance', () => {
  it.each([
    [1, 0.8],
    [2, 0.6],
    [3, 0.4],
    [4, 0.2],
    [5, 0.2],
    [40, 0.2],
  ])('distance %i → %f', (distance, expected) => {
    expect(opacityForDistance(distance)).toBe(expected);
  });

  it('accepts a custom configuration', () => {
    const config = { steps: [{ maxDistance: 2, opacity: 1 }], fallback: 0.1 };
    expect(opacityForDistance(1, config)).toBe(1);
    expect(opacityForDistance(2, config)).toBe(1);
    expect(opacityForDistance(3, config)).toBe(0.1);
  });

  it.each([0, -1, NaN])('rejects invalid distance %s', (d) => {
    expect(() => opacityForDistance(d)).toThrow(RangeError);
  });
});
