class Board {
  constructor() {
    this.cells = [];
    this.cellSize = 50;
    for (let i = 0; i < 10 * 8; i++) {
      this.cells.push(new Cell(i, this.cellSize));
    }
    for (let cell of this.cells) {
      cell.board = this;
    }
    this.players = [];
    this.players.push(new Player("Default", color(0, 0, 0), this));
    this.turn = 0;
    this.activePlayer = this.players[this.turn];
    this.selected = null;
    this.pieces = [];
    this.dirObj = {
      N: { x: 0, y: 1 },
      E: { x: -1, y: 0 },
      S: { x: 0, y: -1 },
      W: { x: 1, y: 0 },
    };
    this.waitingForPopup = false;
    this.popupFunc = null;
  }

  addPlayer(name) {
    if (this.players.length == 3) {
      print("Cannot add any more players to this board!");
      return null;
    }
    let player = new Player(
      name,
      [color(50, 100, 150), color(150, 100, 50)][this.players.length - 1],
      this
    );
    this.players.push(player);
    let index = this.players.length - 2;
    if (
      !!player &&
      this.addPiece(
        "Laser",
        player,
        [10, 1][index],
        [1, 8][index],
        ["N", "S"][index]
      )
    ) {
      return player;
    } else {
      print("Error during addPlayer");
    }
  }

  start() {
    if (this.turn == 0) {
      this.endTurn();
    }
  }

  endTurn() {
    let pNum = this.players.length;
    if (this.turn > pNum) {
      this.turn = 0;
    } else {
      this.turn++;
      this.turn %= pNum;
      if (pNum > 0 && this.turn == 0) {
        this.turn++;
      }
    }
    this.activePlayer = this.players[this.turn];
    return this.activePlayer;
  }

  laser(cell, dir) {
    if (!cell || !dir) return;

    const { x: dx, y: dy } = this.dirObj[dir];
    const target = this.getCell(cell.rx + dx, cell.ry + dy);
    if (!target) return;

    cell.laserTg = target;

    if (target.piece) {
      const newDir = target.piece.reflect(dir);
      this.laser(target, newDir);
    } else {
      this.laser(target, dir);
    }
  }

  addPiece(type, player, x, y, rot) {
    let cell;
    try {
      cell = this.getCell(x, y);
    } catch {
      print("Error during cell fetch: ${x},${y}");
      return;
    }

    if (cell.isOccupied()) 
      throw new Error("Cell (${x},${y}) is occupied");
    if (!["N", "E", "S", "W"].includes(rot)) 
      throw new Error("nice rot");

    const newPiece = (() => {
      const types = { king: King, switch: Switch, laser: Laser };
      const Piece = types[type.toLowerCase()];
      if (!Piece) {
        console.log("No piece of type:", type);
        return null;
      }
      let ret = new Piece(player);
      cell.setPiece(ret);
      ret.cell = cell;
      ret.rot = rot;
      return ret;
    })();
    if (type.toLowerCase() == "laser") {
      player.laserPos = {
        pos: { x: cell.rx, y: cell.ry },
        rot: rot,
      };
    }
    this.pieces.push(newPiece);
    player.pieces.push(newPiece);
    return newPiece;
  }

  kernel(x, y) {
    let ret = [];
    for (let j = x - 1; j <= x + 1; j++) {
      for (let k = y - 1; k <= y + 1; k++) {
        let c = this.getCell(j, k);
        if (!!c) {
          ret.push(c);
        }
      }
    }
    return ret;
  }

  getSelectedCell() {
    return this.getCell(...Object.values(this.selected));
  }

  getCell(x, y) {
    //colonna, riga
    if (isInsideMap({ x: x, y: y })) {
      return this.cells[(8 - y) * 10 + x - 1];
    }
    return null;
  }

  pointedCoordinates() {
    let x = int(mouseX / this.cellSize);
    let y = int(mouseY / this.cellSize);
    return { x: x + 1, y: 8 - y };
  }

  mouseSelect() {
    if (this.waitingForPopup) {
      //vedi se ha cliccato su una delle direzioni di rot
      //se sì, ruota il pezzo
      //se no, disattiva il popup
    } else {
      let coord = this.pointedCoordinates();
      if (isInsideMap(coord)) this.selectCell(coord.x, coord.y);
    }
  }

  handleRightClick() {
    if (!this.selected) return;

    let c = this.pointedCoordinates();
    if (isInsideMap(c)) {
      let target = this.getCell(c.x, c.y);

      if (target === this.getSelectedCell()) {
        //Stessa casella
        if (!this.getSelectedCell().highlight) {
          print("Error, cell was not selected");
          return;
        }
        //Gestisci popup
        let popupFunc =
            this.getSelectedCell().piece.getRotationPopup();
        this.waitingForPopup = true;
        return;
      } else {
        //Altra casella
        if (target.highlight) {
          let piece = this.getSelectedCell().piece;
          piece.move(target);
        } else return;
      }

      for (let cell of this.cells) {
        cell.highlight = false;
        cell.selected = false;
      }
      this.selected = null;

      //FIRE LASER
      if (
        this.activePlayer.name != "Default" &&
        this.activePlayer.laserPos != null
      ) {
        let laserPos = this.activePlayer.laserPos;
        let laserCell = this.getCell(laserPos.pos.x, laserPos.pos.y);
        this.laser(laserCell, laserPos.rot);
        this.endTurn();
      }
    }
  }

  selectCell(x, y) {
    if (!!this.selected) {
      this.getCell(this.selected.x, this.selected.y).selected = false;
    }
    let toSelect = this.getCell(x, y);
    if (toSelect) {
      if (toSelect.piece && toSelect.piece.player != this.activePlayer) {
        print("🔴 This piece is not yours!");
        return;
      }
      this.selected = { x: x, y: y };
      for (var cell of this.cells) {
        cell.highlight = false;
      }
      for (let cell of this.cells) {
        cell.laserTg = null;
      }
      toSelect.selectionRoutine();
    }
  }

  show() {
    this.cells.forEach(function (cell) {
      cell.show();
    });
    for (let cell of this.cells) {
      //laser
      if (cell.laserTg) {
        let { x: x1, y: y1 } = cell.getCenter();
        let { x: x2, y: y2 } = cell.laserTg.getCenter();
        stroke(255, 50, 50);
        strokeWeight(5);
        line(x1, y1, x2, y2);
        stroke(50, 150, 50);
        strokeWeight(2);
        line(x1, y1, x2, y2);
      }
    }
    if(this.popupFunc){
      this.popupFunc();
    }
  }
}

function isInsideMap(cObj) {
  return cObj.x > 0 && cObj.y > 0 && cObj.x <= 10 && cObj.y <= 8;
}
