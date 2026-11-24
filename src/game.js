// Parsing and game state.
//
// Turns PGN text into a plain, immutable description of the main line:
// the starting position plus one record per ply. Legality checking and SAN
// parsing are delegated to chess.js; variations, comments and NAGs are
// ignored by chess.js, so only the main line is kept.

import { Chess } from 'chess.js';

/** Raised when PGN input cannot be turned into a game. */
export class GameLoadError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GameLoadError';
  }
}

/**
 * @typedef {Object} Ply
 * @property {number} index      0-based ply index in the main line.
 * @property {'w'|'b'} color     Side that made the move.
 * @property {string} san
 * @property {string} from
 * @property {string} to
 * @property {string} piece      chess.js piece letter ('p', 'n', ...).
 * @property {string|undefined} captured
 * @property {string|undefined} promotion
 * @property {boolean} isPawnMove
 * @property {boolean} isEnPassant
 * @property {number} moveNumber Full-move number the ply belongs to.
 * @property {string} fenBefore
 * @property {string} fenAfter
 */

/**
 * @typedef {Object} Game
 * @property {Record<string,string>} headers
 * @property {string} startFen
 * @property {Ply[]} plies
 */

/**
 * Parse PGN text and return the main line of the (first) game.
 * @param {string} pgnText
 * @returns {Game}
 * @throws {GameLoadError}
 */
export function parseGame(pgnText) {
  const text = (pgnText ?? '').trim();
  if (text === '') {
    throw new GameLoadError('The PGN input is empty. Paste a game and press “Load game”.');
  }

  const chess = new Chess();
  try {
    chess.loadPgn(text);
  } catch (err) {
    throw new GameLoadError(`Could not load PGN: ${err?.message ?? String(err)}`);
  }

  const headers = { ...chess.getHeaders() };
  const history = chess.history({ verbose: true });

  if (history.length === 0 && !looksLikePgn(text)) {
    throw new GameLoadError(
      'No game was found in the input. Expected PGN tag pairs such as [Event "..."] and/or moves such as “1. e4 e5”.',
    );
  }

  const startFen = history.length > 0 ? history[0].before : chess.fen();

  const plies = history.map((m, index) => ({
    index,
    color: m.color,
    san: m.san,
    from: m.from,
    to: m.to,
    piece: m.piece,
    captured: m.captured,
    promotion: m.promotion,
    isPawnMove: m.piece === 'p',
    isEnPassant: m.flags.includes('e'),
    moveNumber: fullMoveNumber(m.before),
    fenBefore: m.before,
    fenAfter: m.after,
  }));

  return Object.freeze({ headers, startFen, plies: Object.freeze(plies) });
}

/**
 * FEN of the position after `plyCount` plies have been played.
 * @param {Game} game
 * @param {number} plyCount 0 … game.plies.length
 */
export function fenAt(game, plyCount) {
  const n = clampPly(game, plyCount);
  return n === 0 ? game.startFen : game.plies[n - 1].fenAfter;
}

/** Clamp a ply count to the valid range for the game. */
export function clampPly(game, plyCount) {
  return Math.max(0, Math.min(game.plies.length, Math.trunc(plyCount)));
}

function fullMoveNumber(fen) {
  const n = parseInt(fen.split(/\s+/)[5], 10);
  return Number.isFinite(n) ? n : 1;
}

// chess.js accepts arbitrary text without moves as an empty game. Accept that
// only when the input actually contains tag pairs or a result token, so that
// e.g. a pasted sentence is reported instead of silently showing nothing.
function looksLikePgn(text) {
  return /^\s*\[\s*\w+\s+"[^"]*"\s*\]/m.test(text) || /^(1-0|0-1|1\/2-1\/2|\*)$/.test(text);
}
