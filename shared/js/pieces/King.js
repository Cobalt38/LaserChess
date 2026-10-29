class King extends Piece {
  constructor(_player) {
    super(_player);
    this.rot = "N"
  }

  hit(dir) {
    return { out: [], effect: "king" };
  }

  show() {
    push();
    fill(...this.player.pColor);

    if (this.cell) {
      const pos = this.cell.center;
      const size = this.cell.size * 0.667;

      rectMode(CENTER);
      noStroke();
      rect(pos.x, pos.y, size, size, 6);

      translate(pos.x, pos.y);
      stroke(0, 180);
      strokeWeight(1.5);
      noFill();

      const arcRadius = size * 0.667;

      for (let i = 0; i < 4; i++) {
        push();
        rotate(i * HALF_PI);
        arc(0, 2, arcRadius, arcRadius, 0, PI, CHORD)
        stroke(...MIRROR_COLOR, 180);
        strokeWeight(4)
        point(arcRadius / 2, 0)
        pop();
      }
    }

    pop();
  }
}
