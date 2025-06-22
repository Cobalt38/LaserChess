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
    this.laserPaths = [];
    this.visited = null;
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
      cell.deny = false;
    }
    this.selected = null;
  }

  addPlayer(name, colorArray = [[50, 100, 150], [150, 100, 50]]) {
    if (this.players.length == 3) {
      print("Cannot add any more players to this board!");
      return null;
    }
    let player = new Player(
      name,
      colorArray[this.players.length - 1],
      this
    );
    this.players.push(player);
    const laserStartPositions = [
      { x: 10, y: 1, rot: "N" },
      { x: 1, y: 8, rot: "S" },
    ];
    let pos = laserStartPositions[this.players.length - 2];
    if (
      !!player &&
      this.addPiece(
        Laser,
        player,
        pos.x,
        pos.y,
        pos.rot
      )
    ) {
      if (this.players.length == 2) { //player1
        this.getCell(2, 1).playerExclusive = player;
        this.getCell(2, 8).playerExclusive = player;
        this.getCell(10, 2).playerExclusive = player;
        this.getCell(10, 3).playerExclusive = player;
        this.getCell(10, 4).playerExclusive = player;
        this.getCell(10, 5).playerExclusive = player;
        this.getCell(10, 6).playerExclusive = player;
        this.getCell(10, 7).playerExclusive = player;
        this.getCell(10, 8).playerExclusive = player;
      } else if (this.players.length == 3) { //player2
        this.getCell(1, 1).playerExclusive = player;
        this.getCell(1, 2).playerExclusive = player;
        this.getCell(1, 3).playerExclusive = player;
        this.getCell(1, 4).playerExclusive = player;
        this.getCell(1, 5).playerExclusive = player;
        this.getCell(1, 6).playerExclusive = player;
        this.getCell(1, 7).playerExclusive = player;
        this.getCell(9, 1).playerExclusive = player;
        this.getCell(9, 8).playerExclusive = player;
      }

      return player;
    } else {
      print("Error during addPlayer");
      return null;
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

  laser(startCell, dir) {
    this.laserPaths = [];
    this.visited = new Map();
    this.traceLaser(startCell, dir, []);
  }

  traceLaser(cell, dir, path) {
    if (!cell || !dir) return;

    const key = `${cell.rx},${cell.ry}`;

    if (!this.visited.has(key)) this.visited.set(key, new Set());
    const visitedSet = this.visited.get(key);
    if (visitedSet.has(dir)) return;
    visitedSet.add(dir);

    path.push(cell.getCenter());

    const { x: dx, y: dy } = this.dirObj[dir];
    const nextCell = this.getCell(cell.rx + dx, cell.ry + dy);

    if (!nextCell) {
      // Uscita fuori dal bordo → termina ramo
      path.push({
        x: cell.getCenter().x + dx * this.cellSize,
        y: cell.getCenter().y - dy * this.cellSize,
      });
      this.laserPaths.push([...path]);
      return;
    }

    path.push(nextCell.getCenter());

    if (nextCell.piece) {
      const result = nextCell.piece.reflect(dir);
      if (!result) {
        this.laserPaths.push([...path]);
        return;
      }
      const directions = Array.isArray(result) ? result : [result];
      for (let i = 0; i < directions.length; i++) {
        const dirOut = directions[i];
        // Ogni ramo ha la sua copia del path
        const nextPath = [...path]; // (i === directions.length - 1) ? path : [...path];
        this.traceLaser(nextCell, dirOut, nextPath);
      }
    } else {
      this.traceLaser(nextCell, dir, path);
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

  addPiece(PieceClass, player, x, y, rot) {
    const cell = this.getCell(x, y);
    if (!cell) throw new Error(`Invalid coordinates: ${x},${y}`);
    if (cell.isOccupied()) throw new Error(`Cell (${x},${y}) is occupied`);
    if (!["N", "E", "S", "W", "NW", "NE", "SW", "SE"].includes(rot))
      throw new Error("Invalid rotation");

    // ✔️ La classe è legit?
    if (typeof PieceClass !== "function")
      throw new Error("Invalid piece type: not a constructor");
    if (!(PieceClass.prototype instanceof Piece))
      throw new Error(`${PieceClass.name} must extend Piece`);

    // ✅ Istanzia piece
    const newPiece = new PieceClass(player);
    newPiece.cell = cell;
    newPiece.rot = rot;
    newPiece.board = this;

    cell.setPiece(newPiece);

    // 🔦 Laser tracking
    if (newPiece.type?.toLowerCase?.() === "laser") {
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
    let x = int((mouseX - offset.x) / this.cellSize);
    let y = int((mouseY - offset.y) / this.cellSize);
    return { x: x + 1, y: 8 - y };
  }

  worldToRelative(_x, _y, useOffset = false) {
    let x = useOffset ? int((_x - offset.x) / this.cellSize) : int(_x / this.cellSize);
    let y = useOffset ? int((_y - offset.y) / this.cellSize) : int(_y / this.cellSize);
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
      this.clearSelection()
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
      this.laserPaths = []
      toSelect.selectionRoutine();
    }
  }

  show() {
    this.cells.forEach(function (cell) {
      cell.show();
    });

    let laserWidth = { outer: 5, inner: 2 }
    let laserColor = { outer: [255, 50, 50], inner: [200, 200, 50] }
    //Laser
    for (let path of this.laserPaths) {
      push();
      //outer
      stroke(...laserColor.outer);
      strokeWeight(laserWidth.outer);
      noFill();
      beginShape();
      for (let coord of path) vertex(coord.x, coord.y);
      endShape();
      //inner
      stroke(...laserColor.inner);
      strokeWeight(laserWidth.inner);
      beginShape();
      for (let coord of path) vertex(coord.x, coord.y);
      endShape();
      pop();
    }

    //evita gomiti brutti dove il laser passa 2+ volte
    if (this.laserPaths.length > 0) {
      push();
      stroke(...laserColor.inner);
      strokeWeight(laserWidth.inner);
      for (let cell of this.cells) {
        // 🥬🥬🥬 TODO: rifattorizzare leggendo this.visited dove ci sono 3 o più dir e disegnando linee in tutte le direzioni trovate
        if (cell.piece && cell.piece instanceof Prism) { 
          // Usa worldToRelative per ottenere le coordinate relative della cella
          const rel = this.worldToRelative(cell.getCenter().x, cell.getCenter().y, false);
          const key = `${rel.x},${rel.y}`;
          // Controlla se la cella è stata visitata dal laser
          if (this.visited && this.visited.has(key)) {
            push();
            translate(cell.getCenter().x, cell.getCenter().y);
            line(-cell.size / 2, 0, cell.size / 2, 0);
            line(0, -cell.size / 2, 0, cell.size / 2);
            pop();
          }
        }
      }
      pop();
    }

    // Popup
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

  resetBoard() {
    this.clearSelection()
    // Clear all pieces from the board
    for (let cell of this.cells) {
      cell.piece = null;
      cell.highlight = false;
      cell.selected = false;
      cell.deny = false;
      cell.playerExclusive = null;
    }
    // Clear player pieces
    for (let player of this.players) {
      player.pieces = [];
      player.laserPos = null;
    }
    // Clear board pieces and laser paths
    this.pieces = [];
    this.laserPaths = [];
    this.visited = null;
    this.selected = null;
    this.waitingForPopup = false;
    this.popupDrawFunc = null;
    this.popupClickFunc = null;
    // Reset turn
    this.turn = 0;
    this.activePlayer = this.players[this.turn];
  }

  setupACE(name1 = "Player1", name2 = "Player2") {
    this.resetBoard();
    let p1 = this.addPlayer(name1) || this.players[1];
    let p2 = this.addPlayer(name2) || this.players[2];
    if (!(p1 && p2)) {
      print("Error during players creation")
      return;
    }
    //player1
    this.addPiece(Deflector, p1, 3, 1, "NW")
    this.addPiece(Defender, p1, 4, 1, "N")
    this.addPiece(King, p1, 5, 1, "NW")
    this.addPiece(Defender, p1, 6, 1, "N")
    this.addPiece(Deflector, p1, 8, 2, "NE")
    this.addPiece(Deflector, p1, 3, 4, "NW")
    this.addPiece(Switch, p1, 5, 4, "NW")
    this.addPiece(Switch, p1, 6, 4, "NE")
    this.addPiece(Deflector, p1, 10, 4, "SW")
    this.addPiece(Deflector, p1, 3, 5, "SW")
    this.addPiece(Deflector, p1, 10, 5, "NW")
    this.addPiece(Deflector, p1, 4, 6, "NW")

    //player2
    this.addPiece(Deflector, p2, 8, 8, "SE")
    this.addPiece(Defender, p2, 7, 8, "S")
    this.addPiece(King, p2, 6, 8, "S")
    this.addPiece(Defender, p2, 5, 8, "S")
    this.addPiece(Deflector, p2, 3, 7, "SW")
    this.addPiece(Deflector, p2, 1, 5, "NE")
    this.addPiece(Switch, p2, 5, 5, "SW")
    this.addPiece(Switch, p2, 6, 5, "SE")
    this.addPiece(Deflector, p2, 8, 5, "SE")
    this.addPiece(Deflector, p2, 1, 4, "SE")
    this.addPiece(Deflector, p2, 8, 4, "NE")
    this.addPiece(Deflector, p2, 7, 3, "SE")

    return [p1, p2];
  }

  setupCURIOSITY(name1 = "Player1", name2 = "Player2"){
    this.resetBoard();
    let p1 = this.addPlayer(name1) || this.players[1];
    let p2 = this.addPlayer(name2) || this.players[2];
    if (!(p1 && p2)) {
      print("Error during players creation")
      return;
    }
  }
}

function isInsideMap(cObj) {
  return cObj.x > 0 && cObj.y > 0 && cObj.x <= 10 && cObj.y <= 8;
}
