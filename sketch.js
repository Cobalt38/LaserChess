let board;
let player1, player2;
let piece1;
function setup() {
  let canvas = createCanvas(800, 800);
  canvas.elt.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    mouseClicked({ button: 2 });
  });
  board = new Board();
  player1 = board.addPlayer("Mario");
  player2 = board.addPlayer("Luigi");
  board.addPiece("king", player1, 6, 1, "N");
  board.addPiece("king", player2, 5, 8, "S");
  board.addPiece("switch", player1, 10, 5, "W");
  board.addPiece("switch", player1, 2, 2, "N");
  board.addPiece("switch", player1, 8, 5, "S");
  board.addPiece("defender", player2, 5, 6, "W")
  //board.laser(board.getCell(8,1), "N");
  board.start();
}

function draw() {
  background(50);
  board.show();
}

function keyPressed(event) { }

function mouseClicked(event) {
  if (mouseButton === "left") board.mouseSelect();
  else if (mouseButton === "right") board.handleRightClick();
}
