class Player {
  constructor(name, pColor, board){
    this.name = name;
    this.pColor = pColor;
    this.pieces = [];
    this.board = board;
    this.laserPos = null;
  }
}