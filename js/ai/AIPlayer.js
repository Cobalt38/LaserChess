// Il computer come avversario. Quando tocca a lui cerca la mossa con AISearch (qualche
// millisecondo per frame, così l'animazione non si ferma), la gioca, lascia il tempo di vederla
// e poi spara. Le mosse passano da board.applyRemote, come quelle dell'avversario online.
const AI_MIN_THINK = 0.7; // secondi minimi di "pensiero", per non rispondere di scatto
const AI_AIM_TIME = 0.9; // secondi tra la mossa e lo sparo: si vede cosa ha mosso e dove mira
const AI_FRAME_BUDGET = 8; // millisecondi di ricerca per frame

class AIPlayer {
  constructor(board, side, level) {
    this.board = board;
    this.side = side; // indice del giocatore comandato dal computer
    this.level = level; // chiave di AI_LEVELS
    this.search = null;
    this.version = -1; // board.version quando è partita la ricerca
    this.elapsed = 0;
  }

  get thinking() {
    return !!this.search;
  }

  get myTurn() {
    const b = this.board;
    return b.turn === this.side && !b.gameOver && !b.busy;
  }

  update(dt) {
    const b = this.board;
    if (!this.myTurn) {
      this.search = null;
      this.elapsed = 0;
      return;
    }
    if (b.phase === "fire") {
      this.search = null;
      this.elapsed += dt;
      if (this.elapsed >= AI_AIM_TIME) {
        this.elapsed = 0;
        b.applyRemote({ type: "fire", key: b.positionKey() });
      }
      return;
    }
    // La board è cambiata sotto i piedi (nuova partita, partita ripresa): si ricomincia
    if (this.search && this.version !== b.version) this.search = null;
    if (!this.search) {
      const cells = Engine.fromBoard(b);
      // Messo male e con la posizione ripetuta tre volte: meglio la patta
      if (b.drawClaimable && Engine.evaluate(cells, this.side) < -150) {
        b.applyRemote({ type: "claimDraw" });
        return;
      }
      this.search = new AISearch(cells, this.side, this.level);
      this.version = b.version;
      this.elapsed = 0;
    }
    this.elapsed += dt;
    if (this.search.step(AI_FRAME_BUDGET) && this.elapsed >= AI_MIN_THINK) {
      const action = this.search.action;
      this.search = null;
      this.elapsed = 0;
      if (!action || !b.applyRemote(action)) {
        // Non dovrebbe succedere: mossa del motore che la board rifiuta
        console.error("Mossa del computer non valida", action);
        b.applyRemote({ type: "rotate", at: b.players[this.side].laser.cell.name, rot: b.players[this.side].laser.rotations()[0] });
      }
    }
  }
}
