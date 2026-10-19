class Deflector extends Piece { //rot NE SE SW NW
  static REFLECTIONS = {
    NE: { S: "E", W: "N" },
    SW: { E: "S", N: "W" },
    NW: { S: "W", E: "N" },
    SE: { N: "E", W: "S" }
  };

  hit(dir) {
    const out = Deflector.REFLECTIONS[this.rot][dir];
    // Lato a specchio: riflette di 90°. Qualunque altro lato: eliminato
    return out ? { out: [out], effect: "reflect" } : { out: [], effect: "destroy" };
  }

  rotations() {
    return [rotateIn(DIAGONALS, this.rot, -1), rotateIn(DIAGONALS, this.rot, 1)];
  }

  drawBody(r) {
    beginShape();
    vertex(+r, -r);
    vertex(-r, -r);
    vertex(-r, +r);
    vertex(0, +r);
    vertex(-r / 2, +r / 2);
    vertex(+r / 2, -r / 2);
    vertex(+r, 0);
    vertex(+r, -r);
    endShape();
  }

  show() {
    if (!this.cell || !this.board) return;

    push();

    const pos = this.cell.center;
    const r = this.cell.size * 0.33;
    translate(pos.x, pos.y);
    rotate(HALF_PI * ["SE", "SW", "NW", "NE"].indexOf(this.rot))

    // Forma principale
    fill(...this.player.pColor);
    stroke(...MIRROR_COLOR, 180)
    strokeWeight(1);
    this.drawBody(r);

    stroke(0, 180)
    strokeWeight(2)
    this.drawBody(r * 0.9);

    // Linee diagonali verdi
    stroke(...MIRROR_COLOR, 180);
    strokeWeight(4);
    push();
    rotate(-QUARTER_PI)
    strokeWeight(3)
    line(0, -r / 3, 0, r) // taglio
    stroke(...MIRROR_COLOR);
    line(-r * 0.9, 0, r * 0.9, 0) // linea 1
    strokeWeight(2)
    translate(0, r * 0.33)
    line(-r * 0.6, 0, r * 0.6, 0) // linea 2
    translate(0, r * 0.33)
    line(-r * 0.3, 0, r * 0.3, 0) //linea 3
    pop();

    // Semicerchio nero trasparente
    push();
    translate(-3, -3);
    rotate(HALF_PI + QUARTER_PI);
    stroke(0);
    strokeWeight(1);
    fill(0, 180);
    arc(0, -1, 10, 20, 0, PI, CHORD)
    pop();

    pop();
  }
}
