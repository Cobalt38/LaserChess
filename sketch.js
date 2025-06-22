let board;
let player1, player2;
let offset = { x: 100, y: 100 };
function setup() {
  let canvas = createCanvas(800, 800);
  canvas.elt.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    mouseClicked({ button: 2 });
  });
  strokeJoin(ROUND);
  board = new Board();
  [player1, player2] = board.setupACE("Mario", "Luigi");
  board.addPiece(Prism, player1, 9,7,"S")
  board.addPiece(Prism, player2, 2,2,"S")
  board.start();
}

function draw() {
  translate(offset.x, offset.y);
  background(color(10, 10, 10));
  board.show();
}

function mouseClicked(event) {
  if (mouseButton === "left") board.mouseSelect();
  else if (mouseButton === "right") board.handleRightClick();
}
