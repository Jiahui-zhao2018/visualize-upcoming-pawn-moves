import { describe, it, expect } from 'vitest';
import { parseGame, fenAt, GameLoadError } from '../../src/game.js';
import { findNextPawnMove, findNextPawnMoves } from '../../src/pawnMoves.js';
import { pawnIndicatorsAt } from '../../src/indicators.js';

const EXAMPLE = `[Event "Pawn Visualizer Example"]
[Result "*"]

1. Nf3 Nf6 2. g3 e6 3. Bg2 d5 *`;

const summary = (ind) => ind && { from: ind.from, to: ind.to, distance: ind.distance, opacity: ind.opacity };

describe('findNextPawnMoves on the example game', () => {
  const game = parseGame(EXAMPLE);

  it('at the start: White g2–g3 in 3 plies, Black e7–e6 in 4 plies', () => {
    const ind = pawnIndicatorsAt(game, 0);
    expect(summary(ind.w)).toEqual({ from: 'g2', to: 'g3', distance: 3, opacity: 0.4 });
    expect(summary(ind.b)).toEqual({ from: 'e7', to: 'e6', distance: 4, opacity: 0.2 });
  });

  it('after 1. Nf3: 2 and 3 plies', () => {
    const ind = pawnIndicatorsAt(game, 1);
    expect(summary(ind.w)).toEqual({ from: 'g2', to: 'g3', distance: 2, opacity: 0.6 });
    expect(summary(ind.b)).toEqual({ from: 'e7', to: 'e6', distance: 3, opacity: 0.4 });
  });

  it('after 2. g3: White has no further pawn move, Black e7–e6 is 1 ply away', () => {
    const ind = pawnIndicatorsAt(game, 3);
    expect(ind.w).toBeNull();
    expect(summary(ind.b)).toEqual({ from: 'e7', to: 'e6', distance: 1, opacity: 0.8 });
  });

  it('replaces a played pawn move with the side’s next one', () => {
    // After 2... e6, Black's next pawn move is 3... d5.
    const ind = pawnIndicatorsAt(game, 4);
    expect(summary(ind.b)).toEqual({ from: 'd7', to: 'd5', distance: 2, opacity: 0.6 });
  });

  it('stepping backward restores the earlier indicators', () => {
    const forward = [0, 1, 2, 3, 4, 5, 6].map((p) => pawnIndicatorsAt(game, p));
    const backward = [6, 5, 4, 3, 2, 1, 0].map((p) => pawnIndicatorsAt(game, p)).reverse();
    expect(backward).toEqual(forward);
    // e.g. going back from after 2. g3 to after 1. Nf3
    expect(summary(pawnIndicatorsAt(game, 1).w)).toEqual({ from: 'g2', to: 'g3', distance: 2, opacity: 0.6 });
  });

  it('shows nothing at the final position', () => {
    expect(findNextPawnMoves(game.plies, game.plies.length)).toEqual({ w: null, b: null });
  });
});

describe('findNextPawnMove edge cases', () => {
  it('returns null for both sides in a game without pawn moves', () => {
    const game = parseGame('1. Nf3 Nf6 2. Ng1 Ng8 *');
    for (let p = 0; p <= game.plies.length; p++) {
      expect(findNextPawnMoves(game.plies, p)).toEqual({ w: null, b: null });
    }
  });

  it('returns null for a game with no moves', () => {
    const game = parseGame('[Event "Empty"]\n\n*');
    expect(game.plies).toHaveLength(0);
    expect(findNextPawnMoves(game.plies, 0)).toEqual({ w: null, b: null });
  });

  it('a side runs out of pawn moves while the other still has some', () => {
    const game = parseGame('1. e4 Nf6 2. Nc3 Nc6 3. Nf3 d6 *');
    expect(findNextPawnMove(game.plies, 1, 'w')).toBeNull();
    expect(findNextPawnMove(game.plies, 1, 'b')).toMatchObject({ distance: 5 });
  });

  it('includes captures, pointing at the capture square', () => {
    const game = parseGame('1. e4 d5 2. exd5 Qxd5 *');
    const ind = pawnIndicatorsAt(game, 2);
    expect(ind.w).toMatchObject({ from: 'e4', to: 'd5', san: 'exd5', isCapture: true, distance: 1 });
    // The capture square is occupied by the black pawn in the displayed position.
    expect(fenAt(game, 2).split(' ')[0]).toBe('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR');
  });

  it('handles en passant with the recorded destination square', () => {
    const game = parseGame('1. e4 Nf6 2. e5 d5 3. exd6 *');
    const ind = pawnIndicatorsAt(game, 4);
    expect(ind.w).toMatchObject({ from: 'e5', to: 'd6', isEnPassant: true, isCapture: true, distance: 1 });
  });

  it('handles promotion and shows the promoted piece after it is played', () => {
    const pgn = '[SetUp "1"]\n[FEN "4k3/P7/8/8/8/8/7p/4K3 w - - 0 1"]\n\n1. a8=Q+ Kd7 2. Kd2 h1=N *';
    const game = parseGame(pgn);
    const start = pawnIndicatorsAt(game, 0);
    expect(start.w).toMatchObject({ from: 'a7', to: 'a8', promotion: 'q', distance: 1 });
    expect(start.b).toMatchObject({ from: 'h2', to: 'h1', promotion: 'n', distance: 4 });
    const after = pawnIndicatorsAt(game, 1);
    expect(after.w).toBeNull();
    expect(fenAt(game, 1).split(' ')[0]).toBe('Q3k3/8/8/8/8/8/7p/4K3');
  });

  it('supports games starting with Black to move from a FEN', () => {
    const game = parseGame('[SetUp "1"]\n[FEN "4k3/4p3/8/8/8/8/4P3/4K3 b - - 0 1"]\n\n1... e5 2. e4 *');
    expect(game.plies[0]).toMatchObject({ color: 'b', moveNumber: 1 });
    const ind = pawnIndicatorsAt(game, 0);
    expect(ind.b).toMatchObject({ to: 'e5', distance: 1 });
    expect(ind.w).toMatchObject({ to: 'e4', distance: 2 });
  });

  it('follows only the main line when the PGN contains variations', () => {
    const game = parseGame('1. Nf3 (1. e4 e5) 1... Nf6 (1... d5) 2. d4 *');
    expect(game.plies.map((p) => p.san)).toEqual(['Nf3', 'Nf6', 'd4']);
    expect(pawnIndicatorsAt(game, 0).w).toMatchObject({ to: 'd4', distance: 3 });
    expect(pawnIndicatorsAt(game, 0).b).toBeNull();
  });
});

describe('parseGame errors', () => {
  it.each([
    ['empty', ''],
    ['whitespace', '   \n  '],
    ['illegal move', '1. e5 *'],
    ['plain text', 'this is not a chess game'],
    ['bad FEN', '[SetUp "1"]\n[FEN "not a fen"]\n\n1. e4 *'],
  ])('rejects %s input with a GameLoadError', (_name, pgn) => {
    expect(() => parseGame(pgn)).toThrow(GameLoadError);
  });
});
