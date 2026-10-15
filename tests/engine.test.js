// Run with: node tests/engine.test.js
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const engine = html.split('// ===== ENGINE START =====')[1].split('// ===== ENGINE END =====')[0];
const lessons = html.split('// ---------- Lessons ----------')[1].split('// ---------- Storage')[0];
const api = new Function(engine + lessons + '; return { fromFEN, legalMoves, pseudoMoves, makeMove, gameStatus, inCheck, bestMove, sqIndex, LESSONS, lessonState, START_FEN };')();
const { fromFEN, legalMoves, pseudoMoves, makeMove, gameStatus, inCheck, bestMove, sqIndex, LESSONS, lessonState, START_FEN } = api;
let fail = 0;
const ok = (cond, msg) => { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fail++; };

function perft(s, d) { if (d === 0) return 1; let n = 0; for (const m of legalMoves(s)) n += perft(makeMove(s, m), d - 1); return n; }
ok(perft(fromFEN(START_FEN), 3) === 8902, 'perft start depth 3 = 8902');
const kiwi = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
ok(perft(kiwi, 2) === 2039, 'perft kiwipete depth 2 = 2039 (castling, en passant, promotion)');
ok(perft(fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1'), 3) === 2812, 'perft position 3 depth 3 = 2812');
ok(gameStatus(fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')) === 'mate', "fool's mate detected");
ok(gameStatus(fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')) === 'stalemate', 'stalemate detected');

// Lessons: star levels must be completable (BFS), puzzle levels must have a winning move.
for (const L of LESSONS) L.levels.forEach((lv, i) => {
  const s0 = lessonState(lv);
  const movable = p => p && p === p.toUpperCase() && (!lv.only || lv.only.includes(p.toLowerCase()));
  if (L.goal) {
    const wins = legalMoves(s0).filter(m => {
      const ns = makeMove(s0, m);
      return L.goal === 'check' ? inCheck(ns, 'b') : gameStatus(ns) === 'mate';
    });
    ok(wins.length > 0 && !inCheck(s0, 'b'), `${L.id} level ${i + 1}: ${wins.length} winning move(s)`);
    return;
  }
  const stars = (lv.stars || []).map(sqIndex);
  const key = (s, st) => s.board.map(p => p || '.').join('') + '|' + [...st].sort().join(',');
  const done = (s, st) => st.size === 0 && !s.board.some(p => p && p !== p.toUpperCase());
  let frontier = [[s0, new Set(stars)]], seen = new Set([key(s0, new Set(stars))]), depth = 0, solved = -1;
  while (frontier.length && depth < 12 && solved < 0) {
    depth++; const next = [];
    for (const [s, st] of frontier) for (const m of pseudoMoves(s)) {
      if (!movable(m.piece) || (m.promo && m.promo !== 'q')) continue;
      const ns = makeMove(s, m); ns.turn = 'w'; ns.ep = -1;
      const nst = new Set(st); nst.delete(m.to);
      if (done(ns, nst)) { solved = depth; break; }
      const k = key(ns, nst); if (!seen.has(k)) { seen.add(k); next.push([ns, nst]); }
    }
    frontier = next;
  }
  ok(solved > 0, `${L.id} level ${i + 1}: solvable in ${solved} moves`);
});

// Robot levels pick legal moves and the clever one grabs a free queen.
const s = fromFEN('4k3/8/8/3q4/8/8/8/3QK3 w - - 0 1');
const t = Date.now(); const m = bestMove(s, 2, true, 12);
ok(m && m.to === sqIndex('d5'), `clever robot captures hanging queen (${Date.now() - t}ms)`);
const t2 = Date.now(); bestMove(fromFEN(START_FEN), 2, true, 12);
ok(Date.now() - t2 < 3000, `clever robot opening move is fast (${Date.now() - t2}ms)`);
process.exit(fail ? 1 : 0);
