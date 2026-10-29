// Tutorial: le lezioni di js/config/lessons.js giocate sulla board vera. Si gioca col blu e
// l'arancione non muove; dopo lo sparo la lezione è vinta se il raggio ha colpito il King
// arancione, altrimenti si spiega cosa è successo e si riprova.
// Il testo della lezione va nel riquadro dei suggerimenti (GameUI.coach), i comandi sotto.
class Tutorial {
  constructor(board, actions) {
    this.board = board;
    // { begin(): prepara la partita del tutorial, end(play): esce (play = partita contro il
    //   computer), myName(), relayout() }
    this.actions = actions;
    this.index = 0;
    this.state = "off"; // off | play | won | failed | finished
    this.message = ""; // esito dell'ultimo colpo, o aiuto
    this.ownLost = []; // pezzi blu eliminati dal colpo in corso
    const $ = (id) => document.getElementById(id);
    this.el = {
      box: $("lesson-actions"),
      hint: $("lesson-hint"),
      retry: $("lesson-retry"),
      next: $("lesson-next"),
      exit: $("lesson-exit"),
    };
    this.el.hint.addEventListener("click", () => this.hint());
    this.el.retry.addEventListener("click", () => this.load(this.index));
    this.el.next.addEventListener("click", () => this.next());
    this.el.exit.addEventListener("click", () => this.exit(false));
  }

  get active() {
    return this.state !== "off";
  }

  get lesson() {
    return LESSONS[this.index];
  }

  start() {
    this.actions.begin();
    this.load(0);
    this.el.box.hidden = false;
    this.actions.relayout();
  }

  load(index) {
    const b = this.board;
    this.index = index;
    this.state = "play";
    this.message = "";
    this.ownLost = [];
    b.setup("Tutorial", [this.actions.myName(), t("tut.orange")], [], this.lesson.pieces);
    b.localIndex = 0;
    b.opponentReady = true;
    b.start();
    this.render();
  }

  next() {
    if (this.state === "finished") this.exit(true);
    else if (this.index + 1 < LESSONS.length) this.load(this.index + 1);
    else {
      this.state = "finished";
      this.message = "";
      this.render();
    }
  }

  // Esce dal tutorial. play: subito una partita contro il computer
  exit(play) {
    this.stop();
    this.actions.end(play);
  }

  // Chiude il tutorial senza fare altro (es. è iniziata una partita nuova)
  stop() {
    if (!this.active) return;
    this.state = "off";
    this.board.hintCells = [];
    this.el.box.hidden = true;
    this.actions.relayout();
  }

  // Mostra la soluzione: il pezzo (e la casella) con un contorno che pulsa e cosa farci
  hint() {
    const b = this.board;
    if (this.state !== "play" || b.busy) return;
    if (b.phase === "fire") b.undoMove(); // l'aiuto vale dalla posizione iniziale della lezione
    const { at, to, rot } = this.lesson.hint;
    const cell = b.cellByName(at);
    b.hintCells = to ? [cell, b.cellByName(to)] : [cell];
    const piece = pieceName(cell.piece.type);
    if (to) {
      this.message = t("tut.hintMove", { piece });
    } else {
      const rots = cell.piece.rotations();
      const arrow = t(rots.length === 1 ? "tut.arrowSingle" : rots[0] === rot ? "tut.arrowCcw" : "tut.arrowCw");
      this.message = t("tut.hintRotate", { piece, arrow });
    }
    this.render();
  }

  onEvent(name, data) {
    if (this.state !== "play") return;
    if (name === "fire") this.ownLost = [];
    if (name === "destroy" && data.piece.player === this.board.players[0]) this.ownLost.push(data.piece);
    if (name === "move" || name === "rotate" || name === "undo") this.board.hintCells = [];
    if (name === "gameover" || name === "turn") this.judge();
  }

  // Il colpo è finito: lezione vinta o cosa è andato storto
  judge() {
    const b = this.board;
    const go = b.gameOver;
    b.hintCells = [];
    if (go && go.winner === b.players[0]) {
      this.state = "won";
      this.message = t(this.index + 1 < LESSONS.length ? "tut.won" : "tut.wonLast");
    } else {
      this.state = "failed";
      if (go && go.winner) this.message = t("tut.failOwnKing");
      else if (go) this.message = t("tut.failBoth");
      else if (this.ownLost.length) this.message = t("tut.failOwnPiece", { piece: pieceName(this.ownLost[0].type) });
      else this.message = t("tut.failMiss");
    }
    this.render();
  }

  status() {
    return this.state === "finished" ? t("tut.finishedStatus") : t("tut.status", { n: this.index + 1, total: LESSONS.length });
  }

  title() {
    return t(this.state === "finished" ? "tut.finishedTitle" : `lesson.${this.lesson.id}.title`);
  }

  // Testo per il riquadro dei suggerimenti (vedi GameUI.coach)
  coach() {
    const b = this.board;
    if (this.state === "finished") {
      return { step: 0, kind: "good", text: t("tut.finished") };
    }
    if (this.state === "won") return { step: 0, kind: "good", text: this.message };
    if (this.state === "failed") return { step: 0, kind: "danger", text: this.message };
    if (b.busy) return { step: 2, text: t("tut.flying") };
    const step = b.phase === "fire" ? 2 : 1;
    if (this.message) return { step, text: this.message };
    if (b.phase === "fire") return { step, text: t("tut.moved") };
    return { step, text: t(`lesson.${this.lesson.id}.text`) };
  }

  render() {
    const { el, state } = this;
    el.hint.hidden = state !== "play" && state !== "failed";
    el.retry.hidden = state !== "failed";
    el.next.hidden = state !== "won" && state !== "finished";
    el.next.textContent = t(state === "finished" ? "tut.playAi" : this.index + 1 < LESSONS.length ? "tut.next" : "tut.end");
    el.exit.textContent = t(state === "finished" ? "tut.more" : "tut.exit");
  }
}
