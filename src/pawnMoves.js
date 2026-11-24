// Finding upcoming pawn moves.
//
// Pure functions over the ply list produced by game.js. No rendering and no
// opacity logic lives here.

/**
 * @typedef {import('./game.js').Ply} Ply
 *
 * @typedef {Object} UpcomingPawnMove
 * @property {Ply} ply          The recorded pawn move.
 * @property {number} distance  Plies until it is played; the next ply to be played is 1.
 */

/**
 * Find the next recorded pawn move of `color` after `plyCount` plies have been
 * played.
 *
 * @param {readonly Ply[]} plies
 * @param {number} plyCount  Number of plies already played (0 = start position).
 * @param {'w'|'b'} color
 * @returns {UpcomingPawnMove|null}  null if that side plays no further pawn move.
 */
export function findNextPawnMove(plies, plyCount, color) {
  for (let i = Math.max(0, plyCount); i < plies.length; i++) {
    const ply = plies[i];
    if (ply.color === color && ply.isPawnMove) {
      return { ply, distance: i - plyCount + 1 };
    }
  }
  return null;
}

/**
 * Next recorded pawn move for both sides at the displayed position.
 * At the final position both are null.
 *
 * @param {readonly Ply[]} plies
 * @param {number} plyCount
 * @returns {{ w: UpcomingPawnMove|null, b: UpcomingPawnMove|null }}
 */
export function findNextPawnMoves(plies, plyCount) {
  return {
    w: findNextPawnMove(plies, plyCount, 'w'),
    b: findNextPawnMove(plies, plyCount, 'b'),
  };
}
