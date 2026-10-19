// Specchio semitrasparente (pezzo inventato): metà del raggio prosegue dritta, metà viene
// riflessa di 90°. Funziona da entrambi i lati come lo Switch e non può essere eliminato,
// ma non può fare scambi.
class HalfMirror extends Piece {
  get isSlash() {
    return this.rot === "NE" || this.rot === "SW";
  }

  hit(dir) {
    return { out: [dir, diagonalReflection(this.isSlash, dir)], effect: "reflect" };
  }

  rotations() {
    return [this.isSlash ? "SE" : "NE"];
  }

  show() {
    const s = this.cell.size;
    const c = this.cell.center;
    push();
    translate(c.x, c.y);

    // Base: disco del colore del giocatore
    stroke(0, 180);
    strokeWeight(1);
    fill(...this.player.pColor, 110);
    ellipse(0, 0, s * 0.62);
    noFill();
    stroke(...this.player.pColor);
    strokeWeight(2);
    ellipse(0, 0, s * 0.56);

    rotate(QUARTER_PI + (this.isSlash ? 0 : 1) * HALF_PI);

    // Lastra di vetro
    rectMode(CENTER);
    stroke(200, 240, 255, 170);
    strokeWeight(1);
    fill(170, 225, 255, 60);
    rect(0, 0, s * 0.86, s * 0.18, 4);

    // Specchiatura a metà: tratteggio verde
    stroke(...MIRROR_COLOR, 230);
    strokeWeight(3);
    strokeCap(SQUARE);
    const step = s * 0.12;
    for (let x = -s * 0.39; x < s * 0.39; x += step) line(x, 0, x + step / 2, 0);

    // Riflesso sul vetro
    stroke(255, 255, 255, 150);
    strokeWeight(1.5);
    strokeCap(ROUND);
    line(-s * 0.3, -s * 0.05, -s * 0.1, -s * 0.05);

    // Fermi alle estremità
    noStroke();
    fill(...this.player.pColor);
    rect(-s * 0.43, 0, s * 0.06, s * 0.24, 2);
    rect(s * 0.43, 0, s * 0.06, s * 0.24, 2);
    pop();
  }
}
