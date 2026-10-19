class Switch extends Piece {
  get isSlash() {
    return this.rot === "NE" || this.rot === "SW";
  }

  hit(dir) {
    // Specchio su entrambi i lati: riflette sempre, non può essere eliminato
    return { out: [diagonalReflection(this.isSlash, dir)], effect: "reflect" };
  }

  rotations() {
    return [this.isSlash ? "SE" : "NE"];
  }

  // Oltre alle caselle libere, può scambiarsi con un Defender o Deflector adiacente (di qualunque
  // colore), purché il pezzo scambiato possa entrare nella casella dello Switch
  canMoveTo(cell) {
    const other = cell.piece;
    if (!other) return super.canMoveTo(cell);
    return (
      (other instanceof Defender || other instanceof Deflector) &&
      this.canEnter(cell) &&
      other.canEnter(this.cell)
    );
  }

  move(tg) {
    const other = tg.piece;
    const from = this.cell;
    super.move(tg);
    if (other) {
      from.setPiece(other);
      other.cell = from;
    }
  }

  show() {
    const isSlash = this.isSlash;
    const x = this.cell.px;
    const y = this.cell.py;
    const s = this.cell.size;

    push();

    // Sfondo trasparente
    noStroke();
    fill(255, 30);
    rect(
      x + s / 5, y + s / 5,
      s * 3 / 5, s * 3 / 5,
      4);

    // Bordo sottile interno
    stroke(255, 50);
    strokeWeight(1);
    noFill();
    rect(x + s / 6, y + s / 6, s * 4 / 6, s * 4 / 6, 4);

    // Base diagonale
    push()
    translate(this.cell.center.x, this.cell.center.y);
    rotate(QUARTER_PI + (isSlash ? 0 : 1) * HALF_PI);
    rectMode(CENTER);
    fill(...this.player.pColor, 180);
    stroke(...this.player.pColor);
    rect(0, 0, s * 0.8, s * 0.2, 8)

    // Cerchio
    stroke(0)
    ellipse(0, 0, 20, 20)

    // Linea evidenziata interna sopra lo specchio
    stroke(...MIRROR_COLOR);
    strokeWeight(3);
    line(-s * 0.45, 0, s * 0.45, 0)
    pop()

    pop();
  }
}
