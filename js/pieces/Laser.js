class Laser extends Piece {
  constructor(_player) {
    super(_player);
    this.canBeMoved = false;
  }

  hit(dir) {
    return { out: [], effect: "block" }; // il Laser non può essere eliminato
  }

  // Punta verso la prima colonna o verso la prima riga
  rotations() {
    return [{ N: "W", W: "N", S: "E", E: "S" }[this.rot]];
  }

  show() {
    if (!this.cell) {
      throw new Error("No cell for this piece")
    }
    let size = this.cell.size;
    push();
    fill(...this.player.pColor);
    translate(this.cell.center.x, this.cell.center.y);
    rotate(DIRS.indexOf(this.rot) * HALF_PI);
    triangle(-size / 3, size / 3, size / 3, size / 3, 0, -size / 3);
    push()
    stroke("red")
    strokeWeight(6)
    point(0, 0)
    stroke("yellow")
    strokeWeight(3)
    point(0, 0)
    pop()
    fill(0, 70);
    stroke(0)
    strokeWeight(1)
    arc(0, 2, 10, 20, 0, PI, CHORD)
    pop();
  }
}
