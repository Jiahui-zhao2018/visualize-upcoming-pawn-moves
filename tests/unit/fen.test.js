import { describe, it, expect } from 'vitest';
import { parseGame, fenAt } from '../../src/game.js';

// Expected FENs are written out by hand so the test checks the generated
// values rather than repeating chess.js.

const CASTLING_EP = '1. e4 Nf6 2. e5 d5 3. exd6 exd6 4. Nf3 Be7 5. Bc4 O-O 6. O-O *';
const CASTLING_EP_FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2',
  'rnbqkb1r/pppppppp/5n2/4P3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
  'rnbqkb1r/ppp1pppp/5n2/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3', // en passant target
  'rnbqkb1r/ppp1pppp/3P1n2/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3', // after exd6 e.p.
  'rnbqkb1r/ppp2ppp/3p1n2/8/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 4',
  'rnbqkb1r/ppp2ppp/3p1n2/8/8/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 4',
  'rnbqk2r/ppp1bppp/3p1n2/8/8/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 5',
  'rnbqk2r/ppp1bppp/3p1n2/8/2B5/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 5',
  'rnbq1rk1/ppp1bppp/3p1n2/8/2B5/5N2/PPPP1PPP/RNBQK2R w KQ - 4 6', // Black castled
  'rnbq1rk1/ppp1bppp/3p1n2/8/2B5/5N2/PPPP1PPP/RNBQ1RK1 b - - 5 6', // White castled
];

const PROMOTION =
  '[SetUp "1"]\n[FEN "4k3/P7/8/8/8/8/7p/4K3 w - - 7 40"]\n\n40. a8=Q+ Kd7 41. Kd2 h1=N *';
const PROMOTION_FENS = [
  '4k3/P7/8/8/8/8/7p/4K3 w - - 7 40',
  'Q3k3/8/8/8/8/8/7p/4K3 b - - 0 40',
  'Q7/3k4/8/8/8/8/7p/4K3 w - - 1 41',
  'Q7/3k4/8/8/8/8/3K3p/8 b - - 2 41',
  'Q7/3k4/8/8/8/8/3K4/7n w - - 0 42',
];

describe('fenAt', () => {
  it('gives full FENs for every position, incl. castling rights and en passant', () => {
    const game = parseGame(CASTLING_EP);
    expect(game.plies).toHaveLength(CASTLING_EP_FENS.length - 1);
    CASTLING_EP_FENS.forEach((fen, ply) => expect(fenAt(game, ply)).toBe(fen));
  });

  it('starts from a custom FEN and keeps its clocks, through promotion', () => {
    const game = parseGame(PROMOTION);
    expect(game.startFen).toBe(PROMOTION_FENS[0]);
    PROMOTION_FENS.forEach((fen, ply) => expect(fenAt(game, ply)).toBe(fen));
  });

  it('is the same stepping backward as forward', () => {
    const game = parseGame(CASTLING_EP);
    const n = game.plies.length;
    for (let ply = n; ply >= 0; ply--) expect(fenAt(game, ply)).toBe(CASTLING_EP_FENS[ply]);
  });

  it('uses the custom FEN for a game without moves', () => {
    const game = parseGame('[SetUp "1"]\n[FEN "8/8/8/8/8/8/k7/K7 b - - 3 12"]\n\n*');
    expect(fenAt(game, 0)).toBe('8/8/8/8/8/8/k7/K7 b - - 3 12');
  });
});
