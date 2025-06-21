class Player {
  constructor(name, pColor = [0,0,0], board){
    this.name = name;
    this.pColor = pColor;
    this.pieces = [];
    this.board = board;
    this.laserPos = null;
  }
}