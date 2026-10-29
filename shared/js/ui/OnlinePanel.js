// Finestra "Gioca online": nome, generatore del link d'invito, ingresso con codice o link,
// stato della connessione. La logica di rete è in js/net/Online.js.
class OnlinePanel {
  constructor(online, actions) {
    this.online = online;
    this.actions = actions; // { settings, saveSettings(), myName(), onEvent(nome), toast(testo) }
    const $ = (id) => document.getElementById(id);
    this.el = {
      dialog: $("dlg-online"),
      openBtn: $("btn-online"),
      nameForm: $("my-name-form"),
      name: $("my-name"),
      nameSave: $("my-name-save"),
      start: $("online-start"),
      hostBtn: $("btn-host"),
      joinForm: $("join-form"),
      joinCode: $("join-code"),
      room: $("online-room"),
      link: $("invite-link"),
      code: $("room-code"),
      copyBtn: $("btn-copy"),
      shareBtn: $("btn-share"),
      msg: $("online-msg"),
      reconnectBtn: $("btn-reconnect"),
      leaveBtn: $("btn-leave"),
    };
    this.lastState = online.state;
    this.invited = false; // aperto da un link d'invito

    const { el } = this;
    el.name.value = actions.settings.myName;
    // Il nome vale quando si preme Salva o Invio, o si esce dal campo (non a ogni lettera)
    el.nameForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveName(true);
    });
    el.name.addEventListener("change", () => this.saveName(false));
    el.hostBtn.addEventListener("click", () => {
      this.saveName(false);
      this.invited = false;
      online.host();
    });
    el.joinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.saveName(false);
      online.join(el.joinCode.value);
    });
    el.copyBtn.addEventListener("click", () => this.copyLink());
    el.shareBtn.hidden = !Platform.canShare();
    el.shareBtn.addEventListener("click", () => {
      Platform.share({ title: "Laser Chess", text: "Ti sfido a Laser Chess!", url: online.inviteLink });
    });
    el.link.addEventListener("focus", () => el.link.select());
    el.reconnectBtn.addEventListener("click", () => online.retryNow());
    el.leaveBtn.addEventListener("click", async () => {
      if (online.connected && !(await actions.ask("Uscire dalla partita online?", "L'altro giocatore resterà da solo.", "Esci", "Resta"))) return;
      online.leave();
      // Il link d'invito non serve più: lo tolgo dall'indirizzo, così ricaricando non si rientra
      history.replaceState(null, "", location.href.split(/[?#]/)[0]);
    });
    this.render();
  }

  saveName(feedback) {
    const { settings } = this.actions;
    const name = this.el.name.value.trim();
    const o = this.online;
    if (name && o.opponentName && sameName(name, o.opponentName)) {
      this.actions.toast(`${o.opponentName} si chiama già così: scegli un nome diverso.`);
      this.el.name.value = settings.myName;
      return;
    }
    const changed = settings.myName !== name;
    settings.myName = name;
    this.actions.saveSettings();
    if (changed) o.rename(this.actions.myName());
    if (feedback) {
      this.el.nameSave.textContent = "Salvato ✓";
      clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => (this.el.nameSave.textContent = "Salva"), 1500);
    }
  }

  // La pagina è stata aperta da un link d'invito: si propone di entrare
  openInvite(code) {
    this.invited = true;
    this.el.joinCode.value = code;
    this.render();
    this.el.dialog.showModal();
    (this.actions.settings.myName ? this.el.joinForm.querySelector("button") : this.el.name).focus();
  }

  copyLink() {
    const { link, copyBtn } = this.el;
    const done = () => {
      copyBtn.textContent = "Copiato!";
      setTimeout(() => (copyBtn.textContent = "Copia link"), 1500);
    };
    Platform.copy(link.value).then((ok) => {
      if (ok) {
        done();
        return;
      }
      link.select(); // senza permessi per gli appunti: il link resta selezionato da copiare a mano
      try {
        if (document.execCommand("copy")) done();
      } catch (e) {
        // niente: il link è selezionato
      }
    });
  }

  message() {
    const o = this.online;
    const who = o.opponentName || "L'avversario";
    switch (o.state) {
      case "error":
        return { text: o.error, error: true };
      case "creating":
        return { text: "Creo la partita…" };
      case "hosting":
        return { text: "In attesa che il tuo amico apra il link…" };
      case "joining":
        return { text: o.attempt > 0 ? `Mi collego alla partita ${o.code}… (tentativo ${o.attempt + 1})` : `Mi collego alla partita ${o.code}…` };
      case "connected":
        return { text: `🟢 Collegato con ${who}. Giochi con ${o.role === "host" ? "il blu" : "l'arancione"}.` };
      case "lost":
        return o.role === "host"
          ? { text: `🟠 ${who} si è disconnesso. La partita resta qui: può rientrare riaprendo lo stesso link.` }
          : { text: "🟠 Connessione persa: mi ricollego da solo, non serve ricaricare la pagina." };
      default:
        return this.invited
          ? { text: "Ti hanno invitato a una partita: scegli il tuo nome e premi Entra." }
          : { text: "" };
    }
  }

  render() {
    const o = this.online;
    const { el } = this;
    const s = o.state;

    el.start.hidden = o.active;
    el.room.hidden = !(o.role === "host" && (s === "hosting" || s === "lost"));
    if (o.code) {
      el.link.value = o.inviteLink;
      el.code.textContent = o.code;
    }
    const { text, error } = this.message();
    el.msg.textContent = text;
    el.msg.hidden = !text;
    el.msg.classList.toggle("error", !!error);
    el.reconnectBtn.hidden = !(o.role === "guest" && (s === "lost" || (s === "joining" && o.attempt > 0)));
    el.leaveBtn.hidden = !o.active;
    el.leaveBtn.textContent = s === "hosting" || s === "creating" ? "Annulla" : "Esci dalla partita online";

    const [ico, label] = {
      creating: ["🟡", "Creo…"],
      hosting: ["🟡", "In attesa"],
      joining: ["🟡", "Collego…"],
      connected: ["🟢", "Online"],
      lost: ["🟠", "Riconnetto"],
    }[s] || ["🌐", "Online"];
    el.openBtn.querySelector(".ico").textContent = ico;
    el.openBtn.querySelector(".label").textContent = label;

    // Appena collegati la finestra si chiude da sola: si gioca
    if (s === "connected" && this.lastState !== "connected") {
      if (el.dialog.open) el.dialog.close();
      this.invited = false;
      this.actions.onEvent("peerJoined");
    }
    if (s === "lost" && this.lastState === "connected") this.actions.onEvent("peerLeft");
    this.lastState = s;
  }
}
