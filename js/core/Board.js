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
    this.version = 0; // cambia a ogni modifica di pezzi, turno o nomi (anteprima del laser, salvataggio)
    this.showPreview = true; // traiettoria tratteggiata del laser prima di sparare
    this.previewRotation = null; // { piece, rot }: rotazione da mostrare nell'anteprima (pulsante sotto il mouse)
    this.preview = null; // { key, beam }: anteprima calcolata per l'ultima disposizione
    this.onEvent = () => { }; // onEvent(nome, dati): suoni, UI...

    // Chi gioca da questo browser: in due sullo stesso schermo, contro il computer o online
    // (vedi js/net/Online.js e js/ai/AIPlayer.js)
    this.localIndex = null; // null = tutti e due i giocatori qui; 0/1 = solo quel giocatore
    this.opponentReady = false; // l'altro giocatore (computer o collegato online) c'è
    this.onAction = () => { }; // onAction(azione): mossa fatta qui, da mandare all'altro giocatore
    this.remoteQueue = []; // azioni ricevute, applicate quando il laser non è in volo
    this.applyingRemote = false;
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

  get localPlayer() {
    return this.localIndex === null ? null : this.players[this.localIndex];
  }

  // Tocca a chi sta usando questo browser? (in locale sempre; online solo nel proprio turno)
  get myTurn() {
    if (this.localIndex === null) return true;
    return this.opponentReady && this.activePlayer === this.localPlayer;
  }

  get localCanFire() {
    return this.canFire && this.myTurn;
  }

  get localCanUndo() {
    return this.canUndo && this.myTurn;
  }

  get dragging() {
    return this.press && this.press.dragging ? this.press.piece : null;
  }

  // Pezzo proprio selezionato che si può ruotare adesso (pulsanti ↺ ↻ e menu)
  get rotatable() {
    const piece = this.selected && this.selected.piece;
    if (!piece || this.phase !== "move" || this.busy || this.gameOver || !this.myTurn) return null;
    return piece.player === this.activePlayer && piece.rotations().length > 0 ? piece : null;
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

  // Casella dal nome in stile scacchi ("e1")
  cellByName(name) {
    return this.getCell(name.charCodeAt(0) - 96, parseInt(name.slice(1), 10));
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
    if (!slot) throw new Error("Cannot add any more players to this board!");
    const player = new Player(name, slot.color);
    this.players.push(player);
    this.addPiece(Laser, player, slot.laser.x, slot.laser.y, slot.laser.rot);
    for (const [x, y] of slot.exclusive) this.getCell(x, y).playerExclusive = player;
    this.refreshNames();
    this.invalidateGrid();
    return player;
  }

  // Pezzi delle varianti scelte (chiavi di VARIANTS), una variante alla volta. Ognuno parte dalla
  // casella indicata in VARIANTS; se è occupata, o se così qualcuno potrebbe eliminare un pezzo
  // avversario già alla prima mossa (es. il Prism che apre il raggio verso un pezzo scoperto), si
  // prova la casella libera successiva, dalla più vicina. I pezzi di una variante si spostano
  // insieme e l'arancione cerca a specchio del blu, così la board resta simmetrica
  placeVariants(keys) {
    for (const key of keys) {
      const pieces = VARIANTS[key].pieces.map(([PieceClass, owner, x, y, rot]) => {
        const player = this.players[owner];
        return { PieceClass, player, rot, cells: this.freeCellsNear(player, x, y) };
      });
      const tries = Math.min(...pieces.map((p) => p.cells.length));
      let safe = false;
      for (let k = 0; k < tries && !safe; k++) {
        const added = pieces.map((p) => this.addPiece(p.PieceClass, p.player, p.cells[k].rx, p.cells[k].ry, p.rot));
        safe = Engine.openingCaptures(Engine.fromBoard(this)).length === 0;
        if (!safe) for (const piece of added) this.destroyPiece(piece);
      }
      if (!safe && tries > 0) {
        // Nessuna casella sicura (non succede con le varianti attuali: lo controlla
        // tests/rules.test.js): almeno la più vicina
        for (const p of pieces) this.addPiece(p.PieceClass, p.player, p.cells[0].rx, p.cells[0].ry, p.rot);
      }
    }
  }

  // Caselle libere in cui può entrare un pezzo di player, dalla più vicina a (x, y).
  // Per l'arancione l'ordine è lo specchio di quello del blu
  freeCellsNear(player, x, y) {
    const mirrored = this.players.indexOf(player) === 1;
    const flip = (cx, cy) => (mirrored ? [COLS + 1 - cx, ROWS + 1 - cy] : [cx, cy]);
    const [bx, by] = flip(x, y); // la casella vista dal blu
    const candidates = [];
    for (let cx = 1; cx <= COLS; cx++) {
      for (let cy = 1; cy <= ROWS; cy++) {
        const d = Math.max(Math.abs(cx - bx), Math.abs(cy - by)) * 100 + Math.abs(cx - bx) + Math.abs(cy - by);
        candidates.push({ d, cx, cy });
      }
    }
    candidates.sort((a, b) => a.d - b.d || a.cy - b.cy || a.cx - b.cx);
    return candidates
      .map(({ cx, cy }) => this.getCell(...flip(cx, cy)))
      .filter((cell) => !cell.piece && (!cell.playerExclusive || cell.playerExclusive === player));
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
    this.version++;
    return newPiece;
  }

  destroyPiece(piece) {
    if (piece.cell.piece === piece) piece.cell.setPiece(null);
    removeFrom(piece.player.pieces, piece);
    removeFrom(this.pieces, piece);
    this.version++;
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
    this.preview = null;
    this.remoteQueue = [];
    this.version++;
  }

  renamePlayer(index, name) {
    const player = this.players[index];
    if (!player || player.baseName === name) return;
    player.baseName = name;
    this.refreshNames();
  }

  // Nomi mostrati: se i due giocatori hanno lo stesso nome, il secondo diventa "Nome (2)"
  refreshNames() {
    const [a, b] = this.players;
    for (const p of this.players) p.name = p.baseName;
    if (a && b && sameName(a.baseName, b.baseName)) b.name = `${b.baseName.trim()} (2)`;
    this.historyVersion++; // lo storico mostra i nomi
    this.version++;
  }

  // Prepara una configurazione di SETUPS, più i pezzi delle VARIANTS scelte (vedi setups.js)
  setup(name, playerNames = ["Player1", "Player2"], variants = []) {
    const layout = SETUPS[name];
    if (!layout) throw new Error(`Unknown setup: ${name}`);
    this.resetBoard();
    this.setupName = name;
    const players = playerNames.map((n) => this.addPlayer(n));
    for (const [PieceClass, owner, x, y, rot] of layout) {
      this.addPiece(PieceClass, players[owner], x, y, rot);
    }
    // Una variante non si aggiunge se la disposizione ha già il suo pezzo (es. PRISMA)
    const present = new Set(layout.map(([PieceClass]) => PieceClass));
    this.placeVariants(variants.filter((v) => !VARIANTS[v].pieces.some(([PieceClass]) => present.has(PieceClass))));
    return players;
  }

  start() {
    if (this.turn !== -1) return;
    this.turn = 0; // inizia il primo giocatore (blu)
    this.version++;
    this.recordPosition();
  }

  endTurn() {
    this.pendingUndo = null;
    this.turn = (this.turn + 1) % this.players.length;
    this.phase = "move";
    this.version++;
    this.recordPosition();
    this.onEvent("turn");
  }

  endGame() {
    const losers = this.hitKings.map((k) => k.player);
    const survivors = this.players.filter((p) => !losers.includes(p));
    // Entrambi i re colpiti nello stesso colpo -> pareggio
    this.gameOver = { winner: survivors.length === 1 ? survivors[0] : null, reason: "king" };
    this.version++;
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
    if (!this.applyingRemote && !this.myTurn) return;
    this.cancelSelection();
    this.gameOver = { winner: null, reason: "repetition" };
    this.version++;
    this.emit({ type: "claimDraw" });
    this.onEvent("gameover", this.gameOver);
  }

  // Mossa fatta (spostamento o rotazione): va annotata e poi bisogna sparare.
  // undo() la rimette com'era finché non si spara
  record(text, cells, undo) {
    this.pendingUndo = { undo, lastMove: this.lastMove, drawClaimable: this.drawClaimable };
    this.history.push({ n: this.history.length + 1, player: this.activePlayer, text, hits: [] });
    this.historyVersion++;
    this.lastMove = { cells, player: this.activePlayer };
    this.beam = null; // via il raggio del turno precedente, se si vede ancora
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
    this.emit({ type: "move", from: from.name, to: target.name });
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
    this.version++;
  }

  rotatePiece(piece, rot) {
    const old = piece.rot;
    this.record(`ruota ${piece.type} ${piece.cell.name} (${old} → ${rot})`, [piece.cell],
      () => this.turnPiece(piece, old));
    this.turnPiece(piece, rot);
    this.emit({ type: "rotate", at: piece.cell.name, rot });
    this.onEvent("rotate");
  }

  // Cambia rotazione e fa girare il pezzo dal vecchio orientamento al nuovo
  turnPiece(piece, rot) {
    const cycle = DIRS.includes(rot) ? DIRS : DIAGONALS;
    const step = (cycle.indexOf(rot) - cycle.indexOf(piece.rot) + 4) % 4; // 1 orario, 3 antiorario
    piece.rot = rot;
    piece.spin += (step === 3 ? 1 : -step) * HALF_PI;
    this.version++;
  }

  // Rotazione del pezzo selezionato dai pulsanti: step -1 antioraria, +1 oraria
  rotateSelected(step) {
    const piece = this.rotatable;
    if (!piece) return;
    this.previewRotation = null;
    this.rotatePiece(piece, this.rotationFor(piece, step));
  }

  // Ripensamento prima di sparare: la mossa torna indietro e il turno ricomincia
  undoMove() {
    if (!this.canUndo || (!this.applyingRemote && !this.myTurn)) return;
    const { undo, lastMove, drawClaimable } = this.pendingUndo;
    this.pendingUndo = null;
    undo();
    this.history.pop();
    this.historyVersion++;
    this.lastMove = lastMove;
    this.drawClaimable = drawClaimable;
    this.phase = "move";
    this.emit({ type: "undo" });
    this.onEvent("undo");
  }

  fireLaser() {
    if (!this.canFire || (!this.applyingRemote && !this.myTurn)) return;
    // La disposizione prima dello sparo: l'altro giocatore controlla di avere la stessa
    this.emit({ type: "fire", key: this.positionKey() });
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

  // ---------- Online ----------

  emit(action) {
    if (!this.applyingRemote) this.onAction(action);
  }

  queueRemote(action) {
    this.remoteQueue.push(action);
  }

  // Applica un'azione dell'altro giocatore controllando che sia valida qui.
  // false = le due board non coincidono più (serve una risincronizzazione)
  applyRemote(a) {
    if (this.gameOver) return false;
    this.applyingRemote = true;
    try {
      switch (a.type) {
        case "move": {
          const from = this.cellByName(a.from);
          const to = this.cellByName(a.to);
          const piece = from && from.piece;
          if (this.phase !== "move" || !piece || !to || piece.player !== this.activePlayer ||
            !this.neighbors(from).includes(to) || !piece.canMoveTo(to)) return false;
          this.cancelSelection();
          this.movePiece(piece, to);
          return true;
        }
        case "rotate": {
          const cell = this.cellByName(a.at);
          const piece = cell && cell.piece;
          if (this.phase !== "move" || !piece || piece.player !== this.activePlayer ||
            !piece.rotations().includes(a.rot)) return false;
          this.cancelSelection();
          this.rotatePiece(piece, a.rot);
          return true;
        }
        case "undo":
          if (!this.canUndo) return false;
          this.undoMove();
          return true;
        case "fire":
          if (!this.canFire || a.key !== this.positionKey()) return false;
          this.fireLaser();
          return true;
        case "claimDraw":
          if (!this.drawClaimable || this.phase !== "move") return false;
          this.claimDraw();
          return true;
      }
      return false;
    } finally {
      this.applyingRemote = false;
    }
  }

  // Fotografia completa della partita, per allineare l'altro giocatore
  snapshot() {
    const idx = (player) => this.players.indexOf(player);
    return {
      setup: this.setupName,
      players: this.players.map((p) => p.baseName),
      pieces: this.pieces.map((p) => [p.type, idx(p.player), p.cell.rx, p.cell.ry, p.rot]),
      turn: this.turn,
      phase: this.phase,
      history: this.history.map((e) => ({ n: e.n, player: idx(e.player), text: e.text, hits: e.hits })),
      lastMove: this.lastMove && { cells: this.lastMove.cells.map((c) => c.name), player: idx(this.lastMove.player) },
      positions: [...this.positions],
      drawClaimable: this.drawClaimable,
      gameOver: this.gameOver && { winner: idx(this.gameOver.winner), reason: this.gameOver.reason },
    };
  }

  restore(s) {
    this.resetBoard();
    this.setupName = s.setup;
    const players = s.players.map((name) => this.addPlayer(name));
    for (const [type, owner, x, y, rot] of s.pieces) {
      if (type === "Laser") {
        players[owner].laser.rot = rot; // i Laser li mette già addPlayer, nel loro angolo
        continue;
      }
      this.addPiece(PIECE_TYPES[type], players[owner], x, y, rot);
    }
    this.turn = s.turn;
    this.phase = s.phase;
    this.history = s.history.map((e) => ({ n: e.n, player: players[e.player], text: e.text, hits: e.hits }));
    this.historyVersion++;
    this.lastMove = s.lastMove && {
      cells: s.lastMove.cells.map((name) => this.cellByName(name)),
      player: players[s.lastMove.player],
    };
    this.positions = new Map(s.positions);
    this.drawClaimable = s.drawClaimable;
    this.gameOver = s.gameOver && { winner: players[s.gameOver.winner] || null, reason: s.gameOver.reason };
  }

  update(dt) {
    // Azioni dell'altro giocatore, in ordine, quando il laser non è in volo
    while (this.remoteQueue.length > 0 && !this.busy) {
      const action = this.remoteQueue.shift();
      if (!this.applyRemote(action)) {
        this.remoteQueue = [];
        this.onEvent("desync", action);
        break;
      }
    }

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

    if (this.beam && this.beam.resolved && !this.gameOver) {
      this.beam.hold += dt;
      if (this.beam.hold > BEAM_LINGER) this.beam = null;
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
      this.onEvent("deny", { piece }); // la UI spiega che pezzo è
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
    if (!this.myTurn) {
      this.onEvent("notYourTurn");
      return;
    }
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
    // Pezzo già selezionato e tocco su una casella evidenziata: il pezzo ci va
    const selected = this.selected && this.selected.piece;
    if (cell && cell.highlight && selected && cell !== this.selected) {
      this.movePiece(selected, cell);
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

  // Board vuota, solo griglia e caselle riservate (mentre si sceglie la nuova partita)
  showEmpty() {
    if (!this.gridLayer) this.gridLayer = this.renderGrid();
    image(this.gridLayer, 0, 0, this.width + 1, this.height + 1);
  }

  // Rotazione che faranno i pulsanti accanto al pezzo: step -1 antioraria, +1 oraria
  rotationFor(piece, step) {
    const rots = piece.rotations();
    return rots.length === 1 || step < 0 ? rots[0] : rots[1];
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
    this.showLaserPreview();
    if (this.beam) this.beam.show();
    for (const e of this.effects) e.show();
    pop();

    if (this.menu) this.menu.show(this.pointer);
  }

  // Dove andrebbe il laser di chi deve muovere: con la disposizione attuale o, mentre si trascina
  // un pezzo su una casella valida, con il pezzo spostato lì. Si calcola solo quando cambia qualcosa
  laserPreview() {
    // Mentre si vede il raggio dell'ultimo colpo, niente anteprima
    if (!this.showPreview || this.beam || this.gameOver || !this.activePlayer) return null;
    const dragged = this.dragging;
    const target = dragged && this.cellAt(this.pointer);
    const hypothetical = target && target.highlight && target !== this.press.from ? target : null;
    const turning = !hypothetical && this.previewRotation && this.rotatable === this.previewRotation.piece
      ? this.previewRotation : null;
    const key = `${this.version}|${this.turn}|${hypothetical ? hypothetical.name : ""}|${turning ? turning.rot : ""}`;
    if (this.preview && this.preview.key === key) return this.preview.beam;
    let beam;
    if (hypothetical) {
      // Sposto il pezzo per un attimo (senza animazioni né storico), calcolo il raggio e lo rimetto
      const from = dragged.cell;
      dragged.move(hypothetical);
      beam = new LaserBeam(this, this.activePlayer.laser);
      dragged.move(from); // lo Switch rifà lo scambio al contrario
    } else if (turning) {
      // Idem per la rotazione sotto il mouse
      const old = turning.piece.rot;
      turning.piece.rot = turning.rot;
      beam = new LaserBeam(this, this.activePlayer.laser);
      turning.piece.rot = old;
    } else {
      beam = new LaserBeam(this, this.activePlayer.laser);
    }
    this.preview = { key, beam };
    return beam;
  }

  showLaserPreview() {
    const beam = this.laserPreview();
    if (!beam) return;
    push();
    noFill();
    strokeCap(ROUND);
    // Tratteggio che scorre nel verso del raggio
    drawingContext.setLineDash([4, 7]);
    drawingContext.lineDashOffset = -millis() / 40;
    stroke(...LASER_COLOR.outer, 210);
    strokeWeight(2.5);
    for (const s of beam.segments) line(s.a.x, s.a.y, s.b.x, s.b.y);
    drawingContext.setLineDash([]);
    // Pezzi che verrebbero eliminati: mirino rosso; il King: mirino che pulsa
    const pulse = (Math.sin(millis() / 150) + 1) / 2;
    for (const { cell, effect } of beam.events) {
      if (effect !== "destroy" && effect !== "king") continue;
      // La casella del colpo, non quella attuale del pezzo: trascinandolo, il raggio è calcolato
      // con il pezzo nella casella sotto il dito
      const c = cell.center;
      const r = this.cellSize * (effect === "king" ? 0.42 + 0.06 * pulse : 0.4);
      stroke(255, 60, 50, effect === "king" ? 255 : 220);
      strokeWeight(effect === "king" ? 3.5 : 2.5);
      ellipse(c.x, c.y, r * 2);
      const k = r * 0.55;
      line(c.x - k, c.y - k, c.x + k, c.y + k);
      line(c.x - k, c.y + k, c.x + k, c.y - k);
    }
    pop();
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
