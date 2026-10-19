// Finestra "Gioca online": nome, generatore del link d'invito, ingresso con codice o link,
// stato della connessione. La logica di rete è in js/net/Online.js.
class OnlinePanel {
  constructor(online, actions) {
    this.online = online;
    this.actions = actions; // { settings, saveSettings(), myName(), onEvent(nome) }
    const $ = (id) => document.getElementById(id);
    this.el = {
      dialog: $("dlg-online"),
      openBtn: $("btn-online"),
      name: $("my-name"),
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
    el.name.addEventListener("input", () => {
      actions.settings.myName = el.name.value;
      actions.saveSettings();
      online.rename(actions.myName());
    });
    el.hostBtn.addEventListener("click", () => {
      this.invited = false;
      online.host();
    });
    el.joinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      online.join(el.joinCode.value);
    });
    el.copyBtn.addEventListener("click", () => this.copyLink());
    el.shareBtn.hidden = !navigator.share;
    el.shareBtn.addEventListener("click", () => {
      navigator.share({ title: "Laser Chess", text: "Ti sfido a Laser Chess!", url: online.inviteLink }).catch(() => { });
    });
    el.link.addEventListener("focus", () => el.link.select());
    el.reconnectBtn.addEventListener("click", () => online.reconnect());
    el.leaveBtn.addEventListener("click", () => {
      if (online.connected && !confirm("Uscire dalla partita online?")) return;
      online.leave();
      // Il link d'invito non serve più: lo tolgo dall'indirizzo, così ricaricando non si rientra
      history.replaceState(null, "", location.href.split(/[?#]/)[0]);
    });
    this.render();
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
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link.value).then(done, () => link.select());
    } else {
      link.select(); // senza permessi per gli appunti: il link resta selezionato da copiare a mano
      try {
        if (document.execCommand("copy")) done();
      } catch (e) {
        // niente: il link è selezionato
      }
    }
  }

  message() {
    const o = this.online;
    const who = o.opponentName || "L'avversario";
    switch (o.state) {
      case "error":
        return { text: o.error, error: true };
      case "hosting":
        return { text: "In attesa che il tuo amico apra il link…" };
      case "joining":
        return { text: `Mi collego alla partita ${o.code}…` };
      case "connected":
        return { text: `🟢 Collegato con ${who}. Giochi con ${o.role === "host" ? "il blu" : "l'arancione"}.` };
      case "lost":
        return o.role === "host"
          ? { text: `🟠 ${who} si è disconnesso: può rientrare riaprendo lo stesso link.` }
          : { text: "🟠 Connessione persa." };
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
    el.room.hidden = !(o.role === "host" && s !== "connected");
    if (o.code) {
      el.link.value = o.inviteLink;
      el.code.textContent = o.code;
    }
    const { text, error } = this.message();
    el.msg.textContent = text;
    el.msg.hidden = !text;
    el.msg.classList.toggle("error", !!error);
    el.reconnectBtn.hidden = !(s === "lost" && o.role === "guest");
    el.leaveBtn.hidden = !o.active;
    el.leaveBtn.textContent = s === "hosting" ? "Annulla" : "Esci dalla partita online";

    el.openBtn.textContent = {
      hosting: "🟡 In attesa",
      joining: "🟡 Collego…",
      connected: "🟢 Online",
      lost: "🟠 Disconnesso",
    }[s] || "🌐 Online";

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
