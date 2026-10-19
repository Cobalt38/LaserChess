class Piece {
  constructor(_player) {
    if (this.constructor === Piece)
      throw new TypeError(
        'Abstract class "Piece" cannot be instantiated directly.'
      );
    if (this.hit === undefined)
      throw new TypeError(
        'Classes extending "Piece" must contain a "hit" method'
      );
    if (this.show === undefined)
      throw new TypeError(
        'Classes extending "Piece" must contain a "show" method'
      );
    this.player = _player;
    this.canBeMoved = true;
    this.board = null;
    this.cell = null; // Cell where the piece is placed
    this.rot = null; // Initial rotation
    this.flash = 0; // 1 -> 0: bagliore quando il laser colpisce il pezzo
    this.flashColor = LASER_COLOR.outer;
    this.offset = { x: 0, y: 0 }; // spostamento dal centro della casella (trascinamento, scivolata)
    this.spin = 0; // rotazione residua da animare, in radianti, che torna a 0
  }

  get type() {
    return this.constructor.name;
  }

  // Disegna il pezzo con uno stile di partenza pulito
  draw() {
    push();
    stroke(255);
    strokeWeight(0);
    this.show();
    pop();
  }

  hitFlash(col) {
    this.flash = 1;
    this.flashColor = col;
  }

  // Le caselle helix sono riservate a un solo giocatore
  canEnter(cell) {
    return !cell.playerExclusive || cell.playerExclusive === this.player;
  }

  // cell è adiacente: il pezzo può andarci?
  canMoveTo(cell) {
    return this.canBeMoved && !cell.piece && this.canEnter(cell);
  }

  move(tg) {
    this.cell.setPiece(null);
    tg.setPiece(this);
    this.cell = tg;
  }

  // Rotazioni proposte nel menu del pezzo: [antioraria, oraria] o [unica]; [] = il pezzo non ruota
  rotations() {
    return [];
  }

  // hit(dir): reazione al laser che viaggia verso dir ed entra nella casella del pezzo.
  // Restituisce { out: direzioni in uscita, effect: "reflect" | "block" | "destroy" | "king" }.
  // Non deve modificare la board: l'effetto viene applicato quando il raggio animato arriva.
}

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

// Specchio diagonale che riflette da entrambi i lati (Switch, HalfMirror)
function diagonalReflection(isSlash, dir) {
  return (isSlash
    ? { S: "E", W: "N", E: "S", N: "W" }
    : { S: "W", E: "N", N: "E", W: "S" })[dir];
}

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
