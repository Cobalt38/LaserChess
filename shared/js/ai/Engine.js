// Motore per il computer: le stesse regole della board (mosse, scambi, laser, pezzi eliminati)
// su un array di 80 numeri, così si possono provare decine di migliaia di mosse al secondo.
// Le regole dei pezzi non sono riscritte qui: all'avvio vengono lette dalle classi in js/pieces
// (hit, rotations, canMoveTo), così un pezzo nuovo funziona anche contro il computer.
//
// Casella: indice c = (riga - 1) * COLS + (colonna - 1).
// Pezzo: numero (tipo << 4) | (giocatore << 3) | rotazione, 0 = casella vuota.
// Mossa: from + 128 * to per gli spostamenti, from + 128 * (CELLS + rotazione) per le rotazioni.

const ROTS = [...DIRS, ...DIAGONALS]; // indice di rotazione -> nome
const CELLS = COLS * ROWS;
const EFFECT = { reflect: 1, block: 2, destroy: 3, king: 4 };
const WIN = 100000; // punteggio della vittoria (meno le mosse che servono per arrivarci)

const Engine = {
  ready: false,

  // Tabelle delle regole, ricavate una volta dalle classi dei pezzi
  init() {
    if (this.ready) return;
    this.types = Object.values(PIECE_TYPES); // indice tipo - 1 -> classe
    const players = [new Player("", [0, 0, 0]), new Player("", [0, 0, 0])];
    const sample = (t, owner, rot) => {
      const p = new this.types[t - 1](players[owner]);
      p.rot = rot;
      p.cell = { playerExclusive: null };
      return p;
    };
    const n = this.types.length + 1;
    this.hitTable = []; // [tipo][rotazione][direzione] -> { effect, out: [direzioni] } o null
    this.rotTable = []; // [tipo][rotazione] -> rotazioni possibili
    this.movable = []; // [tipo] -> si può spostare?
    this.value = []; // [tipo] -> valore per la valutazione (0 = non si può eliminare)
    this.canSwap = []; // [tipo][tipo dell'altro] -> può scambiarsi con lui (Switch)
    for (let t = 1; t < n; t++) {
      this.hitTable[t] = [];
      this.rotTable[t] = [];
      this.canSwap[t] = [];
      const base = sample(t, 0, "N");
      this.movable[t] = base.canBeMoved;
      for (let r = 0; r < ROTS.length; r++) {
        const p = sample(t, 0, ROTS[r]);
        this.hitTable[t][r] = DIRS.map((d) => {
          try {
            const { out, effect } = p.hit(d);
            return { effect: EFFECT[effect], out: out.map((o) => DIRS.indexOf(o)) };
          } catch (e) {
            return null; // rotazione che questo pezzo non può avere (es. Deflector verso N)
          }
        });
        let rots = [];
        try {
          rots = p.rotations().map((x) => ROTS.indexOf(x));
        } catch (e) {
          // idem
        }
        this.rotTable[t][r] = [...new Set(rots)];
      }
      for (let o = 1; o < n; o++) {
        const other = sample(o, 1, "N");
        this.canSwap[t][o] = !!base.canMoveTo({ piece: other, playerExclusive: null });
      }
    }
    // Valore: i pezzi che il laser può eliminare (esclusi i King, che chiudono la partita)
    const KING = this.types.indexOf(King) + 1;
    this.KING = KING;
    for (let t = 1; t < n; t++) {
      const kills = this.hitTable[t].some((row) => row.some((h) => h && h.effect === EFFECT.destroy));
      this.value[t] = t === KING || !kills ? 0 : this.types[t - 1] === Defender ? 70 : 100;
    }

    // Caselle riservate, posizione dei Laser, vicini
    this.exclusive = new Int8Array(CELLS).fill(-1);
    this.laserCell = [];
    PLAYER_SLOTS.forEach((slot, owner) => {
      for (const [x, y] of slot.exclusive) this.exclusive[this.cell(x, y)] = owner;
      this.laserCell[owner] = this.cell(slot.laser.x, slot.laser.y);
    });
    this.step = []; // [casella][direzione] -> casella vicina o -1
    this.around = []; // [casella] -> le 8 caselle intorno
    for (let c = 0; c < CELLS; c++) {
      const x = (c % COLS) + 1;
      const y = Math.floor(c / COLS) + 1;
      this.step[c] = DIRS.map((d) => this.cell(x + DIR_VEC[d].x, y + DIR_VEC[d].y));
      this.around[c] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const nc = this.cell(x + dx, y + dy);
          if ((dx || dy) && nc !== -1) this.around[c].push(nc);
        }
      }
    }
    // Distanza tra caselle (in mosse del re)
    this.dist = [];
    for (let a = 0; a < CELLS; a++) {
      this.dist[a] = new Uint8Array(CELLS);
      for (let b = 0; b < CELLS; b++) {
        this.dist[a][b] = Math.max(Math.abs((a % COLS) - (b % COLS)), Math.abs(Math.floor(a / COLS) - Math.floor(b / COLS)));
      }
    }
    // Spazio di lavoro del laser (riusato a ogni colpo per non allocare)
    this.visited = new Int32Array(CELLS * 4);
    this.removedAt = new Int32Array(CELLS);
    this.stamp = 0;
    this.ready = true;
  },

  cell(x, y) {
    return x >= 1 && y >= 1 && x <= COLS && y <= ROWS ? (y - 1) * COLS + x - 1 : -1;
  },

  cellName(c) {
    return String.fromCharCode(97 + (c % COLS)) + (Math.floor(c / COLS) + 1);
  },

  type: (p) => p >> 4,
  owner: (p) => (p >> 3) & 1,
  rot: (p) => p & 7,
  code: (t, owner, r) => (t << 4) | (owner << 3) | r,

  // Copia della board vera
  fromBoard(board) {
    this.init();
    const cells = new Uint8Array(CELLS);
    for (const p of board.pieces) {
      cells[this.cell(p.cell.rx, p.cell.ry)] =
        this.code(this.types.indexOf(p.constructor) + 1, board.players.indexOf(p.player), ROTS.indexOf(p.rot));
    }
    return cells;
  },

  // Tutte le mosse del giocatore side: spostamenti (anche gli scambi dello Switch) e rotazioni
  moves(cells, side) {
    const list = [];
    for (let c = 0; c < CELLS; c++) {
      const p = cells[c];
      if (!p || this.owner(p) !== side) continue;
      const t = this.type(p);
      if (this.movable[t]) {
        for (const n of this.around[c]) {
          const ex = this.exclusive[n];
          if (ex !== -1 && ex !== side) continue;
          const q = cells[n];
          if (q) {
            // Scambio: l'altro pezzo deve poter entrare nella casella di partenza
            const exFrom = this.exclusive[c];
            if (!this.canSwap[t][this.type(q)] || (exFrom !== -1 && exFrom !== this.owner(q))) continue;
          }
          list.push(c + 128 * n);
        }
      }
      for (const r of this.rotTable[t][this.rot(p)]) list.push(c + 128 * (CELLS + r));
    }
    return list;
  },

  // Nuova board con la mossa m fatta (senza sparare)
  play(cells, m) {
    const next = cells.slice();
    const from = m & 127;
    const arg = m >> 7;
    if (arg >= CELLS) {
      next[from] = (cells[from] & ~7) | (arg - CELLS);
    } else {
      next[arg] = cells[from];
      next[from] = cells[arg]; // 0, o il pezzo scambiato dallo Switch
    }
    return next;
  },

  // Percorso del laser di side, come LaserBeam.trace: visita in ampiezza, un pezzo eliminato da
  // un ramo non c'è più per i rami che arrivano dopo. Se apply, toglie davvero i pezzi colpiti.
  // Restituisce { kings: bit 1 = King blu colpito, bit 2 = King arancione; hits: [caselle eliminate];
  // path: caselle attraversate (solo se withPath) }
  fire(cells, side, apply = true, withPath = false) {
    const stamp = ++this.stamp;
    const start = this.laserCell[side];
    const laser = cells[start];
    let fronts = [start * 4 + (this.rot(laser) & 3)];
    const hits = [];
    const path = withPath ? [] : null;
    let kings = 0;
    while (fronts.length > 0) {
      const next = [];
      for (const f of fronts) {
        if (this.visited[f] === stamp) continue;
        this.visited[f] = stamp;
        const dir = f & 3;
        const target = this.step[f >> 2][dir];
        if (target === -1) continue;
        if (withPath) path.push(target);
        const p = cells[target];
        if (!p || this.removedAt[target] === stamp) {
          next.push(target * 4 + dir);
          continue;
        }
        const h = this.hitTable[this.type(p)][this.rot(p)][dir];
        if (h.effect >= EFFECT.destroy) {
          this.removedAt[target] = stamp;
          hits.push(target);
          if (h.effect === EFFECT.king) kings |= 1 << this.owner(p);
        }
        for (const o of h.out) next.push(target * 4 + o);
      }
      fronts = next;
    }
    if (apply) for (const c of hits) cells[c] = 0;
    return { kings, hits, path };
  },

  // Punteggio della posizione per side, che deve muovere. Positivo = side sta meglio
  evaluate(cells, side, threats = true) {
    let score = 0;
    const king = [-1, -1];
    for (let c = 0; c < CELLS; c++) {
      const p = cells[c];
      if (!p) continue;
      const t = this.type(p);
      const o = this.owner(p);
      if (t === this.KING) king[o] = c;
      score += o === side ? this.value[t] : -this.value[t];
    }
    if (!threats) return score;
    const other = 1 - side;
    score += this.laserScore(cells, side, king) - this.laserScore(cells, other, king);
    // Pezzi accanto al proprio King: lo riparano dai raggi
    for (const o of [side, other]) {
      if (king[o] === -1) continue;
      let guards = 0;
      for (const n of this.around[king[o]]) if (cells[n] && this.owner(cells[n]) === o) guards++;
      score += (o === side ? 1 : -1) * Math.min(guards, 4) * 6;
    }
    return score;
  },

  // Quanto è minaccioso il laser di side: colpisce il King avversario? Ci passa vicino? Elimina
  // un pezzo avversario o uno suo? E ruotando il Laser o uno dei propri pezzi che il raggio
  // attraversa, cosa colpirebbe? (le minacce a una rotazione di distanza sono il modo più comune
  // di preparare un attacco: senza, il computer gioca solo in difesa)
  laserScore(cells, side, king) {
    const { kings, hits, path } = this.fire(cells, side, false, true);
    let score = 0;
    const enemyKing = king[1 - side];
    if (kings & (1 << (1 - side))) score += 400;
    if (kings & (1 << side)) score -= 400;
    for (const c of hits) {
      const p = cells[c];
      if (this.type(p) !== this.KING) score += this.owner(p) === side ? -15 : 15;
    }
    if (enemyKing !== -1 && path.length > 0) {
      let d = 9;
      for (const c of path) d = Math.min(d, this.dist[c][enemyKing]);
      score += [0, 40, 15, 5][d] || 0;
    }

    const pivots = new Set([this.laserCell[side]]);
    for (const c of path) if (cells[c] && this.owner(cells[c]) === side) pivots.add(c);
    let kingThreats = 0;
    let bestGain = 0;
    for (const c of pivots) {
      const p = cells[c];
      for (const r of this.rotTable[this.type(p)][this.rot(p)]) {
        cells[c] = (p & ~7) | r; // ruoto per un attimo
        const shot = this.fire(cells, side, false);
        cells[c] = p;
        if (shot.kings & (1 << side)) continue;
        if (shot.kings) kingThreats++;
        let gain = 0;
        for (const h of shot.hits) gain += (this.owner(cells[h]) === side ? -0.3 : 0.3) * this.value[this.type(cells[h])];
        bestGain = Math.max(bestGain, gain);
      }
    }
    return score + Math.min(kingThreats, 2) * 120 + bestGain;
  },

  // Esito di una mossa per side: board dopo mossa e colpo, e punteggio se la partita finisce
  result(cells, m, side, ply) {
    const next = this.play(cells, m);
    const { kings, hits } = this.fire(next, side);
    let end = null;
    if (kings) {
      const mine = kings & (1 << side);
      const theirs = kings & (1 << (1 - side));
      end = mine && theirs ? 0 : theirs ? WIN - ply : -(WIN - ply);
    }
    return { cells: next, end, hits: hits.length };
  },

  // Negamax con potatura alfa-beta: miglior punteggio per side con depth turni (mossa + colpo)
  search(cells, side, depth, alpha, beta, ply, opts) {
    opts.nodes++;
    const children = [];
    for (const m of this.moves(cells, side)) {
      const r = this.result(cells, m, side, ply);
      if (r.end !== null) {
        if (r.end > 0) return r.end; // vittoria: inutile guardare altro
        children.push({ score: r.end, done: true });
        continue;
      }
      if (depth === 1) {
        children.push({ score: -this.evaluate(r.cells, 1 - side, opts.threats), done: true });
      } else {
        // Ordine: prima le mosse che sembrano migliori, così la potatura taglia di più
        children.push({ score: -this.evaluate(r.cells, 1 - side, opts.threats), cells: r.cells, done: false });
      }
    }
    if (children.length === 0) return 0;
    if (depth === 1) {
      let best = -Infinity;
      for (const c of children) best = Math.max(best, c.score);
      return best;
    }
    children.sort((a, b) => b.score - a.score);
    let best = -Infinity;
    for (const c of children) {
      const score = c.done ? c.score : -this.search(c.cells, 1 - side, depth - 1, -beta, -alpha, ply + 1, opts);
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  },

  // Mosse con cui un giocatore, muovendo per primo da questa posizione, elimina subito un pezzo
  // avversario: [{ side, action, hits: [caselle] }]. I pezzi propri non contano (ci si può
  // sempre colpire da soli). Serve per piazzare i pezzi delle varianti (Board.placeVariants)
  openingCaptures(cells) {
    const found = [];
    for (const side of [0, 1]) {
      for (const m of this.moves(cells, side)) {
        const next = this.play(cells, m);
        const hits = this.fire(next, side, false).hits.filter((c) => this.owner(next[c]) !== side);
        if (hits.length) found.push({ side, action: this.toAction(m), hits: hits.map((c) => this.cellName(c)) });
      }
    }
    return found;
  },

  toAction(m) {
    const from = m & 127;
    const arg = m >> 7;
    return arg >= CELLS
      ? { type: "rotate", at: this.cellName(from), rot: ROTS[arg - CELLS] }
      : { type: "move", from: this.cellName(from), to: this.cellName(arg) };
  },
};

// Livelli del computer: quanti turni guarda avanti, quanto "sbaglia" apposta e se tiene conto
// delle minacce del laser nella valutazione (il nome è nei testi, level.<chiave>)
const AI_LEVELS = {
  easy: { depth: 1, noise: 120, threats: false, time: 0 },
  medium: { depth: 2, noise: 15, threats: true, time: 0 },
  hard: { depth: 3, noise: 2, threats: true, time: 3000 },
};

// Ricerca della mossa del computer a pezzi: step() lavora per qualche millisecondo e poi
// restituisce il controllo, così l'animazione non si blocca mentre il computer pensa.
// Prima esamina ogni mossa guardando un turno avanti in meno, poi riesamina le mosse nell'ordine
// trovato con la profondità piena; se il tempo finisce, vale il meglio trovato fin lì.
class AISearch {
  constructor(cells, side, level, random = Math.random) {
    Engine.init();
    this.side = side;
    this.level = AI_LEVELS[level] || AI_LEVELS.medium;
    this.opts = { threats: this.level.threats, nodes: 0 };
    this.start = Date.now();
    this.done = false;
    this.best = null;
    // Mosse con il loro esito, e un po' di "rumore" fisso per mossa: a parità di valore la scelta
    // varia da partita a partita, e ai livelli bassi il computer sbaglia
    this.root = Engine.moves(cells, side).map((m) => {
      const r = Engine.result(cells, m, side, 0);
      return { m, ...r, noise: (random() * 2 - 1) * this.level.noise, score: 0 };
    });
    this.depth = Math.min(this.level.depth, 1);
    this.index = 0;
    this.finished = []; // mosse già valutate alla profondità corrente
  }

  scoreOf(child, depth) {
    if (child.end !== null) return child.end;
    if (depth === 1) return -Engine.evaluate(child.cells, 1 - this.side, this.opts.threats);
    return -Engine.search(child.cells, 1 - this.side, depth - 1, -WIN - 1, WIN + 1, 1, this.opts);
  }

  // Lavora per al massimo budget millisecondi; true quando la mossa è pronta (in this.best)
  step(budget = 10) {
    if (this.done) return true;
    const until = Date.now() + budget;
    const { root } = this;
    if (root.length === 0) {
      this.done = true;
      return true;
    }
    while (Date.now() < until) {
      const child = root[this.index];
      child.score = this.scoreOf(child, this.depth);
      this.finished.push(child);
      this.index++;
      const outOfTime = this.level.time && Date.now() - this.start > this.level.time;
      if (this.index < root.length && !outOfTime) continue;

      // Profondità completata (o tempo scaduto): le mosse non ancora riesaminate tengono il
      // punteggio della profondità precedente solo se il tempo è finito
      const pool = this.index < root.length ? this.finished : root;
      this.best = pool.reduce((a, b) => (b.score + b.noise > a.score + a.noise ? b : a));
      const winning = this.best.score >= WIN - 10;
      if (this.depth >= this.level.depth || outOfTime || winning) {
        this.done = true;
        return true;
      }
      // Si riparte più a fondo, cominciando dalle mosse migliori
      this.depth++;
      root.sort((a, b) => b.score - a.score);
      this.index = 0;
      this.finished = [];
    }
    return false;
  }

  get action() {
    return this.best ? Engine.toAction(this.best.m) : null;
  }
}
