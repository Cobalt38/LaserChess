class Cell {
  constructor(i, cellSize) {
    this.x = i % 10; //colonna
    this.y = int(i / 10); //riga
    this.i = i;
    this.size = cellSize;
    this.fillColor = color(0, 0, 0);
    this.selected = false;
    this.highlight = false;
    this.board = null;
    this.rx = this.x + 1;
    this.ry = 8 - this.y;
    this.laserTg = null; //target laser
    this.playerExclusive = null; //only this player can move here
    this.deny = false; //shows that moving here is forbidden (X)
  }

  selectionRoutine() {
    if (!this.board) {
      print("Cell has no board registered, weird", this);
      return false;
    }
    this.selected = true;
    if (!this.piece) return;
    if (this.piece.canBeMoved) {
      for (let cell of this.board.kernel(this.rx, this.ry)) {
        if (!cell.piece || cell == this)
          cell.highlight = true;
        if (this.piece.type.toLowerCase() == "switch" && cell.piece && ["defender", "deflector"].includes(cell.piece.type.toLowerCase()))
          cell.highlight = true;
        if (cell != this && cell.playerExclusive && cell.playerExclusive != this.board.activePlayer) {
          cell.deny = true;
          cell.highlight = false;
        }
      }
      if (this.piece.type.toLowerCase() == "king") this.highlight = false;
    } else {
      this.highlight = true;
    }
    this.piece.selectionRoutine();
  }

  setPiece(piece) {
    this.piece = piece;
  }

  isOccupied() {
    return !!this.piece;
  }

  getCenter() {
    return {
      x: this.x * this.size + this.size / 2,
      y: this.y * this.size + this.size / 2,
    };
  }

  show() {
    push();
    stroke(255);
    strokeWeight(0.25);

    fill(this.fillColor);
    rect(this.x * this.size, this.y * this.size, this.size, this.size);
    if (this.playerExclusive) {
      push()
      fill(...this.playerExclusive.pColor, 70)
      rectMode(CENTER)
      rect(this.getCenter().x, this.getCenter().y, this.size * 0.9, this.size * 0.9, 1);
      pop()
    }
    if (this.selected) {
      push();
      let strok = 5;
      rectMode(CENTER);
      stroke(150, 150, 20);
      strokeWeight(strok);
      noFill();
      rect(
        this.getCenter().x,
        this.getCenter().y,
        this.size - strok,
        this.size - strok
      );
      pop();
    }
    if (this.deny) {
      push()
      let strok = 5;
      let r = this.size * 0.6;
      stroke(240, 40, 60, 180);
      strokeWeight(strok);
      noFill()
      translate(this.getCenter().x, this.getCenter().y)
      ellipse(0, 0, r, r)
      rotate(-QUARTER_PI)
      strokeCap(PROJECT);
      line(-r / 2 + strok, 0, r / 2 - strok, 0)
      pop();
    }
    textAlign(CENTER, CENTER);
    fill(255);
    strokeWeight(0);
    // text(
    //   this.i,
    //   this.x * this.size + this.size / 2,
    //   this.y * this.size + this.size / 2
    // );
    if (this.highlight) {
      rectMode(CORNER);
      fill("rgba(200, 200, 50, 0.2)");
      rect(this.x * this.size, this.y * this.size, this.size, this.size);
    }
    if (this.piece) {
      this.piece.show();
    }
    pop();
  }
}
