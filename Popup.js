// Menu del pezzo (tasto destro o pressione prolungata): un pulsante per ogni voce { icon, run }.
// Per ora le voci sono le rotazioni ("ccw" ↺, "cw" ↻, "single" per chi ha una sola rotazione);
// un'abilità attivabile sarà semplicemente un'altra voce.
class ActionMenu {
  static BUTTON = 50;

  constructor(piece, items) {
    const B = ActionMenu.BUTTON;
    this.piece = piece;
    this.items = items;
    this.w = B * items.length;
    this.h = B;
    // Si apre verso il centro della board così non esce dai bordi
    const c = piece.cell.center;
    this.x = c.x <= piece.board.width / 2 ? c.x : c.x - this.w;
    this.y = c.y <= piece.board.height / 2 ? c.y : c.y - this.h;
  }

  // Indice del pulsante sotto il punto p (coordinate board), -1 se fuori
  buttonAt(p) {
    if (!p || p.x < this.x || p.x > this.x + this.w || p.y < this.y || p.y > this.y + this.h) return -1;
    return Math.min(this.items.length - 1, Math.floor((p.x - this.x) / ActionMenu.BUTTON));
  }

  // Voce sotto il punto p, o null se è fuori dal menu
  itemAt(p) {
    const i = this.buttonAt(p);
    return i === -1 ? null : this.items[i];
  }

  show(pointer) {
    const B = ActionMenu.BUTTON;
    push();
    rectMode(CORNER);
    fill(200, 200, 200, 150);
    stroke(0);
    strokeWeight(1);
    rect(this.x, this.y, this.w, this.h, 3);

    const hover = this.buttonAt(pointer);
    if (hover !== -1) {
      noStroke();
      fill(255, 255, 255, 90);
      rect(this.x + hover * B, this.y, B, this.h, 3);
    }

    this.items.forEach((item, i) => {
      if (i > 0) {
        stroke(0);
        strokeWeight(1);
        line(this.x + i * B, this.y, this.x + i * B, this.y + this.h);
      }
      push();
      translate(this.x + i * B + B / 2, this.y + this.h / 2);
      this.drawIcon(item.icon, B);
      pop();
    });
    pop();
  }

  drawIcon(icon, s) {
    stroke(0);
    noFill();
    strokeWeight(4);
    const d = s * 6.5 / 12;
    if (icon === "cw") {
      rotate(-HALF_PI - QUARTER_PI);
      arc(0, 0, d, d, PI, PI + 3 * HALF_PI);
      rotate(0.15);
      fill(0);
      triangle(0, s * 3 / 8, 0, s / 8, -s / 5, s / 4);
      return;
    }
    if (icon === "ccw") rotate(HALF_PI + QUARTER_PI);
    arc(0, 0, d, d, PI / 2, TWO_PI);
    rotate(-0.15);
    fill(0);
    triangle(0, s / 8, 0, s * 3 / 8, s / 5, s / 4);
  }
}
