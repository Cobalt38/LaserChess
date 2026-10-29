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

  // Losanga lungo lo specchio. Lo specchio è tratteggiato (metà del raggio passa) e la metà
  // della losanga dietro lo specchio è trasparente, come gli spicchi alterni del Prism
  show() {
    const s = this.cell.size;
    const c = this.cell.center;
    push();
    translate(c.x, c.y);
    rotate(QUARTER_PI + (this.isSlash ? 0 : 1) * HALF_PI); // come lo Switch: specchio lungo x

    noStroke();
    fill(...this.player.pColor);
    this.drawHalf(s, -1);
    fill(...this.player.pColor, 130);
    this.drawHalf(s, 1);

    // bordo verde e bordo scuro interno, come gli altri pezzi
    noFill();
    stroke(...MIRROR_COLOR, 180);
    strokeWeight(1);
    this.drawBody(s);
    stroke(0, 180);
    strokeWeight(2);
    this.drawBody(s * 0.88);

    // perno al centro, come lo Switch
    stroke(0);
    strokeWeight(1);
    fill(...this.player.pColor, 180);
    ellipse(0, 0, s * 0.22);

    // specchio: vetro scuro sotto, trattini verdi sopra
    const len = s * 0.36;
    stroke(0, 180);
    strokeWeight(4.5);
    line(-len, 0, len, 0);
    stroke(...MIRROR_COLOR);
    strokeWeight(3);
    strokeCap(SQUARE);
    const step = (2 * len) / 7;
    for (let i = 0; i < 7; i += 2) line(-len + i * step, 0, -len + (i + 1) * step, 0);
    pop();
  }

  drawBody(k) {
    beginShape();
    vertex(-0.43 * k, 0);
    vertex(-0.24 * k, -0.17 * k);
    vertex(0.24 * k, -0.17 * k);
    vertex(0.43 * k, 0);
    vertex(0.24 * k, 0.17 * k);
    vertex(-0.24 * k, 0.17 * k);
    endShape(CLOSE);
  }

  // Metà della losanga sopra (side -1) o sotto (side 1) lo specchio
  drawHalf(k, side) {
    beginShape();
    vertex(-0.43 * k, 0);
    vertex(-0.24 * k, side * 0.17 * k);
    vertex(0.24 * k, side * 0.17 * k);
    vertex(0.43 * k, 0);
    endShape(CLOSE);
  }
}
