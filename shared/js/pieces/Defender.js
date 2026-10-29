class Defender extends Piece {
  hit(dir) {
    // Il fronte (rot) blocca il raggio che arriva da quella parte, altrimenti il Defender salta
    return { out: [], effect: this.rot === OPPOSITE[dir] ? "block" : "destroy" };
  }

  rotations() {
    return [rotateIn(DIRS, this.rot, -1), rotateIn(DIRS, this.rot, 1)];
  }

  show() {
    push()
    const s = this.cell.size;
    fill(...this.player.pColor)
    stroke(...MIRROR_COLOR, 180)
    strokeWeight(1)
    translate(this.cell.center.x, this.cell.center.y)
    rotate(DIRS.indexOf(this.rot) * HALF_PI)
    arc(0, 0, s / 1.3, s / 1.3, -QUARTER_PI / 2, PI + QUARTER_PI / 2)
    stroke(0, 180)
    strokeWeight(2)
    arc(0, 0, s * 0.66, s * 0.66, -QUARTER_PI / 2, PI + QUARTER_PI / 2)
    push()
    translate(0, s / 10)
    // scudo: prima lo specchio verde, poi il bordo scuro sopra
    for (const [col, w] of [[MIRROR_COLOR, 4], [[0, 180], 2]]) {
      stroke(...col)
      strokeWeight(w)
      line(-s / 4, -s / 6, s / 4, -s / 6)
      line(-s / 4, -s / 6, -s / 4, -s / 3)
      line(s / 4, -s / 6, s / 4, -s / 3)
      line(0, 0, 0, -s / 6)
    }
    pop()
    strokeWeight(1)
    stroke(0, 180)
    fill(0, 180)
    arc(0, 2, 10, 20, 0, PI, CHORD)
    pop()
  }
}
