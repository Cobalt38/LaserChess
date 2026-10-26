// Regole, configurazioni e computer, senza browser: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const { load, settle } = require("./harness.js");

const g = load();
const { Board, Engine, SETUPS, VARIANTS, AISearch } = g;
// Gli oggetti creati dentro il contesto del gioco hanno prototipi diversi: per confrontarli
// con deepStrictEqual li ricopio in oggetti normali
const plain = (x) => JSON.parse(JSON.stringify(x));

// Generatore pseudo-casuale con seme, per partite ripetibili
function rng(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// Mosse valide secondo la board vera (le stesse regole dell'interfaccia)
function boardMoves(board) {
  const list = [];
  for (const piece of board.activePlayer.pieces) {
    if (piece.canBeMoved) {
      for (const n of board.neighbors(piece.cell)) {
        if (piece.canMoveTo(n)) list.push(`move ${piece.cell.name} ${n.name}`);
      }
    }
    for (const rot of new Set(piece.rotations())) list.push(`rotate ${piece.cell.name} ${rot}`);
  }
  return list.sort();
}

const actionText = (a) => (a.type === "move" ? `move ${a.from} ${a.to}` : `rotate ${a.at} ${a.rot}`);

// Pezzi che il laser di side eliminerebbe adesso, secondo LaserBeam (la board vera)
function beamHits(board, side) {
  const beam = new g.LaserBeam(board, board.players[side].laser);
  return beam.events.filter((e) => e.effect === "destroy" || e.effect === "king").map((e) => e.piece.cell.name).sort();
}

test("le configurazioni sono simmetriche e ogni giocatore ha 13 pezzi", () => {
  const board = new Board();
  const R180 = { N: "S", S: "N", E: "W", W: "E", NE: "SW", SW: "NE", NW: "SE", SE: "NW" };
  for (const name of Object.keys(SETUPS)) {
    for (const variants of [[], Object.keys(VARIANTS)]) {
      board.setup(name, ["A", "B"], variants);
      const extra = variants.length;
      assert.strictEqual(board.players[0].pieces.length, 13 + extra, name);
      assert.strictEqual(board.players[1].pieces.length, 13 + extra, name);
      for (const p of board.pieces) {
        const q = board.getCell(11 - p.cell.rx, 9 - p.cell.ry).piece;
        assert.ok(q && q.type === p.type && q.player !== p.player, `${name}: ${p.type} ${p.cell.name} senza gemello`);
        if (p.type === "Deflector" || p.type === "Defender" || p.type === "Laser") {
          assert.strictEqual(q.rot, R180[p.rot], `${name}: ${p.type} ${p.cell.name}`);
        }
        assert.ok(p.canEnter(p.cell), `${name}: ${p.type} ${p.cell.name} su una casella avversaria`);
      }
    }
  }
});

test("il motore del computer ha le stesse regole della board (partite casuali)", () => {
  for (const [i, name] of Object.keys(SETUPS).entries()) {
    for (const variants of [[], Object.keys(VARIANTS)]) {
      const random = rng(1000 + i * 7 + variants.length);
      const board = new Board();
      board.setup(name, ["A", "B"], variants);
      board.start();
      for (let turn = 0; turn < 150 && !board.gameOver; turn++) {
        const side = board.turn;
        const cells = Engine.fromBoard(board);
        // Stesse mosse possibili
        const engineMoves = Engine.moves(cells, side).map((m) => actionText(Engine.toAction(m))).sort();
        assert.deepStrictEqual(plain(engineMoves), plain(boardMoves(board)), `${name} turno ${turn}`);
        // Stessi pezzi colpiti dal laser, per entrambi i giocatori
        for (const s of [0, 1]) {
          const hits = Engine.fire(cells, s, false).hits.map((c) => Engine.cellName(c)).sort();
          assert.deepStrictEqual(plain(hits), plain(beamHits(board, s)), `${name} turno ${turn} laser ${s}`);
        }
        // Mossa casuale giocata su entrambi, poi stesso risultato dopo lo sparo
        const moves = Engine.moves(cells, side);
        const m = moves[Math.floor(random() * moves.length)];
        const expected = Engine.result(cells, m, side, 0);
        assert.ok(board.applyRemote(Engine.toAction(m)));
        assert.ok(board.applyRemote({ type: "fire", key: board.positionKey() }));
        settle(board);
        assert.deepStrictEqual([...Engine.fromBoard(board)], [...expected.cells], `${name} turno ${turn}`);
        assert.strictEqual(!!board.gameOver, expected.end !== null);
      }
    }
  }
});

// Board con solo i pezzi indicati (oltre ai Laser): [classe, giocatore, x, y, rot]
function position(pieces, turn = 0) {
  const board = new Board();
  board.resetBoard();
  const players = [board.addPlayer("Blu"), board.addPlayer("Arancione")];
  for (const [cls, owner, x, y, rot] of pieces) board.addPiece(cls, players[owner], x, y, rot);
  board.turn = turn;
  board.recordPosition();
  return board;
}

function bestAction(board, level) {
  const search = new AISearch(Engine.fromBoard(board), board.turn, level, rng(5));
  while (!search.step(50));
  return search.action;
}

test("il computer vede il colpo vincente", () => {
  const { King, Deflector } = g;
  // Il laser blu (j1) punta a nord; ruotandolo verso ovest colpisce il King arancione in e1
  const board = position([[King, 1, 5, 1, "N"], [King, 0, 5, 3, "N"], [Deflector, 1, 7, 6, "NE"]]);
  for (const level of ["easy", "medium", "hard"]) {
    const action = bestAction(board, level);
    assert.deepStrictEqual(plain(action), { type: "rotate", at: "j1", rot: "W" }, level);
  }
});

test("il computer para la minaccia al suo King", () => {
  const { King, Deflector, Defender } = g;
  // Tocca all'arancione. Il laser blu, ruotato verso ovest, colpirebbe il King arancione in e1
  // passando da i1..f1. L'arancione deve spostare il King o mettere qualcosa in mezzo.
  const board = position([
    [King, 1, 5, 1, "N"], [King, 0, 5, 5, "N"],
    [Defender, 1, 6, 3, "S"], [Deflector, 0, 3, 7, "NE"],
  ], 1);
  for (const level of ["medium", "hard"]) {
    const action = bestAction(board, level);
    const cells = Engine.fromBoard(board);
    const m = Engine.moves(cells, 1).find((x) => actionText(Engine.toAction(x)) === actionText(action));
    const after = Engine.result(cells, m, 1, 0).cells;
    // Dopo la mossa scelta il blu non ha più un colpo vincente
    const blueWins = Engine.moves(after, 0).some((x) => Engine.result(after, x, 0, 0).end > 0);
    assert.ok(!blueWins, `${level}: ${actionText(action)} lascia il King scoperto`);
  }
});

test("il computer non si colpisce da solo", () => {
  const { King, Deflector } = g;
  // Ruotare il laser blu verso ovest colpirebbe il King blu in f1
  const board = position([[King, 0, 6, 1, "N"], [King, 1, 5, 8, "N"], [Deflector, 0, 3, 3, "NE"]]);
  for (const level of ["easy", "medium", "hard"]) {
    for (let i = 0; i < 5; i++) {
      const search = new AISearch(Engine.fromBoard(board), 0, level, rng(i + 1));
      while (!search.step(50));
      assert.notDeepStrictEqual(plain(search.action), { type: "rotate", at: "j1", rot: "W" }, level);
    }
  }
});

test("partite computer contro computer: finiscono senza errori e in tempi ragionevoli", () => {
  const pairs = [["easy", "medium"], ["medium", "easy"]];
  for (const [i, [a, b]] of pairs.entries()) {
    const board = new Board();
    board.setup(Object.keys(SETUPS)[i], ["A", "B"]);
    board.start();
    const levels = [a, b];
    let slowest = 0;
    let turns = 0;
    for (; turns < 120 && !board.gameOver; turns++) {
      const t0 = Date.now();
      const action = bestAction(board, levels[board.turn]);
      slowest = Math.max(slowest, Date.now() - t0);
      assert.ok(board.applyRemote(action), JSON.stringify(action));
      assert.ok(board.applyRemote({ type: "fire", key: board.positionKey() }));
      settle(board);
    }
    const result = board.gameOver ? (board.gameOver.winner ? `vince ${levels[board.players.indexOf(board.gameOver.winner)]}` : "patta") : "nessun vincitore";
    console.log(`  ${a} contro ${b}: ${turns} turni, ${result}, mossa più lenta ${slowest} ms`);
    assert.ok(slowest < 6000, `mossa troppo lenta: ${slowest} ms`);
  }
});

test("nomi uguali: il secondo giocatore diventa \"Nome (2)\", anche dopo snapshot/restore", () => {
  const board = new Board();
  board.setup("ACE", ["Mario", " mario "]);
  const names = (b) => plain(b.players.map((p) => p.name));
  assert.deepStrictEqual(names(board), ["Mario", "mario (2)"]);
  board.renamePlayer(1, "Luigi");
  assert.deepStrictEqual(names(board), ["Mario", "Luigi"]);
  board.renamePlayer(0, "luigi");
  assert.deepStrictEqual(names(board), ["luigi", "Luigi (2)"]);
  board.start();
  const other = new Board();
  other.restore(JSON.parse(JSON.stringify(board.snapshot())));
  assert.deepStrictEqual(names(other), ["luigi", "Luigi (2)"]);
  assert.strictEqual(other.positionKey(), board.positionKey());
  assert.strictEqual(other.setupName, "ACE");
});

test("anteprima del laser: segue la disposizione e segna i pezzi che verrebbero eliminati", () => {
  const { King, Deflector } = g;
  const board = position([[King, 1, 5, 1, "N"], [King, 0, 5, 5, "N"], [Deflector, 1, 7, 1, "NW"]]);
  board.showPreview = true;
  // Laser blu verso nord: colonna j libera, nessun pezzo colpito
  assert.strictEqual(board.laserPreview().events.length, 0);
  board.rotatePiece(board.players[0].laser, "W");
  // Verso ovest: il Deflector in g1 mostra il retro al raggio ed è eliminato
  const events = plain(board.laserPreview().events.map((e) => `${e.effect} ${e.piece.cell.name}`));
  assert.deepStrictEqual(events, ["destroy g1"]);
  assert.strictEqual(board.pieces.length, 5, "l'anteprima non deve togliere pezzi");
});
