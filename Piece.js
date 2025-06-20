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
    return () => {
      push();
      let corner, dir;
      let popupSize = { x: 150, y: 100 };
      let cellPos = {
        x: this.cell.x * this.cell.size,
        y: this.cell.y * this.cell.size,
      };
      let cellSize = this.cell.size;
      if (cellPos.x <= width / 2) {
        if (cellPos.y <= height / 2) {
          //quadrante NW
          corner = {
            x: cellPos.x + cellSize / 2,
            y: cellPos.y + cellSize / 2
          };
        } else {
          //quadrante SW
          corner = {
            x: cellPos.x + cellSize / 2,
            y: cellPos.y - popupSize.y / 2,
          };
        }
      } else {
        if (cellPos.y <= height / 2) {
          // Quadrante NE
          corner = {
            x: cellPos.x - popupSize.x - cellSize / 2,
            y: cellPos.y + cellSize / 2,
          };
        } else {
          // Quadrante SE
          corner = {
            x: cellPos.x - popupSize.x - cellSize / 2,
            y: cellPos.y - popupSize.y - cellSize / 2,
          };
        }
      }
      rect(corner.x, corner.y, corner.x + popupSize.x, corner.y + popupSize.y);
      pop();
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
