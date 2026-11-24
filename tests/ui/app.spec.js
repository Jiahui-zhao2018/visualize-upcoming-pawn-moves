import { test, expect } from '@playwright/test';

const EXAMPLE = `[Event "Pawn Visualizer Example"]
[Result "*"]

1. Nf3 Nf6 2. g3 e6 3. Bg2 d5 *`;

async function load(page, pgn) {
  await page.goto('/');
  await page.fill('#pgn-input', pgn);
  await page.click('#load-btn');
}

/** Read the rendered indicators straight from the overlay SVG. */
async function indicators(page) {
  return page.$$eval('#overlay .pawn-indicator', (gs) =>
    Object.fromEntries(gs.map((g) => [g.dataset.color, { opacity: Number(g.dataset.opacity), mode: g.dataset.ghostMode }])),
  );
}

test('example game: indicators, distances and stepping back', async ({ page }) => {
  await load(page, EXAMPLE);
  await expect(page.locator('#message')).toHaveText(/Loaded 6 plies/);

  // Start: g2–g3 3 plies away (40%), e7–e6 4 plies away (20%).
  await expect(page.locator('#next-w')).toHaveText(/g3 \(g2–g3\) · 3 plies away · 40%/);
  await expect(page.locator('#next-b')).toHaveText(/e6 \(e7–e6\) · 4 plies away · 20%/);
  expect(await indicators(page)).toEqual({ w: { opacity: 0.4, mode: 'full' }, b: { opacity: 0.2, mode: 'full' } });
  await page.waitForTimeout(300); // let piece animation settle
  await page.screenshot({ path: 'test-results/start.png' });

  // After 1. Nf3: 2 and 3 plies.
  await page.click('#next-btn');
  await expect(page.locator('#next-w')).toHaveText(/2 plies away · 60%/);
  await expect(page.locator('#next-b')).toHaveText(/3 plies away · 40%/);
  expect(await indicators(page)).toEqual({ w: { opacity: 0.6, mode: 'full' }, b: { opacity: 0.4, mode: 'full' } });

  // After 2. g3 (ply 3): no White indicator, e7–e6 1 ply away.
  await page.click('#next-btn');
  await page.click('#next-btn');
  await expect(page.locator('#position-label')).toHaveText(/After 2\. g3/);
  await expect(page.locator('#next-w')).toHaveText('No further pawn move');
  await expect(page.locator('#next-b')).toHaveText(/e6 \(e7–e6\) · 1 ply away · 80%/);
  expect(await indicators(page)).toEqual({ b: { opacity: 0.8, mode: 'full' } });
  await page.waitForTimeout(300); // let piece animation settle
  await page.screenshot({ path: 'test-results/after-g3.png' });

  // Back to after 1. Nf3, then to the start.
  await page.click('#prev-btn');
  await page.click('#prev-btn');
  expect(await indicators(page)).toEqual({ w: { opacity: 0.6, mode: 'full' }, b: { opacity: 0.4, mode: 'full' } });
  await page.click('#first-btn');
  expect(await indicators(page)).toEqual({ w: { opacity: 0.4, mode: 'full' }, b: { opacity: 0.2, mode: 'full' } });

  // Final position: no indicators, forward controls disabled.
  await page.click('#last-btn');
  expect(await indicators(page)).toEqual({});
  await expect(page.locator('#next-btn')).toBeDisabled();
  await expect(page.locator('#position-label')).toHaveText(/final position/);

  // Move list click and keyboard navigation.
  await page.click('#move-list [data-ply="2"]');
  await expect(page.locator('#move-list .move.current')).toHaveText('Nf6');
  await page.locator('body').press('ArrowLeft');
  await expect(page.locator('#move-list .move.current')).toHaveText('Nf3');
});

test('flip board keeps indicators and mirrors their geometry', async ({ page }) => {
  await load(page, EXAMPLE);
  const pathBefore = await page.getAttribute('#overlay .pawn-indicator-w .indicator-arrow', 'd');
  await page.click('#flip-btn');
  await expect(page.locator('#board.orientation-black')).toHaveCount(1);
  const pathAfter = await page.getAttribute('#overlay .pawn-indicator-w .indicator-arrow', 'd');
  expect(pathAfter).not.toEqual(pathBefore);
  expect(Object.keys(await indicators(page))).toEqual(['w', 'b']);
  await page.waitForTimeout(300); // let piece animation settle
  await page.screenshot({ path: 'test-results/flipped.png' });
});

test('capture shows a corner badge and keeps the captured piece', async ({ page }) => {
  await load(page, '1. e4 d5 2. exd5 *');
  await page.click('#next-btn');
  await page.click('#next-btn');
  expect((await indicators(page)).w).toEqual({ opacity: 0.8, mode: 'badge' });
  // The black pawn on d5 is still rendered by the board.
  await expect(page.locator('#board piece.black.pawn')).toHaveCount(8);
  await page.waitForTimeout(300); // let piece animation settle
  await page.screenshot({ path: 'test-results/capture.png' });
});

test('promotion: ghost before, promoted piece after', async ({ page }) => {
  await load(page, '[SetUp "1"]\n[FEN "4k3/P7/8/8/8/8/8/4K3 w - - 0 1"]\n\n1. a8=Q+ *');
  await expect(page.locator('#next-w')).toHaveText(/promotes to Q/);
  await page.click('#next-btn');
  expect(await indicators(page)).toEqual({});
  await expect(page.locator('#board piece.white.queen')).toHaveCount(1);
});

test('invalid and edge-case input does not crash', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));

  await load(page, '');
  await expect(page.locator('#message')).toHaveAttribute('data-kind', 'error');
  await expect(page.locator('#message')).toHaveText(/empty/);

  await page.fill('#pgn-input', '1. e4 e5 2. Ke3 *');
  await page.click('#load-btn');
  await expect(page.locator('#message')).toHaveText(/Could not load PGN/);

  await page.fill('#pgn-input', '1. Nf3 Nf6 2. Ng1 Ng8 1/2-1/2');
  await page.click('#load-btn');
  await expect(page.locator('#message')).toHaveText(/no pawn moves/);
  expect(await indicators(page)).toEqual({});
  await page.click('#last-btn');
  await page.locator('body').press('ArrowRight');
  await expect(page.locator('#position-label')).toHaveText(/ply 4 of 4 \(final position, 1\/2-1\/2\)/);

  // A game that has ended in checkmate.
  await page.fill('#pgn-input', '1. f3 e5 2. g4 Qh4# 0-1');
  await page.click('#load-btn');
  await page.click('#last-btn');
  expect(await indicators(page)).toEqual({});

  expect(errors).toEqual([]);
});

test('both sides targeting the same square stay distinguishable', async ({ page }) => {
  await load(page, '1. e4 Nf6 2. e5 Nd5 3. Nf3 d6 4. exd6 *');
  await page.click('#last-btn');
  await page.click('#first-btn');
  for (let i = 0; i < 4; i++) await page.click('#next-btn');
  // White's next pawn move is exd6 (capture onto d6), Black's is d7–d6: same destination.
  expect(await indicators(page)).toEqual({ w: { opacity: 0.4, mode: 'shared' }, b: { opacity: 0.6, mode: 'shared' } });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/shared.png' });
});

test('FEN display follows navigation and can be copied', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await load(page, '1. e4 Nf6 2. e5 d5 3. exd6 exd6 4. Nf3 Be7 5. Bc4 O-O 6. O-O *');
  const fen = page.locator('#fen-output');
  await expect(fen).toHaveText('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  for (let i = 0; i < 4; i++) await page.click('#next-btn');
  await expect(fen).toHaveText('rnbqkb1r/ppp1pppp/5n2/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');
  await page.click('#next-btn'); // exd6 e.p.
  await expect(fen).toHaveText('rnbqkb1r/ppp1pppp/3P1n2/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3');
  await page.click('#prev-btn');
  await expect(fen).toHaveText('rnbqkb1r/ppp1pppp/5n2/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3');

  await page.click('#last-btn'); // after both sides castled
  await expect(fen).toHaveText('rnbq1rk1/ppp1bppp/3p1n2/8/2B5/5N2/PPPP1PPP/RNBQ1RK1 b - - 5 6');
  await page.click('#prev-btn');
  await expect(fen).toHaveText('rnbq1rk1/ppp1bppp/3p1n2/8/2B5/5N2/PPPP1PPP/RNBQK2R w KQ - 4 6');

  await page.click('#copy-fen-btn');
  await expect(page.locator('#copy-status')).toHaveText('FEN copied to clipboard.');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'rnbq1rk1/ppp1bppp/3p1n2/8/2B5/5N2/PPPP1PPP/RNBQK2R w KQ - 4 6',
  );

  // Move list: FENs hidden until toggled; one per position incl. the start.
  const lines = page.locator('#move-list .fen-line');
  await expect(lines).toHaveCount(12);
  await expect(lines.first()).toBeHidden();
  await page.check('#show-fens');
  await expect(lines.first()).toBeVisible();
  await expect(lines.first()).toHaveText(/Start: rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR w KQkq - 0 1/);
  await expect(page.locator('#move-list [data-fen-ply="5"]')).toHaveText(/3\. exd6: .* b KQkq - 0 3/);
  await expect(page.locator('#move-list .fen-line.current')).toHaveAttribute('data-fen-ply', '10');
  await expect(page.locator('#move-list [data-ply="10"]')).toHaveAttribute('title', /FEN: .* w KQ - 4 6/);
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/fens.png' });
});

test('FEN display with a custom starting position and promotion', async ({ page }) => {
  await load(page, '[SetUp "1"]\n[FEN "4k3/P7/8/8/8/8/7p/4K3 w - - 7 40"]\n\n40. a8=Q+ Kd7 41. Kd2 h1=N *');
  const fen = page.locator('#fen-output');
  await expect(fen).toHaveText('4k3/P7/8/8/8/8/7p/4K3 w - - 7 40');
  await page.click('#next-btn');
  await expect(fen).toHaveText('Q3k3/8/8/8/8/8/7p/4K3 b - - 0 40');
  await page.click('#last-btn');
  await expect(fen).toHaveText('Q7/3k4/8/8/8/8/3K4/7n w - - 0 42');
  await page.click('#first-btn');
  await expect(fen).toHaveText('4k3/P7/8/8/8/8/7p/4K3 w - - 7 40');
});
