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

  getRotationPopup() { }
  getPopupClickFunc() { }
}

class Laser extends Piece {
  constructor(_player) {
    super("Laser", _player);
    this.canBeMoved = false;
  }
  reflect(dir) { }
  show() {
    let size = this.cell.size;
    push();
    fill(this.player.pColor);
    translate(this.cell.getCenter().x, this.cell.getCenter().y);
    rotate(this.rotObj[this.rot]);
    triangle(-size / 3, size / 3, size / 3, size / 3, 0, -size / 3);
    pop();
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
        N: "W",
        W: "N",
        S: "E",
        E: "S",
      } // "/"
      : {
        N: "E",
        E: "N",
        S: "W",
        W: "S",
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
    let popupSize = { x: 100, y: 50 };
    let cellPos = {
      x: this.cell.x * this.cell.size,
      y: this.cell.y * this.cell.size,
    };
    let cellSize = this.cell.size;
    let w = this.board.width;
    let h = this.board.height;

    let corner;
    if (cellPos.x <= w / 2) {
      if (cellPos.y <= h / 2) {
        corner = { x: cellPos.x + cellSize / 2, y: cellPos.y + cellSize / 2 };
      } else {
        corner = { x: cellPos.x + cellSize / 2, y: cellPos.y - popupSize.y / 2 };
      }
    } else {
      if (cellPos.y <= h / 2) {
        corner = {
          x: cellPos.x - popupSize.x + cellSize / 2,
          y: cellPos.y + cellSize / 2,
        };
      } else {
        corner = {
          x: cellPos.x - popupSize.x + cellSize / 2,
          y: cellPos.y - popupSize.y + cellSize / 2,
        };
      }
    }

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


  getPopupClickFunc() {
    return () => {
      if (!this.popupBounds) {
        print("☠️ No popup bounds");
        return;
      }
      let c = { x: mouseX, y: mouseY };
      if (
        c.x >= this.popupBounds.x &&
        c.x <= this.popupBounds.x + this.popupBounds.w &&
        c.y >= this.popupBounds.y &&
        c.y <= this.popupBounds.y + this.popupBounds.h
      ) {
        this.rot = (this.rot === "N" || this.rot === "S") ? "E" : "N";
        return true;
      }
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
