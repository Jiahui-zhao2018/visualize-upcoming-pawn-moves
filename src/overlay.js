// Rendering of pawn-move indicators as an SVG layer laid over the board.
//
// The layer is purely visual (pointer-events: none) and never touches the
// board state. Geometry is computed by `layoutIndicators` (pure, testable);
// `renderOverlay` turns that layout into SVG.
//
// Coordinate system: the SVG viewBox is 0 0 8 8, one unit per square, with
// (0, 0) at the top-left corner of the board as displayed.

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Visual style per side. Okabe–Ito blue / vermillion: distinguishable with common colour-vision deficiencies. */
export const SIDE_STYLE = Object.freeze({
  w: Object.freeze({ arrow: '#0072B2', ghostFill: '#ffffff', ghostStroke: '#0072B2', label: 'White' }),
  b: Object.freeze({ arrow: '#D55E00', ghostFill: '#1a1a1a', ghostStroke: '#D55E00', label: 'Black' }),
});

const GHOST_SCALE_FULL = 0.85;
const GHOST_SCALE_SHARED = 0.55;
const GHOST_SCALE_BADGE = 0.55;
const PARALLEL_OFFSET = 0.14;
// Arrows start a little off the origin centre and stop before the ghost, so
// neither the moving pawn nor the ghost is fully covered.
const ARROW_START_GAP = 0.1;
const ARROW_TIP_GAP = { full: 0.3, shared: 0.2, badge: 0.22 };

/** Centre of a square in board units for the given orientation. */
export function squareCenter(square, orientation) {
  const file = square.charCodeAt(0) - 97; // a = 0
  const rank = parseInt(square[1], 10) - 1; // 1 = 0
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return { x: col + 0.5, y: row + 0.5 };
}

/**
 * @typedef {import('./indicators.js').PawnIndicator} PawnIndicator
 * @typedef {Object} IndicatorShape
 * @property {'w'|'b'} color
 * @property {number} opacity
 * @property {{x:number,y:number}} start   Arrow start.
 * @property {{x:number,y:number}} tip     Arrow tip.
 * @property {{x:number,y:number,scale:number,mode:'full'|'shared'|'badge'}} ghost  Ghost pawn centre and size.
 */

/**
 * Compute geometry for the indicators.
 *
 * - Destination empty: ghost pawn fills the destination square.
 * - Destination occupied (capture): ghost pawn shrinks to a corner badge so the
 *   piece on that square stays visible.
 * - Both sides target the same square: each ghost takes one half of the square.
 * - Arrows that would run on top of each other are offset sideways.
 *
 * @param {{ w: PawnIndicator|null, b: PawnIndicator|null }} indicators
 * @param {{ orientation: 'white'|'black', isOccupied: (square: string) => boolean }} options
 * @returns {IndicatorShape[]}
 */
export function layoutIndicators(indicators, { orientation, isOccupied }) {
  const list = [indicators.w, indicators.b].filter(Boolean);
  const sameDestination = list.length === 2 && list[0].to === list[1].to;
  const overlapping = list.length === 2 && arrowsOverlap(list[0], list[1], orientation);

  return list.map((ind) => {
    // White to the left, Black to the right, as seen on screen.
    const side = ind.color === 'w' ? -1 : 1;
    const start = squareCenter(ind.from, orientation);
    const dest = squareCenter(ind.to, orientation);

    let ghost;
    if (sameDestination) {
      ghost = { x: dest.x + side * 0.25, y: dest.y, scale: GHOST_SCALE_SHARED, mode: 'shared' };
    } else if (isOccupied(ind.to)) {
      ghost = { x: dest.x + side * 0.27, y: dest.y + 0.27 * (ind.color === 'w' ? 1 : -1), scale: GHOST_SCALE_BADGE, mode: 'badge' };
    } else {
      ghost = { x: dest.x, y: dest.y, scale: GHOST_SCALE_FULL, mode: 'full' };
    }

    let target = sameDestination ? { x: ghost.x, y: ghost.y } : dest;
    let from = start;
    if (overlapping && !sameDestination) {
      const n = perpendicular(start, dest);
      const k = side * PARALLEL_OFFSET * Math.sign(n.x || 1);
      from = { x: start.x + n.x * k, y: start.y + n.y * k };
      target = { x: dest.x + n.x * k, y: dest.y + n.y * k };
    }

    const tip = shorten(from, target, ARROW_TIP_GAP[ghost.mode]);
    return { color: ind.color, opacity: ind.opacity, start: shorten(tip, from, ARROW_START_GAP), tip, ghost };
  });
}

/** Arrows overlap when they lie on the same line and their extents intersect. */
function arrowsOverlap(a, b, orientation) {
  const a1 = squareCenter(a.from, orientation), a2 = squareCenter(a.to, orientation);
  const b1 = squareCenter(b.from, orientation), b2 = squareCenter(b.to, orientation);
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (Math.abs(cross(a1, a2, b1)) > 1e-9 || Math.abs(cross(a1, a2, b2)) > 1e-9) return false;
  const proj = (p) => p.x * (a2.x - a1.x) + p.y * (a2.y - a1.y);
  const [aMin, aMax] = [proj(a1), proj(a2)].sort((x, y) => x - y);
  const [bMin, bMax] = [proj(b1), proj(b2)].sort((x, y) => x - y);
  return aMin <= bMax && bMin <= aMax;
}

function perpendicular(p, q) {
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function shorten(p, q, by) {
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len <= by) return q;
  return { x: q.x - (dx / len) * by, y: q.y - (dy / len) * by };
}

/** Closed polygon for an arrow (shaft + head), drawn as one path so it can be outlined. */
function arrowPath(start, tip) {
  const dx = tip.x - start.x, dy = tip.y - start.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const shaft = 0.07, head = 0.2;
  const headLen = Math.min(0.34, len * 0.6);
  const bx = tip.x - ux * headLen, by = tip.y - uy * headLen;
  const pts = [
    [start.x + nx * shaft, start.y + ny * shaft],
    [bx + nx * shaft, by + ny * shaft],
    [bx + nx * head, by + ny * head],
    [tip.x, tip.y],
    [bx - nx * head, by - ny * head],
    [bx - nx * shaft, by - ny * shaft],
    [start.x - nx * shaft, start.y - ny * shaft],
  ];
  return 'M' + pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L') + ' Z';
}

// Pawn silhouette in a unit box centred on (0, 0).
const PAWN_PATH =
  'M0 -0.40 A0.15 0.15 0 1 1 -0.001 -0.40 Z ' +
  'M-0.13 -0.08 Q0 -0.16 0.13 -0.08 L0.21 0.27 L-0.21 0.27 Z ' +
  'M-0.31 0.27 H0.31 V0.39 H-0.31 Z';

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/**
 * Draw the layout into the given <svg> element (contents are replaced).
 * @param {SVGSVGElement} svg
 * @param {IndicatorShape[]} shapes
 */
export function renderOverlay(svg, shapes) {
  svg.setAttribute('viewBox', '0 0 8 8');
  svg.replaceChildren();
  for (const shape of shapes) {
    const style = SIDE_STYLE[shape.color];
    const g = el('g', {
      class: `pawn-indicator pawn-indicator-${shape.color}`,
      opacity: shape.opacity,
      'data-color': shape.color,
      'data-opacity': shape.opacity,
      'data-ghost-mode': shape.ghost.mode,
    });
    g.appendChild(
      el('path', {
        class: 'indicator-arrow',
        d: arrowPath(shape.start, shape.tip),
        fill: style.arrow,
        stroke: 'rgba(255,255,255,0.85)',
        'stroke-width': 0.025,
        'stroke-linejoin': 'round',
      }),
    );
    const { x, y, scale } = shape.ghost;
    const ghost = el('g', { class: 'indicator-ghost', transform: `translate(${x} ${y}) scale(${scale})` });
    ghost.appendChild(
      el('path', {
        d: PAWN_PATH,
        fill: style.ghostFill,
        'fill-opacity': 0.6,
        stroke: style.ghostStroke,
        'stroke-width': 0.055 / Math.max(scale, 0.6),
        'stroke-dasharray': '0.11 0.06',
        'stroke-linejoin': 'round',
      }),
    );
    g.appendChild(ghost);
    svg.appendChild(g);
  }
}
