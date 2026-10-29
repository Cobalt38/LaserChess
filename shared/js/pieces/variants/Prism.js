// Prism (pezzo inventato): divide il raggio, che prosegue dritto e si apre ai due lati.
// Non può essere eliminato.
class Prism extends Piece {
  constructor(_player) {
    super(_player);
    this.rot = "N"
    this.t = 0;
  }

  hit(dir) {
    // Divide il raggio: prosegue dritto e si apre ai due lati
    return { out: DIRS.filter((d) => d !== OPPOSITE[dir]), effect: "reflect" };
  }

  show() {
    if (!this.cell) return;
    this.t = (this.t + deltaTime * 0.006) % TWO_PI // ~0.1 per frame a 60fps
    push();
    let pos = this.cell.center;
    translate(pos.x, pos.y);

    let s = this.cell.size * 0.35;

    fill(...this.player.pColor);
    stroke(...MIRROR_COLOR, 180);
    strokeWeight(1);
    rotate(QUARTER_PI / 2) // per ottagono
    this.drawRegularPolygon(8, s); // bordo
    stroke(0, 180)
    strokeWeight(1)
    noFill()
    this.drawRegularPolygon(8, s * 0.9) // bordo interno
    strokeWeight(3)
    stroke(0, 220)
    this.drawRegularPolygon(8, s * 0.5) // timone
    strokeWeight(1)
    stroke(0);
    let tNorm = (this.t / TWO_PI); // da 0 a 1
    let pulse = abs(0.5 - tNorm) * 2; // da 0 → 1 → 0
    let alpha = pulse * 90; // max alpha
    for (let i = 0; i < 6; i++) {
      let r = 4 * i;
      fill(200, 20, 20, alpha);
      stroke(200, 20, 20, alpha);
      strokeWeight(6 - i);
      ellipse(0, 0, r);
    }
    rotate(QUARTER_PI / 2)

    stroke(...MIRROR_COLOR, 220)
    strokeWeight(2)
    strokeCap(ROUND);
    let lineLen = s * 0.6;
    let lineClos = s * 0.1;
    line(-lineLen, lineClos, lineLen, lineClos);
    line(-lineLen, -lineClos, lineLen, -lineClos);
    rotate(HALF_PI);
    line(-lineLen, lineClos, lineLen, lineClos);
    line(-lineLen, -lineClos, lineLen, -lineClos);

    rectMode(CENTER)
    stroke(0)
    strokeWeight(1)
    fill(...MIRROR_COLOR, 220)
    rect(0, 0, 10, 10)
    fill(0, 180)
    rect(0, 0, 3, 3)
    stroke("red")
    strokeWeight(6)
    point(0, 0)
    stroke("yellow")
    strokeWeight(3)
    point(0, 0)
    pop();
  }

  drawRegularPolygon(n, radius) {
    let on = 1//Math.floor((this.t / TWO_PI) * 2) % 2;
    beginShape(TRIANGLE_FAN);
    vertex(0, 0);
    for (let i = 0; i < n + 1; i++) {
      let angle = TWO_PI * i / n;
      let x = cos(angle) * radius;
      let y = sin(angle) * radius;
      if ((i % 2 === on)) { // in TRIANGLE_FAN il fill è per vertice: spicchi alternati
        push();
        fill(...this.player.pColor, 130)
        vertex(x, y);
        pop();
      } else {
        vertex(x, y);
      }
    }
    endShape(CLOSE);
  }
}
