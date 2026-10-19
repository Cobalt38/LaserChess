class Player {
  constructor(name, pColor = [0, 0, 0]) {
    this.name = name;
    this.pColor = pColor;
    this.pieces = [];
    this.laser = null; // il pezzo Laser di questo giocatore
  }
}
