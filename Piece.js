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
    let board = this.cell.board;
    if (!board) throw new Error("no board");
    if (!!tg.piece) throw new Error("target cell already occupied");
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
      strokeWeight(3);
      arc(0, 0, popupSize.x * 6.5 / 12, popupSize.y * 6.5 / 12, PI / 2, TWO_PI);
      fill(0);
      rotate(-0.15);
      triangle(0, popupSize.y / 8, 0, popupSize.y * 3 / 8, popupSize.x / 5, popupSize.y / 4);
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
    if(!this.cell){
      throw new Error("No cell for this piece")
    }
    let size = this.cell.size;
    push();
    fill(this.player.pColor);
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
    return this.getSimpleRotationPopup({ x: 50, y: 50 });
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
    fill(this.player.pColor)
    stroke(0)
    strokeWeight(1)
    translate(this.cell.getCenter().x, this.cell.getCenter().y)
    rotate(dirV[this.rot] * (PI / 2))
    arc(0, 0, this.cell.size / 1.5, this.cell.size / 1.5, -QUARTER_PI / 2, PI + QUARTER_PI / 2)
    stroke(color(50, 230, 50))
    strokeWeight(4)
    line(-this.cell.size / 4, -this.cell.size / 6, this.cell.size / 4, -this.cell.size / 6)
    line(-this.cell.size / 4, -this.cell.size / 6, -this.cell.size / 4, -this.cell.size / 3)
    line(this.cell.size / 4, -this.cell.size / 6, this.cell.size / 4, -this.cell.size / 3)
    line(0, 0, 0, -this.cell.size / 6)
    pop()
  }

  getRotationPopup() {
    const popupSize = { x: 100, y: 50 };
    const corner = this.getPopupCorner(popupSize);

    const bounds = {
      x: corner.x,
      y: corner.y,
      w: popupSize.x,
      h: popupSize.y,
    };

    this.popupBounds = bounds;

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
      fill(color(200, 10, 10));
      triangle(
        corner.x + 10,
        corner.y + popupSize.y / 2,
        corner.x + popupSize.x / 2 - 10,
        corner.y + 10,
        corner.x + popupSize.x / 2 - 10,
        corner.y + popupSize.y - 10
      );
      triangle(
        corner.x + popupSize.x - 10,
        corner.y + popupSize.y / 2,
        corner.x + popupSize.x / 2 + 10,
        corner.y + 10,
        corner.x + popupSize.x / 2 + 10,
        corner.y + popupSize.y - 10
      );
      pop();
    };
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

class Deflector extends Piece {
  constructor(_player) {
    super("Deflector", _player);
  }
  reflect(dir) { }
  show() { }
  getRotationPopup() {
    const popupSize = { x: 100, y: 50 };
    const corner = this.getPopupCorner(popupSize);

    const bounds = {
      x: corner.x,
      y: corner.y,
      w: popupSize.x,
      h: popupSize.y,
    };

    this.popupBounds = bounds;

    // La funzione anonima restituita usa i valori precalcolati
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
      fill(color(200, 10, 10));
      triangle(
        corner.x + 10,
        corner.y + popupSize.y / 2,
        corner.x + popupSize.x / 2 - 10,
        corner.y + 10,
        corner.x + popupSize.x / 2 - 10,
        corner.y + popupSize.y - 10
      );
      triangle(
        corner.x + popupSize.x - 10,
        corner.y + popupSize.y / 2,
        corner.x + popupSize.x / 2 + 10,
        corner.y + 10,
        corner.x + popupSize.x / 2 + 10,
        corner.y + popupSize.y - 10
      );
      pop();
    };
  }
  getPopupClickFunc() { }
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
    push();
    stroke(this.player.pColor);
    strokeWeight(6);
    if (isSlash) {
      line(
        this.cell.x * this.cell.size + this.cell.size,
        this.cell.y * this.cell.size,
        this.cell.x * this.cell.size,
        this.cell.y * this.cell.size + this.cell.size
      );
    } else {
      line(
        this.cell.x * this.cell.size,
        this.cell.y * this.cell.size,
        this.cell.x * this.cell.size + this.cell.size,
        this.cell.y * this.cell.size + this.cell.size
      );
    }
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
    fill(this.player.pColor);
    if (this.cell) {
      let pos = this.cell.getCenter();
      rectMode(CENTER);
      rect(pos.x, pos.y, this.cell.size * 0.5);
    }
    pop();
  }
}
