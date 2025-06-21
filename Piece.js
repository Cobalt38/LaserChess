let dirV = {
  N: 0,
  E: 1,
  S: 2,
  W: 3,
  0: "N",
  1: "E",
  2: "S",
  3: "W",
};

let mirrorColor = [50, 230, 50];

class Piece {
  constructor(_type, _player) {
    if (this.constructor === Piece)
      throw new TypeError(
        'Abstract class "Piece" cannot be instantiated directly.'
      );
    if (this.reflect === undefined)
      throw new TypeError(
        'Classes extending "Piece" must contain a "reflect" method'
      );
    if (this.show === undefined)
      throw new TypeError(
        'Classes extending "Piece" must contain a "show" method'
      );
    this.player = _player;
    this.type = _type;
    this.canBeMoved = true;
    this.rotObj = {
      N: 0,
      E: PI / 2,
      S: PI,
      W: -PI / 2,
    };
    this.board = null;
    this.cell = null; // Cell where the piece is placed
    this.rot = null; // Initial rotation
    this.popupBounds = null; // corner(x,y) + size
  }

  selectionRoutine() { }

  move(tg) {
    if (!this.canBeMoved) {
      print("Error, trying to move a static piece");
      return false;
    }
    if (!!tg.piece) return;
    this.cell.setPiece(null);
    tg.piece = this;
    this.cell = tg;
  }

  getPopupCorner(popupSize = { x: 100, y: 50 }) {
    let cellPos = {
      x: this.cell.x * this.cell.size,
      y: this.cell.y * this.cell.size,
    };
    let cellSize = this.cell.size;
    let w = this.board.width;
    let h = this.board.height;

    if (cellPos.x <= w / 2) {
      if (cellPos.y <= h / 2) {
        return {
          x: cellPos.x + cellSize / 2,
          y: cellPos.y + cellSize / 2,
        };
      } else {
        return {
          x: cellPos.x + cellSize / 2,
          y: cellPos.y - popupSize.y / 2,
        };
      }
    } else {
      if (cellPos.y <= h / 2) {
        return {
          x: cellPos.x - popupSize.x + cellSize / 2,
          y: cellPos.y + cellSize / 2,
        };
      } else {
        return {
          x: cellPos.x - popupSize.x + cellSize / 2,
          y: cellPos.y - popupSize.y + cellSize / 2,
        };
      }
    }
  }

  getSimpleRotationPopup(popupSize = { x: 50, y: 50 }) {
    const corner = this.getPopupCorner(popupSize);
    this.popupBounds = { x: corner.x, y: corner.y, w: popupSize.x, h: popupSize.y };

    return () => {
      push();
      rectMode(CORNER);
      fill(200, 200, 200, 150);
      stroke(0);
      strokeWeight(1);
      rect(corner.x, corner.y, popupSize.x, popupSize.y, 3);

      translate(corner.x + popupSize.x / 2, corner.y + popupSize.y / 2);
      noFill();
      strokeWeight(4);
      arc(0, 0, popupSize.x * 6.5 / 12, popupSize.y * 6.5 / 12, PI / 2, TWO_PI);
      fill(0);
      rotate(-0.15);
      triangle(0, popupSize.y / 8, 0, popupSize.y * 3 / 8, popupSize.x / 5, popupSize.y / 4);
      pop();
    };
  }

  getDoubleRotationPopup(popupSize = { x: 100, y: 50 }) {
    const corner = this.getPopupCorner(popupSize);

    this.popupBounds = { x: corner.x, y: corner.y, w: popupSize.x, h: popupSize.y };

    return () => {
      push();
      rectMode(CORNER);
      fill(200, 200, 200, 150);
      stroke(0);
      strokeWeight(1)
      rect(corner.x, corner.y, popupSize.x, popupSize.y);
      line(
        corner.x + popupSize.x / 2,
        corner.y,
        corner.x + popupSize.x / 2,
        corner.y + popupSize.y
      );
      for (let offx of [0, 1]) {
        push();

        // Posizionamento: sinistra o destra
        let posX = corner.x + popupSize.x / 4 + (popupSize.x / 2) * offx;
        let posY = corner.y + popupSize.y / 2;
        translate(posX, posY);

        noFill();
        strokeWeight(4);

        // Arco: cambia verso in base a offx
        if (offx === 0) {
          // ↺ SX
          rotate(HALF_PI + QUARTER_PI)
          arc(0, 0, popupSize.x * 6.5 / 24, popupSize.y * 6.5 / 12, PI / 2, TWO_PI);
          rotate(-0.15);
          fill(0);
          triangle(
            0, popupSize.y / 8,
            0, popupSize.y * 3 / 8,
            popupSize.x / 10, popupSize.y / 4);
        } else {
          // ↻ DX
          rotate(-HALF_PI - QUARTER_PI)
          arc(0, 0, popupSize.x * 6.5 / 24, popupSize.y * 6.5 / 12, PI, PI + 3 * HALF_PI);
          rotate(0.15);
          fill(0);
          triangle(
            0, popupSize.y * 3 / 8,
            0, popupSize.y / 8,
            -popupSize.x / 10, popupSize.y / 4);
        }

        pop();
      }

      pop();
    };
  }

  getRotationPopup() { }
  getPopupClickFunc() { }
}

class Laser extends Piece {
  constructor(_player) {
    super("Laser", _player);
    this.canBeMoved = false;
  }
  reflect(dir) { return null; }
  show() {
    if (!this.cell) {
      throw new Error("No cell for this piece")
    }
    let size = this.cell.size;
    push();
    fill(...this.player.pColor);
    translate(this.cell.getCenter().x, this.cell.getCenter().y);
    rotate(this.rotObj[this.rot]);
    triangle(-size / 3, size / 3, size / 3, size / 3, 0, -size / 3);
    fill(0, 70);
    stroke(0)
    strokeWeight(1)
    arc(0, 2, 10, 20, 0, PI, CHORD)
    pop();
  }

  getRotationPopup() {
    return this.getSimpleRotationPopup();
  }

  getPopupClickFunc() {
    return () => {
      if (!this.popupBounds) {
        print("☠️ No popup bounds");
        return;
      }

      let c = { x: mouseX - offset.x, y: mouseY - offset.y };
      if (
        c.x >= this.popupBounds.x &&
        c.x <= this.popupBounds.x + this.popupBounds.w &&
        c.y >= this.popupBounds.y &&
        c.y <= this.popupBounds.y + this.popupBounds.h
      ) {
        const rotMap = { N: "W", W: "N", S: "E", E: "S" };
        this.rot = rotMap[this.rot];
        this.player.laserPos.rot = this.rot;
        return true;
      }
    };
  }
}

class Defender extends Piece {
  constructor(_player) {
    super("Defender", _player);
  }

  reflect(dir) {
    if (dirV[(dirV[dir] + 2 /*opposto*/) % 4] != this.rot) {
      this.board.destroyPiece(this);
    }
    return null;
  }

  show() {
    push()
    fill(...this.player.pColor)
    stroke(0)
    strokeWeight(1)
    translate(this.cell.getCenter().x, this.cell.getCenter().y)
    rotate(dirV[this.rot] * (PI / 2))
    arc(0, 0, this.cell.size / 1.5, this.cell.size / 1.5, -QUARTER_PI / 2, PI + QUARTER_PI / 2)
    stroke(...mirrorColor)
    strokeWeight(4)
    line(-this.cell.size / 4, -this.cell.size / 6, this.cell.size / 4, -this.cell.size / 6)
    line(-this.cell.size / 4, -this.cell.size / 6, -this.cell.size / 4, -this.cell.size / 3)
    line(this.cell.size / 4, -this.cell.size / 6, this.cell.size / 4, -this.cell.size / 3)
    line(0, 0, 0, -this.cell.size / 6)
    pop()
  }

  getRotationPopup() {
    return this.getDoubleRotationPopup();
  }

  getPopupClickFunc() {
    return () => {
      if (!this.popupBounds) {
        print("☠️ No popup bounds");
        return false;
      }
      let c = { x: mouseX - offset.x, y: mouseY - offset.y };
      if (
        c.x >= this.popupBounds.x &&
        c.x <= this.popupBounds.x + this.popupBounds.w &&
        c.y >= this.popupBounds.y &&
        c.y <= this.popupBounds.y + this.popupBounds.h
      ) {
        if (c.x <= this.popupBounds.x + this.popupBounds.w / 2) {
          this.rot = dirV[(dirV[this.rot] - 1 + 4) % 4]
        } else {
          this.rot = dirV[(dirV[this.rot] + 1 + 4) % 4]
        }
        return true;
      }
      return false;
    };
  }

}

class Deflector extends Piece { //rot NE SE SW NW
  constructor(_player) {
    super("Deflector", _player);
  }

  reflect(dir) {
    const reflectionMap = {
      NE: { S: "E", W: "N" },
      SW: { E: "S", N: "W" },
      NW: { S: "W", E: "N" },
      SE: { N: "E", W: "S" }
    };

    let ret = reflectionMap[this.rot][dir] || null;
    if (ret) return ret;
    this.board.destroyPiece(this);
    return ret;
  }

  show() {
    if (!this.cell || !this.board) return;

    push();

    const pos = this.cell.getCenter();
    const r = this.cell.size * 0.33;
    translate(pos.x, pos.y);
    rotate(HALF_PI * ["SE", "SW", "NW", "NE"].indexOf(this.rot))

    // Forma principale
    fill(...this.player.pColor);
    stroke(255, 100);
    strokeWeight(1);
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

    // Linee diagonali verdi
    stroke(...mirrorColor);
    strokeWeight(4);
    push();
    translate(-2, -2);
    line(-r * 0.5, +r / 2, +r * 0.5, -r / 2);
    line(-r * 0.5, +r / 2, -r * 0.5 + 3, +r / 2 + 3);
    line(+r * 0.5, -r / 2, +r * 0.5 + 3, -r / 2 + 3);
    pop();

    // Semicerchio nero trasparente
    push();
    translate(-3, -3);
    rotate(HALF_PI + QUARTER_PI);
    stroke(0);
    strokeWeight(1);
    fill(0, 50);
    arc(0, 0, 10, 15, 0, PI, CHORD);
    pop();

    pop();
  }


  getRotationPopup() {
    return this.getDoubleRotationPopup();
  }

  getPopupClickFunc() {
    let _dirV = {
      NE: 0,
      SE: 1,
      SW: 2,
      NW: 3,
      0: "NE",
      1: "SE",
      2: "SW",
      3: "NW",
    };
    return () => {
      if (!this.popupBounds) {
        print("☠️ No popup bounds");
        return false;
      }
      let c = { x: mouseX - offset.x, y: mouseY - offset.y };
      if (
        c.x >= this.popupBounds.x &&
        c.x <= this.popupBounds.x + this.popupBounds.w &&
        c.y >= this.popupBounds.y &&
        c.y <= this.popupBounds.y + this.popupBounds.h
      ) {
        if (c.x <= this.popupBounds.x + this.popupBounds.w / 2) {
          this.rot = _dirV[(_dirV[this.rot] - 1 + 4) % 4]
        } else {
          this.rot = _dirV[(_dirV[this.rot] + 1 + 4) % 4]
        }
        return true;
      }
      return false;
    };
  }
}

class Switch extends Piece {
  constructor(_player) {
    super("Switch", _player);
  }

  reflect(dir) {
    const isSlash = this.rot === "E" || this.rot === "W";

    const mirrorMap = isSlash
      ? {
        N: "E",
        W: "S",
        S: "W",
        E: "N",
      } // "/"
      : {
        N: "W",
        E: "S",
        S: "E",
        W: "N",
      }; // "\"

    return mirrorMap[dir];
  }

  show() {
    const isSlash = this.rot === "E" || this.rot === "W";
    const x = this.cell.x * this.cell.size;
    const y = this.cell.y * this.cell.size;
    const s = this.cell.size;

    push();

    // Sfondo trasparente
    noStroke();
    fill(255, 30);
    rect(x + 2, y + 2, s - 4, s - 4, 6);

    // Bordo sottile interno
    stroke(255, 50);
    strokeWeight(1);
    noFill();
    rect(x + s / 6, y + s / 6, s * 4 / 6, s * 4 / 6, 4);

    // Base diagonale
    push()
    translate(this.cell.getCenter().x, this.cell.getCenter().y);
    rotate(QUARTER_PI + (isSlash ? 1 : 0) * HALF_PI);
    rectMode(CENTER);
    fill(...this.player.pColor, 180);
    stroke(...this.player.pColor);
    rect(0, 0, s * 0.8, s * 0.2, 8)

    // Cerchio
    stroke(0)
    ellipse(0, 0, 20, 20)

    // Linea evidenziata interna sopra lo specchio
    stroke(...mirrorColor);
    strokeWeight(3);
    line(-s * 0.45, 0, s * 0.45, 0)
    pop()

    pop();
  }

  getRotationPopup() {
    return this.getSimpleRotationPopup({ x: 50, y: 50 });
  }

  getPopupClickFunc() {
    return () => {
      if (!this.popupBounds) {
        print("☠️ No popup bounds");
        return false;
      }
      let c = { x: mouseX - offset.x, y: mouseY - offset.y };
      if (
        c.x >= this.popupBounds.x &&
        c.x <= this.popupBounds.x + this.popupBounds.w &&
        c.y >= this.popupBounds.y &&
        c.y <= this.popupBounds.y + this.popupBounds.h
      ) {
        this.rot = (this.rot === "N" || this.rot === "S") ? "E" : "N";
        return true;
      }
      return false;
    };
  }

}

class King extends Piece {
  constructor(_player) {
    super("King", _player);
  }
  reflect(dir) {
    print(`Player ${this.player.name} loses!`);
  }
  show() {
    push();
    fill(...this.player.pColor);
    if (this.cell) {
      let pos = this.cell.getCenter();
      rectMode(CENTER);
      rect(pos.x, pos.y, this.cell.size * 0.5);
    }
    pop();
  }
}
