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
  }

  selectionRoutine() {
    if(!this.board){
      print("Cell has no board registered", this);
      return false;
    }
    this.selected = true;
    if (!!this.piece) {
      if(this.piece.canBeMoved){
        for (let cell of this.board.kernel(this.rx, this.ry)) {
          if(!cell.piece || cell == this)
            cell.highlight = true;
        }
        if(this.piece.type.toLowerCase() == "king") this.highlight = false;
      } else {
        this.highlight = true;
      }
      this.piece.selectionRoutine();
    }
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
      fill("rgba(150, 150, 50, 0.2)");
      rect(this.x * this.size, this.y * this.size, this.size, this.size);
    }
    if (this.piece) {
      this.piece.show();
    }
    pop();
  }
}
