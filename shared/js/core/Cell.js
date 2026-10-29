class Cell {
  constructor(i, cellSize) {
    this.x = i % COLS; //colonna (0-based, da sinistra)
    this.y = Math.floor(i / COLS); //riga (0-based, dall'alto)
    this.rx = this.x + 1; //colonna 1..COLS
    this.ry = ROWS - this.y; //riga 1..ROWS, dal basso
    this.size = cellSize;
    this.px = this.x * cellSize; //angolo in alto a sinistra
    this.py = this.y * cellSize;
    this.center = { x: this.px + cellSize / 2, y: this.py + cellSize / 2 };
    this.piece = null;
    this.selected = false;
    this.highlight = false;
    this.deny = false; //shows that moving here is forbidden (X)
    this.playerExclusive = null; //only this player can move here
  }

  getCenter() {
    return this.center;
  }

  // Nome in stile scacchi: colonna a..j, riga 1..8 (es. "e1")
  get name() {
    return String.fromCharCode(97 + this.x) + this.ry;
  }

  setPiece(piece) {
    this.piece = piece;
  }

  isOccupied() {
    return !!this.piece;
  }

  // Parte statica (sfondo + caselle riservate): disegnata una volta sola nel buffer g della board
  drawBackground(g) {
    g.stroke(255);
    g.strokeWeight(0.25);
    g.fill(0);
    g.rect(this.px, this.py, this.size, this.size);
    if (this.playerExclusive) {
      g.push();
      g.fill(...this.playerExclusive.pColor, 70);
      g.rectMode(CENTER);
      g.rect(this.center.x, this.center.y, this.size * 0.9, this.size * 0.9, 1);
      g.pop();
    }
  }

  // Parte dinamica: selezione (pulsante), divieto e caselle raggiungibili
  showOverlay() {
    if (!(this.selected || this.deny || this.highlight)) return;
    if (this.selected) {
      push();
      const pulse = (Math.sin(millis() / 160) + 1) / 2; // 0..1
      const strok = 4 + pulse * 1.5;
      rectMode(CENTER);
      stroke(150 + 70 * pulse, 150 + 70 * pulse, 20 + 40 * pulse);
      strokeWeight(strok);
      noFill();
      rect(this.center.x, this.center.y, this.size - strok, this.size - strok);
      pop();
    }
    if (this.deny) {
      push();
      const strok = 5;
      const r = this.size * 0.6;
      stroke(240, 40, 60, 180);
      strokeWeight(strok);
      noFill();
      translate(this.center.x, this.center.y);
      ellipse(0, 0, r, r);
      rotate(-QUARTER_PI);
      strokeCap(PROJECT);
      line(-r / 2 + strok, 0, r / 2 - strok, 0);
      pop();
    }
    if (this.highlight) {
      push();
      noStroke();
      fill(220, 210, 60, 75);
      rect(this.px, this.py, this.size, this.size);
      pop();
    }
  }
}
