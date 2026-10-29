// Classe base di tutti i pezzi. Un pezzo nuovo è una sottoclasse in un suo file in questa cartella
// (o in variants/ se è inventato), con hit() e show(); poi va aggiunto in index.html.
class Piece {
  constructor(_player) {
    if (this.constructor === Piece)
      throw new TypeError(
        'Abstract class "Piece" cannot be instantiated directly.'
      );
    if (this.hit === undefined)
      throw new TypeError(
        'Classes extending "Piece" must contain a "hit" method'
      );
    if (this.show === undefined)
      throw new TypeError(
        'Classes extending "Piece" must contain a "show" method'
      );
    this.player = _player;
    this.canBeMoved = true;
    this.board = null;
    this.cell = null; // Cell where the piece is placed
    this.rot = null; // Initial rotation
    this.flash = 0; // 1 -> 0: bagliore quando il laser colpisce il pezzo
    this.flashColor = LASER_COLOR.outer;
    this.offset = { x: 0, y: 0 }; // spostamento dal centro della casella (trascinamento, scivolata)
    this.spin = 0; // rotazione residua da animare, in radianti, che torna a 0
  }

  get type() {
    return this.constructor.name;
  }

  // Disegna il pezzo con uno stile di partenza pulito
  draw() {
    push();
    stroke(255);
    strokeWeight(0);
    this.show();
    pop();
  }

  hitFlash(col) {
    this.flash = 1;
    this.flashColor = col;
  }

  // Le caselle helix sono riservate a un solo giocatore
  canEnter(cell) {
    return !cell.playerExclusive || cell.playerExclusive === this.player;
  }

  // cell è adiacente: il pezzo può andarci?
  canMoveTo(cell) {
    return this.canBeMoved && !cell.piece && this.canEnter(cell);
  }

  move(tg) {
    this.cell.setPiece(null);
    tg.setPiece(this);
    this.cell = tg;
  }

  // Rotazioni proposte nel menu del pezzo: [antioraria, oraria] o [unica]; [] = il pezzo non ruota
  rotations() {
    return [];
  }

  // hit(dir): reazione al laser che viaggia verso dir ed entra nella casella del pezzo.
  // Restituisce { out: direzioni in uscita, effect: "reflect" | "block" | "destroy" | "king" }.
  // Non deve modificare la board: l'effetto viene applicato quando il raggio animato arriva.
}

// Specchio diagonale che riflette da entrambi i lati (Switch, HalfMirror)
function diagonalReflection(isSlash, dir) {
  return (isSlash
    ? { S: "E", W: "N", E: "S", N: "W" }
    : { S: "W", E: "N", N: "E", W: "S" })[dir];
}
