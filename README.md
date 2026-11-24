# Upcoming Pawn Moves

A local browser app for exploring how piece moves relate to later pawn moves.
Paste a PGN, step through the game one ply at a time, and see each side's
**next recorded pawn move** drawn on the board: an arrow from origin to
destination plus a see-through "ghost" pawn on the destination square. The
closer the move, the more opaque the indicator.

The app only shows moves present in the PGN (main line). It does not use an
engine and does not judge whether a piece move actually prepared a pawn move.

## Requirements

- Node.js 20 or newer (developed with Node 22) and npm
- A desktop browser (Chrome, Firefox, Safari, Edge)

## Setup and running

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:5173>. Paste a PGN (or press **Insert example**), then
press **Load game**.

To build a static bundle instead: `npm run build`, then `npm run preview`
(or serve the `dist/` folder with any static web server).

### Controls

| Action | Button | Keyboard |
|---|---|---|
| Starting position | ⏮ | Home |
| Back one ply | ◀ | ← |
| Forward one ply | ▶ | → |
| Final position | ⏭ | End |
| Flip board | Flip board | F |
| Jump to a position | click a move in the move list | |

### FEN display

The full FEN of the displayed position is shown below the board and updates
on every step. **Copy FEN** puts it on the clipboard. In the move list, hover
a move to see the FEN after it, or tick **Show FENs** to list the FEN of every
position, the starting position included. All FENs come from chess.js and
include the side to move, castling rights, en passant target, halfmove clock
and fullmove number. With a `[FEN]` tag, the game starts from that position
and its clocks carry on from there.

The move list highlights the current position. Pawn moves are bold, and the
move each indicator points at is underlined in that side's colour.

## Tests

Unit tests (Vitest) for PGN parsing, FEN generation (castling, en passant,
promotion, custom start), finding the next pawn move, opacity and indicator
layout:

```bash
npm test
```

UI tests (Playwright, Chromium). They start the dev server automatically and
check the example game from the specification, stepping backward, flipping,
captures, promotion, overlapping indicators, the FEN display and copy
button, and invalid input:

```bash
npm run test:ui
```

If Playwright has no browser installed on your machine, run
`npx playwright install chromium` once.

## How it works

| File | Responsibility |
|---|---|
| `src/game.js` | Parses PGN with [chess.js](https://github.com/jhlywa/chess.js) into a start FEN plus one record per ply (main line only). Reports load errors as `GameLoadError`. |
| `src/pawnMoves.js` | `findNextPawnMove(plies, plyCount, color)`: pure search for each side's next pawn move and its distance in plies. |
| `src/opacity.js` | `opacityForDistance(distance, config?)`: the distance → opacity table (1: 80%, 2: 60%, 3: 40%, 4+: 20%). Change `DEFAULT_OPACITY_STEPS` / `DEFAULT_FALLBACK_OPACITY` or pass a config to tune it. |
| `src/indicators.js` | Combines the two above into a rendering-independent indicator per side. |
| `src/overlay.js` | Lays out and draws the arrows and ghost pawns as an SVG layer above the board. |
| `src/main.js` | UI state and wiring. The board is drawn by [chessground](https://github.com/lichess-org/chessground) in view-only mode. |

Distance is counted in plies: with `n` plies played, a pawn move at ply index
`i` (0-based) is `i − n + 1` plies away, so the next move to be played is
1 ply away.

### Visual conventions

- White's indicator is blue (`#0072B2`), Black's is vermillion (`#D55E00`)
  (Okabe–Ito colours, distinguishable with common colour-vision deficiencies).
- The ghost pawn has a dashed outline in the side's colour and a white
  (White) or dark (Black) translucent fill, so it reads as an overlay rather
  than a real piece. Arrow and ghost share one opacity.
- **Captures:** the arrow points at the capture square; the ghost shrinks to a
  corner badge so the piece on that square stays visible.
- **En passant:** arrow and ghost use the recorded destination square.
- **Promotion:** a ghost pawn is shown before the move; afterwards the board
  shows the promoted piece. The side panel states the promotion piece.
- **Overlaps:** if both sides target the same square, each ghost takes one
  half of it (White left, Black right). Arrows lying on top of each other are
  shifted sideways. The overlay never changes the board position.

## Known limitations

- Only the first game in a multi-game PGN is used, and only its main line;
  variations, comments and NAGs are ignored.
- Custom starting positions are supported through the `[FEN "..."]` tag (with
  `[SetUp "1"]`) as handled by chess.js. Chess960 castling notation is not
  supported.
- FENs follow chess.js: the en passant square is written only when an en
  passant capture is actually possible (as lichess and Stockfish do), not
  after every two-square pawn move. After `1. e4` the field is `-`, not `e3`.
- Copying uses the browser clipboard API. If the browser blocks it, the FEN is
  selected so it can be copied with Ctrl+C / ⌘C.
- Move legality is checked by chess.js; a PGN with an illegal or ambiguous move
  is rejected as a whole, with the offending move named in the error message.
- Input that contains no tag pairs and no moves (e.g. plain prose) is rejected.
  A PGN with headers but no moves loads as an empty game.
- Indicators are drawn above the pieces. At 80% opacity an arrow covers part of
  the piece it passes over (the ghost on an occupied square is a small badge
  to keep that piece visible).
- The layout targets desktop browsers; small screens stack the panels but are
  not otherwise optimised.
