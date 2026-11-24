import { describe, it, expect } from 'vitest';
import { layoutIndicators, squareCenter } from '../../src/overlay.js';

const ind = (color, from, to, opacity = 0.8) => ({ color, from, to, opacity });
const never = () => false;

describe('squareCenter', () => {
  it('maps squares for both orientations', () => {
    expect(squareCenter('a1', 'white')).toEqual({ x: 0.5, y: 7.5 });
    expect(squareCenter('h8', 'white')).toEqual({ x: 7.5, y: 0.5 });
    expect(squareCenter('a1', 'black')).toEqual({ x: 7.5, y: 0.5 });
  });
});

describe('layoutIndicators', () => {
  it('draws a full-size ghost on an empty destination', () => {
    const [s] = layoutIndicators({ w: ind('w', 'g2', 'g3'), b: null }, { orientation: 'white', isOccupied: never });
    expect(s.ghost).toMatchObject({ mode: 'full', x: 6.5, y: 5.5 });
  });

  it('shrinks the ghost to a corner badge on an occupied (capture) square', () => {
    const [s] = layoutIndicators({ w: ind('w', 'e4', 'd5'), b: null }, { orientation: 'white', isOccupied: (sq) => sq === 'd5' });
    expect(s.ghost.mode).toBe('badge');
    expect(s.ghost.x).not.toBe(3.5);
  });

  it('splits the square when both sides target the same destination', () => {
    const shapes = layoutIndicators(
      { w: ind('w', 'e4', 'e5'), b: ind('b', 'e6', 'e5') },
      { orientation: 'white', isOccupied: never },
    );
    expect(shapes.map((s) => s.ghost.mode)).toEqual(['shared', 'shared']);
    expect(shapes[0].ghost.x).toBeLessThan(shapes[1].ghost.x);
  });

  it('offsets collinear overlapping arrows sideways', () => {
    const shapes = layoutIndicators(
      { w: ind('w', 'd2', 'd4'), b: ind('b', 'd5', 'd3') }, // not legal together, geometry only
      { orientation: 'white', isOccupied: never },
    );
    expect(shapes[0].start.x).toBeLessThan(3.5);
    expect(shapes[1].start.x).toBeGreaterThan(3.5);
  });

  it('keeps the indicator opacity', () => {
    const [s] = layoutIndicators({ w: null, b: ind('b', 'e7', 'e6', 0.2) }, { orientation: 'black', isOccupied: never });
    expect(s.opacity).toBe(0.2);
  });
});
