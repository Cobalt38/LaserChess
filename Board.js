class Board {
  constructor() {
    this.cells = [];
    this.cellSize = 50;
    this.width = 10 * this.cellSize;
    this.height = 8 * this.cellSize;
    for (let i = 0; i < 10 * 8; i++) {
      const cell = new Cell(i, this.cellSize);
      cell.board = this;
      this.cells.push(cell);
    }
    this.players = [];
    this.players.push(new Player("Default", color(0, 0, 0), this));
    this.turn = 0;
    this.activePlayer = this.players[this.turn];
    this.selected = null;
    this.pieces = [];
    this.dirObj = {
      N: { x: 0, y: 1 },
      E: { x: 1, y: 0 },
      S: { x: 0, y: -1 },
      W: { x: -1, y: 0 },
    };
    this.waitingForPopup = false;
    this.popupDrawFunc = null;
    this.popupClickFunc = null; //bool function() -> true = ha cliccato sul popup
    this.laserArray = [];
  }

  destroyPiece(piece) {
    piece.cell.piece = null;
    let index = piece.player.pieces.indexOf(piece);
    if (index !== -1) {
      piece.player.pieces.splice(index, 1);
    }
    index = this.pieces.indexOf(piece);
    if (index !== -1) {
      this.pieces.splice(index, 1);
    }
    piece = null;
  }

  clearSelection() {
    for (let cell of this.cells) {
      cell.highlight = false;
      cell.selected = false;
    }
    this.selected = null;
  }

  addPlayer(name) {
    if (this.players.length == 3) {
      print("Cannot add any more players to this board!");
      return null;
    }
    let player = new Player(
      name,
      [[50, 100, 150], [150, 100, 50]][this.players.length - 1],
      this
    );
    this.players.push(player);
    const startPositions = [
      { x: 10, y: 1, rot: "N" },
      { x: 1, y: 8, rot: "S" },
    ];
    let pos = startPositions[this.players.length - 2];
    if (
      !!player &&
      this.addPiece(
        "Laser",
        player,
        pos.x,
        pos.y,
        pos.rot
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
    if (this.turn > pNum) { //solo in caso di errori strani
      this.turn = 0;
    } else {//normale comportamento
      this.turn++;
      this.turn %= pNum;
      if (pNum > 0 && this.turn == 0) {
        this.turn++;
      }
    }
    this.activePlayer = this.players[this.turn];
    return this.activePlayer;
  }

  laser(cell, dir, visited = {}) {
    if (!cell || !dir) return;
    const key = `${cell.rx},${cell.ry}`;
    visited[key] = (visited[key] || 0) + 1;
    if (visited[key] > 2) return; //il laser può incrociare se stesso massimo una volta per casella (vert + hor)

    this.laserArray.push(cell.getCenter())
    const { x: dx, y: dy } = this.dirObj[dir];
    let target = this.getCell(cell.rx + dx, cell.ry + dy);
    if (!target) {
      this.laserArray.push({
        x: cell.getCenter().x + dx * this.cellSize,
        y: cell.getCenter().y - dy * this.cellSize
      })
      return;
    }

    this.laserArray.push(target.getCenter())

    if (target.piece) {
      const newDir = target.piece.reflect(dir);
      if (newDir)
        this.laser(target, newDir, visited);
    } else {
      this.laser(target, dir, visited);
    }
  }

  fireLaser() {
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
    if (!["N", "E", "S", "W", "NW", "NE", "SW", "SE"].includes(rot))
      throw new Error("Nice rot lul");

    const newPiece = (() => {
      const types = { king: King, switch: Switch, laser: Laser, defender: Defender, deflector: Deflector };
      const PieceClass = types[type.toLowerCase()];
      if (!PieceClass) throw new Error(`❌ Unknown piece type: ${type}`);
      let ret = new PieceClass(player);
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
    newPiece.board = this;
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
    let x = int((mouseX - offset.x) / this.cellSize);
    let y = int((mouseY - offset.y) / this.cellSize);
    return { x: x + 1, y: 8 - y };
  }

  mouseSelect() {
    if (this.waitingForPopup) {
      let c = { x: mouseX - offset.x, y: mouseY - offset.y };
      if (this.popupClickFunc) {
        let popupClick = this.popupClickFunc(c);
        this.waitingForPopup = false;
        this.popupDrawFunc = null;
        this.clearSelection();
        if (popupClick) this.fireLaser();
      } else {
        print("☠️ No popup click function defined");
        this.waitingForPopup = false;
        this.popupDrawFunc = null;
        this.clearSelection();
        return;
      }
    } else {
      let coord = this.pointedCoordinates();
      if (isInsideMap(coord)) this.selectCell(coord.x, coord.y);
    }
  }

  handleRightClick() {
    if (!this.selected) return;
    if (this.waitingForPopup) return;

    let c = this.pointedCoordinates();
    if (isInsideMap(c)) {
      let target = this.getCell(c.x, c.y);
      let piece = this.getSelectedCell().piece;
      if (target === this.getSelectedCell()) {
        //Stessa casella
        if (!this.getSelectedCell().highlight) { //King cant rotate!
          return;
        }

        //Gestisci popup
        this.popupDrawFunc =
          piece.getRotationPopup();
        if (!this.popupDrawFunc) print(`Warning: no popupDrawFunc defined for ${piece.type} class`)

        this.popupClickFunc =
          piece.getPopupClickFunc();
        if (!this.popupClickFunc) print(`Warning: no popupClickFunc defined for ${piece.type} class`)

        if (this.popupClickFunc && this.popupDrawFunc)
          this.waitingForPopup = true;
        return;
      } else {
        //Altra casella
        if (target.highlight) {
          piece.move(target);
        } else return;
      }

      this.clearSelection();

      this.fireLaser();
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
      this.laserArray = []
      toSelect.selectionRoutine();
    }
  }

  show() {
    this.cells.forEach(function (cell) {
      cell.show();
    });
    //Laser
    push()
    stroke(255, 50, 50);
    strokeWeight(5);
    noFill()
    beginShape()
    for (let coord of this.laserArray) {
      vertex(coord.x, coord.y)
    }
    endShape()
    stroke(200, 200, 50);
    strokeWeight(2);
    beginShape()
    for (let coord of this.laserArray) {
      vertex(coord.x, coord.y)
    }
    endShape()
    pop()
    //Popup
    if (this.popupDrawFunc) {
      this.popupDrawFunc();
    }
    // Turn
    push();

    let label = "Turno di " + this.activePlayer.name;
    let textS = 24;
    let spacing = 10;
    let circleSize = 20;

    let paddingX = 10;
    let paddingY = 5;
    let marginY = 4;

    textSize(textS);
    textAlign(LEFT, CENTER);
    let textW = textWidth(label);
    let totalWidth = textW + spacing + circleSize;
    let centerX = this.width / 2 - totalWidth / 2;
    let centerY = -textS / 2 - paddingY - marginY;

    // Rettangolo di sfondo
    fill(50, 50, 50, 180);
    noStroke();
    rect(centerX - paddingX, centerY - textS / 2 - paddingY, totalWidth + paddingX * 2, textS + paddingY * 2, 6);

    // Testo
    fill("#fffaf0");
    text(label, centerX, centerY);

    // Cerchio accanto al testo
    fill(...this.activePlayer.pColor);
    stroke(0)
    ellipse(centerX + textW + spacing + circleSize / 2, centerY, circleSize, circleSize);

    pop();

  }
}

function isInsideMap(cObj) {
  return cObj.x > 0 && cObj.y > 0 && cObj.x <= 10 && cObj.y <= 8;
}
