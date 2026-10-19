class Board {
  constructor() {
    this.cellSize = CELL_SIZE;
    this.width = COLS * this.cellSize;
    this.height = ROWS * this.cellSize;
    this.cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      this.cells.push(new Cell(i, this.cellSize));
    }
    this.gridLayer = null; // buffer con la parte statica della griglia, rigenerato quando serve
    this.renderScale = 1; // zoom con cui la board finisce sullo schermo (per un buffer nitido)
    this.players = [];
    this.turn = -1; // indice in players, -1 = partita non iniziata
    this.phase = "move"; // "move": scegli la mossa; "fire": mossa fatta, ora si spara
    this.pieces = [];
    this.selected = null; // Cell selezionata
    this.press = null; // pressione in corso su un pezzo: { piece, from, start, time, dragging }
    this.menu = null; // ActionMenu aperto
    this.pointer = null; // ultima posizione del puntatore (coordinate board)
    this.beam = null; // LaserBeam in volo o dell'ultimo colpo
    this.bounces = 0; // riflessi del colpo in corso (per i suoni)
    this.effects = []; // esplosioni e scintille
    this.shake = 0; // intensità dello scuotimento della board
    this.hitKings = []; // re colpiti dall'ultimo colpo
    this.gameOver = null; // { winner: Player | null, reason: "king" | "repetition" }
    this.history = []; // mosse giocate: { n, player, text, hits: [testo] }
    this.historyVersion = 0; // cambia a ogni modifica dello storico (la UI ridisegna la lista)
    this.lastMove = null; // { cells: [Cell], player }: evidenziata sulla board
    this.positions = new Map(); // disposizione dei pezzi -> volte in cui si è presentata
    this.drawClaimable = false; // il giocatore di turno può dichiarare patta
    this.pendingUndo = null; // mossa fatta ma non ancora sparata: { undo, lastMove, drawClaimable }
    this.onEvent = () => { }; // onEvent(nome, dati): suoni, UI...
  }

  get activePlayer() {
    return this.players[this.turn] || null;
  }

  // Mentre il laser è in volo l'input è bloccato
  get busy() {
    return !!this.beam && !this.beam.resolved;
  }

  get canFire() {
    return this.phase === "fire" && !this.busy && !this.gameOver;
  }

  get canUndo() {
    return this.canFire && !!this.pendingUndo;
  }

  get dragging() {
    return this.press && this.press.dragging ? this.press.piece : null;
  }

  // ---------- Griglia ----------

  isInside(x, y) {
    return x > 0 && y > 0 && x <= COLS && y <= ROWS;
  }

  getCell(x, y) {
    //colonna, riga
    return this.isInside(x, y) ? this.cells[(ROWS - y) * COLS + x - 1] : null;
  }

  neighbors(cell) {
    const ret = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const c = (dx || dy) && this.getCell(cell.rx + dx, cell.ry + dy);
        if (c) ret.push(c);
      }
    }
    return ret;
  }

  // Casella sotto il punto p (coordinate board); floor e non int, così i punti appena fuori non
  // finiscono nella prima colonna/riga
  cellAt(p) {
    if (!p) return null;
    const x = Math.floor(p.x / this.cellSize) + 1;
    const y = ROWS - Math.floor(p.y / this.cellSize);
    return this.getCell(x, y);
  }

  setRenderScale(s) {
    if (s === this.renderScale) return;
    this.renderScale = s;
    this.invalidateGrid();
  }

  invalidateGrid() {
    if (this.gridLayer) this.gridLayer.remove();
    this.gridLayer = null;
  }

  // ---------- Giocatori e pezzi ----------

  addPlayer(name) {
    const slot = PLAYER_SLOTS[this.players.length];
    if (!slot) {
      print("Cannot add any more players to this board!");
      return null;
    }
    const player = new Player(name, slot.color);
    this.players.push(player);
    this.addPiece(Laser, player, slot.laser.x, slot.laser.y, slot.laser.rot);
    for (const [x, y] of slot.exclusive) this.getCell(x, y).playerExclusive = player;
    this.invalidateGrid();
    return player;
  }

  addPiece(PieceClass, player, x, y, rot) {
    const cell = this.getCell(x, y);
    if (!cell) throw new Error(`Invalid coordinates: ${x},${y}`);
    if (cell.isOccupied()) throw new Error(`Cell (${x},${y}) is occupied`);
    if (!DIRS.includes(rot) && !DIAGONALS.includes(rot))
      throw new Error("Invalid rotation");
    if (typeof PieceClass !== "function")
      throw new Error("Invalid piece type: not a constructor");
    if (!(PieceClass.prototype instanceof Piece))
      throw new Error(`${PieceClass.name} must extend Piece`);

    const newPiece = new PieceClass(player);
    newPiece.cell = cell;
    newPiece.rot = rot;
    newPiece.board = this;
    cell.setPiece(newPiece);
    if (newPiece instanceof Laser) player.laser = newPiece;

    this.pieces.push(newPiece);
    player.pieces.push(newPiece);
    return newPiece;
  }

  destroyPiece(piece) {
    if (piece.cell.piece === piece) piece.cell.setPiece(null);
    removeFrom(piece.player.pieces, piece);
    removeFrom(this.pieces, piece);
  }

  // ---------- Partita ----------

  resetBoard() {
    for (const cell of this.cells) {
      cell.piece = null;
      cell.selected = false;
      cell.highlight = false;
      cell.deny = false;
      cell.playerExclusive = null;
    }
    this.invalidateGrid();
    this.players = [];
    this.turn = -1;
    this.phase = "move";
    this.pieces = [];
    this.selected = null;
    this.press = null;
    this.menu = null;
    this.beam = null;
    this.effects = [];
    this.shake = 0;
    this.hitKings = [];
    this.gameOver = null;
    this.history = [];
    this.historyVersion++;
    this.lastMove = null;
    this.positions = new Map();
    this.drawClaimable = false;
    this.pendingUndo = null;
  }

  // Prepara una configurazione di SETUPS, più i pezzi delle VARIANTS scelte (vedi setups.js)
  setup(name, playerNames = ["Player1", "Player2"], variants = []) {
    const layout = SETUPS[name];
    if (!layout) throw new Error(`Unknown setup: ${name}`);
    this.resetBoard();
    const players = playerNames.map((n) => this.addPlayer(n));
    const extra = variants.flatMap((v) => VARIANTS[v].pieces);
    for (const [PieceClass, owner, x, y, rot] of [...layout, ...extra]) {
      this.addPiece(PieceClass, players[owner], x, y, rot);
    }
    return players;
  }

  start() {
    if (this.turn !== -1) return;
    this.turn = 0; // inizia il primo giocatore (blu)
    this.recordPosition();
  }

  endTurn() {
    this.pendingUndo = null;
    this.turn = (this.turn + 1) % this.players.length;
    this.phase = "move";
    this.recordPosition();
  }

  endGame() {
    const losers = this.hitKings.map((k) => k.player);
    const survivors = this.players.filter((p) => !losers.includes(p));
    // Entrambi i re colpiti nello stesso colpo -> pareggio
    this.gameOver = { winner: survivors.length === 1 ? survivors[0] : null, reason: "king" };
    this.onEvent("gameover", this.gameOver);
  }

  // Ripetizione: se la stessa disposizione (pezzi, caselle, rotazioni) si presenta per la terza
  // volta, chi deve muovere può dichiarare patta
  positionKey() {
    return this.pieces
      .map((p) => `${p.type}${this.players.indexOf(p.player)}@${p.cell.rx},${p.cell.ry}:${p.rot}`)
      .sort()
      .join("|");
  }

  recordPosition() {
    const key = this.positionKey();
    const count = (this.positions.get(key) || 0) + 1;
    this.positions.set(key, count);
    this.drawClaimable = count >= 3;
  }

  claimDraw() {
    if (!this.drawClaimable || this.phase !== "move" || this.busy || this.gameOver) return;
    this.cancelSelection();
    this.gameOver = { winner: null, reason: "repetition" };
    this.onEvent("gameover", this.gameOver);
  }

  // Mossa fatta (spostamento o rotazione): va annotata e poi bisogna sparare.
  // undo() la rimette com'era finché non si spara
  record(text, cells, undo) {
    this.pendingUndo = { undo, lastMove: this.lastMove, drawClaimable: this.drawClaimable };
    this.history.push({ n: this.history.length + 1, player: this.activePlayer, text, hits: [] });
    this.historyVersion++;
    this.lastMove = { cells, player: this.activePlayer };
    this.drawClaimable = false; // ha mosso invece di dichiarare patta
    this.phase = "fire";
    this.clearSelection();
  }

  movePiece(piece, target) {
    const from = piece.cell;
    const other = target.piece; // c'è solo se lo Switch fa uno scambio
    this.record(
      other
        ? `${piece.type} ${from.name} ⇄ ${other.type} ${target.name}`
        : `${piece.type} ${from.name} → ${target.name}`,
      [from, target],
      () => this.slide(piece, from, other) // lo Switch, muovendosi su "other", rifà lo scambio al contrario
    );
    this.slide(piece, target, other);
    this.onEvent("move");
  }

  // Sposta piece in target (e other, se c'è uno scambio, dove stava piece) facendoli scivolare
  // dalla posizione in cui si vedono adesso
  slide(piece, target, other) {
    const from = piece.cell;
    const fromOther = other && other.cell;
    piece.offset = {
      x: from.center.x + piece.offset.x - target.center.x,
      y: from.center.y + piece.offset.y - target.center.y,
    };
    if (other) {
      other.offset = {
        x: fromOther.center.x + other.offset.x - from.center.x,
        y: fromOther.center.y + other.offset.y - from.center.y,
      };
    }
    piece.move(target);
  }

  rotatePiece(piece, rot) {
    const old = piece.rot;
    this.record(`ruota ${piece.type} ${piece.cell.name} (${old} → ${rot})`, [piece.cell],
      () => this.turnPiece(piece, old));
    this.turnPiece(piece, rot);
    this.onEvent("rotate");
  }

  // Cambia rotazione e fa girare il pezzo dal vecchio orientamento al nuovo
  turnPiece(piece, rot) {
    const cycle = DIRS.includes(rot) ? DIRS : DIAGONALS;
    const step = (cycle.indexOf(rot) - cycle.indexOf(piece.rot) + 4) % 4; // 1 orario, 3 antiorario
    piece.rot = rot;
    piece.spin += (step === 3 ? 1 : -step) * HALF_PI;
  }

  // Ripensamento prima di sparare: la mossa torna indietro e il turno ricomincia
  undoMove() {
    if (!this.canUndo) return;
    const { undo, lastMove, drawClaimable } = this.pendingUndo;
    this.pendingUndo = null;
    undo();
    this.history.pop();
    this.historyVersion++;
    this.lastMove = lastMove;
    this.drawClaimable = drawClaimable;
    this.phase = "move";
    this.onEvent("undo");
  }

  fireLaser() {
    if (!this.canFire) return;
    const laser = this.activePlayer.laser;
    this.hitKings = [];
    this.bounces = 0;
    laser.hitFlash(LASER_COLOR.inner);
    this.beam = new LaserBeam(this, laser);
    this.onEvent("fire");
  }

  // Il raggio animato ha raggiunto un pezzo
  onLaserHit({ piece, effect }) {
    const c = piece.cell.center;
    switch (effect) {
      case "reflect":
        piece.hitFlash(LASER_COLOR.outer);
        this.effects.push(new Burst(c.x, c.y, 8, 90, 0.35, SPARK_COLORS, 2.5));
        this.onEvent("reflect", { bounce: this.bounces++ });
        return;
      case "block":
        piece.hitFlash(MIRROR_COLOR);
        this.effects.push(new Burst(c.x, c.y, 16, 130, 0.4, SPARK_COLORS, 3));
        this.onEvent("block");
        return;
      case "destroy":
        this.destroyPiece(piece);
        this.effects.push(new Explosion(piece));
        this.shake = Math.max(this.shake, 4);
        break;
      case "king":
        this.hitKings.push(piece);
        this.destroyPiece(piece);
        this.effects.push(new Explosion(piece, true));
        this.shake = Math.max(this.shake, 12);
        break;
    }
    // Pezzo eliminato: lo annoto nella mossa che ha causato il colpo
    this.onEvent(effect);
    const entry = this.history[this.history.length - 1];
    if (entry) {
      entry.hits.push(`${effect === "king" ? "👑" : "💥"} ${piece.type} di ${piece.player.name} (${piece.cell.name})`);
      this.historyVersion++;
    }
  }

  update(dt) {
    // Pressione prolungata su un pezzo senza trascinarlo: menu
    if (this.press && !this.press.dragging) {
      this.press.time += dt;
      if (this.press.time >= LONG_PRESS) {
        const { piece } = this.press;
        this.press = null;
        this.openMenu(piece);
      }
    }

    if (this.busy) {
      for (const ev of this.beam.update(dt)) this.onLaserHit(ev);
      const hold = this.hitKings.length > 0 ? KING_HIT_HOLD : LASER_HOLD;
      if (this.beam.reachedEnd && this.beam.hold >= hold) {
        this.beam.resolved = true;
        if (this.hitKings.length > 0) this.endGame();
        else this.endTurn();
      }
    }

    // Pezzi che tornano a posto dopo trascinamenti, scambi e rotazioni
    const settle = Math.pow(1e-5, dt);
    const dragged = this.dragging;
    for (const p of this.pieces) {
      if (p.flash > 0) p.flash = Math.max(0, p.flash - dt * 2.5);
      if (p === dragged) continue;
      p.offset.x = Math.abs(p.offset.x) < 0.1 ? 0 : p.offset.x * settle;
      p.offset.y = Math.abs(p.offset.y) < 0.1 ? 0 : p.offset.y * settle;
      p.spin = Math.abs(p.spin) < 0.002 ? 0 : p.spin * settle;
    }
    this.effects = this.effects.filter((e) => e.update(dt));
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  // ---------- Input ----------
  // Sinistro/tocco: seleziona. Trascinare un pezzo su una casella evidenziata lo muove.
  // Destro o pressione prolungata: menu del pezzo (rotazioni). Poi si spara col pulsante,
  // oppure si annulla la mossa.

  clearSelection() {
    if (this.selected) {
      for (const cell of this.cells) {
        cell.highlight = false;
        cell.selected = false;
        cell.deny = false;
      }
    }
    this.selected = null;
  }

  cancelSelection() {
    if (this.busy) return;
    if (this.dragging) this.pointerCancel();
    this.press = null;
    this.menu = null;
    this.clearSelection();
  }

  selectCell(cell) {
    const piece = cell.piece;
    if (piece && piece.player !== this.activePlayer) {
      this.onEvent("deny");
      return;
    }
    this.beam = null; // nasconde il raggio del turno precedente
    this.selected = cell;
    cell.selected = true;
    if (!piece) return;
    this.onEvent("select");
    if (!piece.canBeMoved) return;
    for (const n of this.neighbors(cell)) {
      if (!piece.canEnter(n)) n.deny = true;
      else if (piece.canMoveTo(n)) n.highlight = true;
    }
  }

  openMenu(piece) {
    const rots = piece.rotations();
    if (rots.length === 0) {
      this.onEvent("deny"); // niente da fare con questo pezzo (es. King)
      return;
    }
    const items = rots.map((rot, i) => ({
      icon: rots.length === 1 ? "single" : i === 0 ? "ccw" : "cw",
      run: () => this.rotatePiece(piece, rot),
    }));
    this.menu = new ActionMenu(piece, items);
    this.onEvent("popup");
  }

  pointerDown(p, button = 0) {
    this.pointer = p;
    if (this.gameOver || this.busy) return;
    if (this.menu) {
      const item = this.menu.itemAt(p);
      this.menu = null;
      if (item) item.run();
      else this.clearSelection();
      return;
    }
    const cell = this.cellAt(p);
    if (this.phase === "fire") {
      // Mossa già fatta: resta solo da sparare (anche toccando il proprio Laser, come sul gioco vero)
      if (cell && cell.piece === this.activePlayer.laser) this.fireLaser();
      else this.onEvent("needFire");
      return;
    }
    this.clearSelection();
    if (!cell) return;
    this.selectCell(cell);
    if (this.selected !== cell || !cell.piece) return; // casella vuota o pezzo avversario
    if (button === 2) this.openMenu(cell.piece);
    else this.press = { piece: cell.piece, from: cell, start: p, time: 0, dragging: false };
  }

  pointerMove(p) {
    this.pointer = p;
    const press = this.press;
    if (!press) return;
    const c = press.from.center;
    if (!press.dragging && Math.hypot(p.x - press.start.x, p.y - press.start.y) > DRAG_THRESHOLD) {
      if (!press.piece.canBeMoved) {
        this.press = null; // il Laser non si trascina: annullo anche la pressione prolungata
        return;
      }
      press.dragging = true;
      this.onEvent("lift");
    }
    if (press.dragging) press.piece.offset = { x: p.x - c.x, y: p.y - c.y };
  }

  pointerUp(p) {
    const press = this.press;
    this.press = null;
    if (!press || !press.dragging) return;
    const target = this.cellAt(p);
    if (target && target !== press.from && target.highlight) {
      // Il pezzo scivola dal punto di rilascio al centro della nuova casella
      this.movePiece(press.piece, target);
    } else {
      this.onEvent("cancel"); // torna a posto scivolando (l'offset si azzera in update)
    }
  }

  pointerCancel() {
    if (this.dragging) this.onEvent("cancel");
    this.press = null;
  }

  // ---------- Disegno ----------

  renderGrid() {
    const g = createGraphics(this.width + 1, this.height + 1); // +1: bordo delle ultime caselle
    g.pixelDensity(pixelDensity() * this.renderScale);
    for (const cell of this.cells) cell.drawBackground(g);
    return g;
  }

  show() {
    push();
    if (this.shake > 0) translate(random(-this.shake, this.shake), random(-this.shake, this.shake));
    if (!this.gridLayer) this.gridLayer = this.renderGrid();
    image(this.gridLayer, 0, 0, this.width + 1, this.height + 1);
    this.showLastMove();
    for (const cell of this.cells) cell.showOverlay();
    this.showDropTarget();
    this.showPieces();
    if (this.beam) this.beam.show();
    for (const e of this.effects) e.show();
    pop();

    if (this.menu) this.menu.show(this.pointer);
  }

  showLastMove() {
    if (!this.lastMove) return;
    const col = this.lastMove.player.pColor.map((v) => Math.min(255, v + 90));
    push();
    stroke(...col, 220);
    strokeWeight(2.5);
    fill(...col, 35);
    for (const c of this.lastMove.cells) rect(c.px + 3, c.py + 3, c.size - 6, c.size - 6, 5);
    pop();
  }

  // Durante il trascinamento: casella sotto il pezzo verde se valida, rossa se no
  showDropTarget() {
    if (!this.dragging) return;
    const t = this.cellAt(this.pointer);
    if (!t || t === this.press.from) return;
    push();
    noFill();
    strokeWeight(3);
    if (t.highlight) stroke(230, 220, 90);
    else stroke(240, 40, 60, 200);
    rect(t.px + 2, t.py + 2, t.size - 4, t.size - 4, 4);
    pop();
  }

  showPieces() {
    const dragged = this.dragging;
    for (const piece of this.pieces) {
      if (piece !== dragged) this.drawPiece(piece);
    }

    // Mossa fatta: il Laser di chi deve sparare pulsa
    if (this.canFire) {
      const c = this.activePlayer.laser.cell.center;
      const k = (Math.sin(millis() / 180) + 1) / 2;
      push();
      blendMode(ADD);
      noStroke();
      fill(...LASER_COLOR.outer, 40 + 70 * k);
      ellipse(c.x, c.y, this.cellSize * (0.75 + 0.3 * k));
      blendMode(BLEND);
      pop();
    }

    // Il pezzo trascinato sta sopra tutti gli altri, sollevato e con l'ombra
    if (dragged) {
      const c = dragged.cell.center;
      push();
      noStroke();
      fill(0, 130);
      ellipse(c.x + dragged.offset.x + 4, c.y + dragged.offset.y + 7, this.cellSize * 0.8);
      pop();
      this.drawPiece(dragged, 1.15);
    }
  }

  drawPiece(piece, lift = 1) {
    const k = piece.flash;
    if (k <= 0 && lift === 1 && !piece.spin && !piece.offset.x && !piece.offset.y) {
      piece.draw();
      return;
    }
    const c = piece.cell.center;
    const x = c.x + piece.offset.x;
    const y = c.y + piece.offset.y;
    push();
    translate(x, y);
    scale((1 + 0.12 * k) * lift); // colpito dal laser: piccolo "sobbalzo"
    rotate(piece.spin);
    translate(-c.x, -c.y);
    piece.draw();
    pop();
    if (k > 0) {
      push();
      blendMode(ADD);
      noStroke();
      fill(...piece.flashColor, 110 * k);
      ellipse(x, y, this.cellSize * (0.7 + 0.5 * (1 - k)));
      blendMode(BLEND);
      pop();
    }
  }
}

function removeFrom(arr, item) {
  const index = arr.indexOf(item);
  if (index !== -1) arr.splice(index, 1);
}
