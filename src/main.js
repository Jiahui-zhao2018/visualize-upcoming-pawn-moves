// UI wiring: holds the view state (game, displayed ply, orientation) and
// delegates to the parsing, pawn-move, opacity and overlay modules.

import { Chessground } from '@lichess-org/chessground';
import '@lichess-org/chessground/assets/chessground.base.css';
import '@lichess-org/chessground/assets/chessground.brown.css';
import '@lichess-org/chessground/assets/chessground.cburnett.css';
import { Chess } from 'chess.js';
import './styles.css';

import { parseGame, fenAt, clampPly, GameLoadError } from './game.js';
import { pawnIndicatorsAt } from './indicators.js';
import { DEFAULT_OPACITY_STEPS, DEFAULT_FALLBACK_OPACITY } from './opacity.js';
import { layoutIndicators, renderOverlay } from './overlay.js';

const EXAMPLE_PGN = `[Event "Pawn Visualizer Example"]
[Result "*"]

1. Nf3 Nf6 2. g3 e6 3. Bg2 d5 *`;

const $ = (id) => document.getElementById(id);
const els = {
  input: $('pgn-input'),
  load: $('load-btn'),
  example: $('example-btn'),
  message: $('message'),
  board: $('board'),
  overlay: $('overlay'),
  first: $('first-btn'),
  prev: $('prev-btn'),
  next: $('next-btn'),
  last: $('last-btn'),
  flip: $('flip-btn'),
  positionLabel: $('position-label'),
  fenOutput: $('fen-output'),
  copyFen: $('copy-fen-btn'),
  copyStatus: $('copy-status'),
  showFens: $('show-fens'),
  nextW: $('next-w'),
  nextB: $('next-b'),
  moveList: $('move-list'),
  legendOpacity: $('legend-opacity'),
};

const state = {
  /** @type {import('./game.js').Game|null} */
  game: null,
  ply: 0,
  orientation: /** @type {'white'|'black'} */ ('white'),
};

const ground = Chessground(els.board, {
  viewOnly: true,
  coordinates: true,
  animation: { enabled: true, duration: 120 },
  drawable: { enabled: false, visible: false },
  highlight: { lastMove: true, check: true },
});

// ---------------------------------------------------------------- loading

function loadFromInput() {
  let game;
  try {
    game = parseGame(els.input.value);
  } catch (err) {
    const text = err instanceof GameLoadError ? err.message : `Unexpected error: ${err?.message ?? err}`;
    showMessage(text, 'error');
    return;
  }
  state.game = game;
  state.ply = 0;
  renderMoveList();
  render();

  const n = game.plies.length;
  const pawnCount = game.plies.filter((p) => p.isPawnMove).length;
  const parts = [`Loaded ${n} ${n === 1 ? 'ply' : 'plies'}.`];
  if (n === 0) parts.push('The game contains no moves.');
  else if (pawnCount === 0) parts.push('The game contains no pawn moves, so no indicators are shown.');
  showMessage(parts.join(' '), 'ok');
}

function showMessage(text, kind) {
  els.message.textContent = text;
  els.message.dataset.kind = kind;
}

// ---------------------------------------------------------------- navigation

function goTo(ply) {
  if (!state.game) return;
  const target = clampPly(state.game, ply);
  if (target === state.ply) return;
  state.ply = target;
  render();
}

els.load.addEventListener('click', loadFromInput);
els.example.addEventListener('click', () => {
  els.input.value = EXAMPLE_PGN;
  els.input.focus();
});
els.first.addEventListener('click', () => goTo(0));
els.prev.addEventListener('click', () => goTo(state.ply - 1));
els.next.addEventListener('click', () => goTo(state.ply + 1));
els.last.addEventListener('click', () => state.game && goTo(state.game.plies.length));
els.flip.addEventListener('click', () => {
  state.orientation = state.orientation === 'white' ? 'black' : 'white';
  render();
});
els.copyFen.addEventListener('click', copyCurrentFen);
els.showFens.addEventListener('change', () => {
  els.moveList.classList.toggle('show-fens', els.showFens.checked);
});
els.moveList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-ply]');
  if (btn) goTo(Number(btn.dataset.ply));
});
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const actions = {
    ArrowLeft: () => goTo(state.ply - 1),
    ArrowRight: () => goTo(state.ply + 1),
    Home: () => goTo(0),
    End: () => state.game && goTo(state.game.plies.length),
    f: () => els.flip.click(),
  };
  const action = actions[e.key];
  if (action) {
    e.preventDefault();
    action();
  }
});

// ---------------------------------------------------------------- rendering

function render() {
  const game = state.game;
  const fen = game ? fenAt(game, state.ply) : new Chess().fen();
  const position = new Chess(fen);
  const lastPly = game && state.ply > 0 ? game.plies[state.ply - 1] : null;

  ground.set({
    fen,
    orientation: state.orientation,
    turnColor: position.turn() === 'w' ? 'white' : 'black',
    check: position.inCheck(),
    lastMove: lastPly ? [lastPly.from, lastPly.to] : undefined,
  });

  const indicators = game ? pawnIndicatorsAt(game, state.ply) : { w: null, b: null };
  const shapes = layoutIndicators(indicators, {
    orientation: state.orientation,
    isOccupied: (sq) => Boolean(position.get(sq)),
  });
  renderOverlay(els.overlay, shapes);

  els.fenOutput.textContent = fen;
  els.copyStatus.textContent = '';
  renderNextMoves(indicators);
  renderNavigation();
  highlightMoveList(indicators);
}

function describeIndicator(ind) {
  if (!ind) return 'No further pawn move';
  const plies = ind.distance === 1 ? '1 ply' : `${ind.distance} plies`;
  const extra = [];
  if (ind.isEnPassant) extra.push('en passant');
  else if (ind.isCapture) extra.push('capture');
  if (ind.promotion) extra.push(`promotes to ${ind.promotion.toUpperCase()}`);
  return `${ind.san} (${ind.from}–${ind.to}${extra.length ? ', ' + extra.join(', ') : ''}) · ${plies} away · ${Math.round(ind.opacity * 100)}%`;
}

function renderNextMoves(indicators) {
  for (const color of ['w', 'b']) {
    const node = color === 'w' ? els.nextW : els.nextB;
    const ind = indicators[color];
    node.textContent = state.game ? describeIndicator(ind) : '—';
    node.dataset.distance = ind ? String(ind.distance) : '';
  }
}

function renderNavigation() {
  const game = state.game;
  const total = game ? game.plies.length : 0;
  els.first.disabled = els.prev.disabled = !game || state.ply === 0;
  els.next.disabled = els.last.disabled = !game || state.ply === total;

  let label = 'No game loaded';
  if (game) {
    if (state.ply === 0) label = 'Starting position';
    else {
      const p = game.plies[state.ply - 1];
      label = `After ${p.moveNumber}${p.color === 'w' ? '.' : '…'} ${p.san}`;
    }
    label += ` — ply ${state.ply} of ${total}`;
    if (total > 0 && state.ply === total) {
      const result = game.headers.Result;
      label += ` (final position${result && result !== '*' ? `, ${result}` : ''})`;
    }
  }
  els.positionLabel.textContent = label;
}

function renderMoveList() {
  const game = state.game;
  els.moveList.replaceChildren();
  if (!game) return;

  const startLi = document.createElement('li');
  startLi.className = 'move-row start-row';
  startLi.appendChild(moveButton(0, 'Start', game.startFen));
  startLi.appendChild(fenLine(0, 'Start', game.startFen));
  els.moveList.appendChild(startLi);

  let row = null;
  for (const ply of game.plies) {
    if (ply.color === 'w' || row === null) {
      row = document.createElement('li');
      row.className = 'move-row';
      const num = document.createElement('span');
      num.className = 'move-number';
      num.textContent = `${ply.moveNumber}.`;
      row.appendChild(num);
      if (ply.color === 'b') {
        const filler = document.createElement('span');
        filler.className = 'move filler';
        filler.textContent = '…';
        row.appendChild(filler);
      }
      els.moveList.appendChild(row);
    }
    const btn = moveButton(ply.index + 1, ply.san, ply.fenAfter);
    if (ply.isPawnMove) btn.classList.add('pawn-move');
    // Buttons first, FEN lines after them, so the grid keeps moves on one row.
    row.insertBefore(btn, row.querySelector('.fen-line'));
    const label = `${ply.moveNumber}${ply.color === 'w' ? '.' : '…'} ${ply.san}`;
    row.appendChild(fenLine(ply.index + 1, label, ply.fenAfter));
  }
}

function moveButton(plyCount, text, fen) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'move';
  btn.dataset.ply = String(plyCount);
  btn.title = `FEN: ${fen}`;
  btn.textContent = text;
  return btn;
}

/** FEN of a position in the move list; shown when “Show FENs” is checked. */
function fenLine(plyCount, label, fen) {
  const line = document.createElement('div');
  line.className = 'fen-line';
  line.dataset.fenPly = String(plyCount);
  const name = document.createElement('span');
  name.className = 'fen-line-label';
  name.textContent = `${label}:`;
  const code = document.createElement('code');
  code.textContent = fen;
  line.append(name, ' ', code);
  return line;
}

async function copyCurrentFen() {
  const fen = els.fenOutput.textContent;
  let ok = false;
  try {
    await navigator.clipboard.writeText(fen);
    ok = true;
  } catch {
    // Fallback for browsers/contexts without the async clipboard API.
    selectFenText();
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
  }
  els.copyStatus.textContent = ok ? 'FEN copied to clipboard.' : 'Could not copy automatically; the FEN is selected, press Ctrl+C / ⌘C.';
  els.copyStatus.dataset.kind = ok ? 'ok' : 'error';
  if (!ok) selectFenText();
}

function selectFenText() {
  const range = document.createRange();
  range.selectNodeContents(els.fenOutput);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function highlightMoveList(indicators) {
  for (const btn of els.moveList.querySelectorAll('[data-ply]')) {
    const plyCount = Number(btn.dataset.ply);
    const current = plyCount === state.ply;
    btn.classList.toggle('current', current);
    els.moveList.querySelector(`[data-fen-ply="${plyCount}"]`)?.classList.toggle('current', current);
    if (current) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
    btn.classList.toggle('next-pawn-w', indicators.w?.plyIndex === plyCount - 1);
    btn.classList.toggle('next-pawn-b', indicators.b?.plyIndex === plyCount - 1);
    if (current) btn.scrollIntoView({ block: 'nearest' });
  }
}

function renderOpacityLegend() {
  const rows = DEFAULT_OPACITY_STEPS.map((s) => [`${s.maxDistance}`, s.opacity]);
  const last = DEFAULT_OPACITY_STEPS[DEFAULT_OPACITY_STEPS.length - 1].maxDistance;
  rows.push([`${last + 1}+`, DEFAULT_FALLBACK_OPACITY]);
  const title = document.createElement('div');
  title.className = 'legend-opacity-title';
  title.textContent = 'Plies away → opacity';
  els.legendOpacity.replaceChildren(title);
  for (const [label, opacity] of rows) {
    const cell = document.createElement('div');
    cell.className = 'legend-opacity-cell';
    const chip = document.createElement('span');
    chip.className = 'legend-chip';
    chip.style.opacity = String(opacity);
    cell.append(chip, `${label}: ${Math.round(opacity * 100)}%`);
    els.legendOpacity.appendChild(cell);
  }
}

renderOpacityLegend();
render();

// Exposed for UI tests and debugging in the console.
window.__pawnViz = { state, goTo };
