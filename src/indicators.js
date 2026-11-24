// Combines "which pawn move is next" with "how visible should it be" into a
// rendering-agnostic indicator description for the displayed position.

import { findNextPawnMoves } from './pawnMoves.js';
import { opacityForDistance } from './opacity.js';

/**
 * @typedef {Object} PawnIndicator
 * @property {'w'|'b'} color
 * @property {string} from
 * @property {string} to
 * @property {string} san
 * @property {number} plyIndex   Index of the pawn move in the main line.
 * @property {number} distance   Plies until it is played (1 = next ply).
 * @property {number} opacity    0 … 1, shared by arrow and ghost pawn.
 * @property {boolean} isCapture
 * @property {boolean} isEnPassant
 * @property {string|undefined} promotion
 */

/**
 * @param {import('./game.js').Game} game
 * @param {number} plyCount  Plies played at the displayed position.
 * @param {Parameters<typeof opacityForDistance>[1]} [opacityConfig]
 * @returns {{ w: PawnIndicator|null, b: PawnIndicator|null }}
 */
export function pawnIndicatorsAt(game, plyCount, opacityConfig) {
  const next = findNextPawnMoves(game.plies, plyCount);
  return {
    w: toIndicator(next.w, opacityConfig),
    b: toIndicator(next.b, opacityConfig),
  };
}

function toIndicator(upcoming, opacityConfig) {
  if (!upcoming) return null;
  const { ply, distance } = upcoming;
  return {
    color: ply.color,
    from: ply.from,
    to: ply.to,
    san: ply.san,
    plyIndex: ply.index,
    distance,
    opacity: opacityForDistance(distance, opacityConfig),
    isCapture: Boolean(ply.captured),
    isEnPassant: ply.isEnPassant,
    promotion: ply.promotion,
  };
}
