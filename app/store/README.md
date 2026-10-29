# Google Play: cosa serve

Materiale per la scheda dell'app nella Play Console e i passi da fare a mano. Come si compila e
firma il file `.aab` è nel README principale ("Pubblicare su Google Play").

## Prima di tutto: due decisioni

1. **Nome dell'app.** "Laser Chess" è il nome del gioco da tavolo di ThinkFun, e anche disposizioni
   (ACE, CURIOSITY, GRAIL, MERCURY, SOPHIE) e nomi dei pezzi vengono dal loro manuale. Sul sito va
   bene; su Google Play un nome uguale a un prodotto esistente può portare a una segnalazione per
   marchio e alla rimozione dell'app. Un nome tuo (es. legato a PRISMA, la disposizione inventata
   per questo gioco) evita il problema. Il nome si cambia in `app/capacitor.config.json`
   (`appName`) e, per la scheda, qui sotto.
2. **Id dell'app** (`appId` in `app/capacitor.config.json`, oggi `io.github.cobalt38.laserchess`):
   dopo il primo caricamento non si può più cambiare. Se cambi nome, decidi ora se cambiare anche
   l'id.

## Passi nella Play Console

1. Account sviluppatore Google Play (25 $ una volta, con verifica dell'identità).
2. **Account personale creato dopo il 13 novembre 2023**: prima della pubblicazione per tutti serve un
   *test chiuso* con almeno 12 tester che restano iscritti per 14 giorni di fila. Conviene caricare
   la prima versione subito in un test chiuso e invitare amici (servono i loro account Google).
3. Crea l'app: lingua predefinita italiano, tipo "Gioco", gratuita.
4. Carica `app-release.aab` (firmato con la chiave di caricamento). La firma delle app di Google
   Play resta attiva (predefinita).
5. **Contenuti dell'app** (sezione "Policy e programmi"):
   - Informativa sulla privacy: `https://cobalt38.github.io/LaserChess/privacy.html` (la pagina è in
     `web/privacy.html` e va online con il prossimo push su `master`).
   - Accesso all'app: tutte le funzioni sono disponibili senza credenziali.
   - Annunci: no.
   - Sicurezza dei dati: risposte suggerite qui sotto.
   - Classificazione dei contenuti (questionario IARC): categoria Gioco; niente violenza realistica
     (pezzi astratti che esplodono), niente acquisti, niente contenuti generati dagli utenti; gli
     utenti possono interagire online (solo il nome scelto e le mosse, con chi ha il codice).
   - Pubblico di destinazione: la scelta più semplice è "13 anni e più". Includere i minori di 13 anni
     attiva i requisiti del programma Famiglie (più controlli sulla parte online).
6. **Scheda dello Store**: testi e immagini qui sotto.
7. Paesi e lingue: il gioco è in italiano e in inglese (segue la lingua del telefono). Aggiungi la
   scheda in inglese qui sotto come traduzione (en-US) della scheda italiana: chi ha il telefono in
   un'altra lingua vede la scheda e il gioco in inglese.

### Sicurezza dei dati (Data safety)

Risposte che corrispondono a come funziona il gioco oggi (verificale tu, sei tu a dichiararle):

- *L'app raccoglie o condivide dati utente?* **No.** Impostazioni e partita restano sul dispositivo.
  Nelle partite online nome e mosse vanno direttamente all'altro giocatore (WebRTC, cifrato) su
  richiesta dell'utente, non a te né a terzi per altri scopi.
- *I dati sono criptati in transito?* Sì (WebRTC usa sempre DTLS).
- *Gli utenti possono chiedere la cancellazione dei dati?* Non c'è nulla da cancellare lato server:
  basta disinstallare l'app.
- Nota: il server pubblico di PeerJS, usato solo per far trovare i due giocatori, vede l'indirizzo IP
  come qualunque server internet; l'informativa lo dice.

## Scheda dello Store (italiano)

**Nome** (max 30 caratteri): `Laser Chess` (vedi sopra)

**Descrizione breve** (max 80): `Specchi e laser: colpisci il King avversario prima che lui colpisca il tuo.`

**Descrizione completa** (max 4000):

```
Un gioco di strategia a turni con laser e specchi, per uno o due giocatori.

Ogni giocatore ha un laser. A ogni turno sposti o ruoti uno dei tuoi pezzi, poi spari: gli specchi
verdi deviano il raggio, i pezzi colpiti dove non hanno lo specchio vengono eliminati. Vince chi
colpisce per primo il King avversario. Attento al tuo: se il raggio lo colpisce, perdi.

• Tutorial di due minuti: quattro lezioni sulla board vera, con l'aiuto che mostra la soluzione
• Contro il computer, in tre livelli (si gioca anche senza internet)
• In due sullo stesso telefono, passandoselo
• Online con un amico: gli mandi un link e lui può giocare anche dal browser, senza l'app
• Prima di sparare una linea tratteggiata mostra dove andrà il raggio, e un avviso ti ferma se
  stai per colpire il tuo King
• Sei disposizioni iniziali e due pezzi inventati: il Prism, che divide il raggio in tre, e lo
  specchio semitrasparente, che ne lascia passare metà
• Niente pubblicità, niente account, nessun dato raccolto
• In italiano e in inglese
```

**Categoria**: Giochi › Da tavolo (o Strategia). **Tag**: strategia, a turni, due giocatori.

## Store listing (English, en-US)

**Name**: `Laser Chess` (see the name note above)

**Short description** (max 80): `Mirrors and lasers: hit the enemy King before it hits yours.`

**Full description**:

```
A turn-based strategy game with lasers and mirrors, for one or two players.

Each player has a laser. Every turn you move or rotate one of your pieces, then fire: green
mirrors bounce the beam, and pieces hit where they have no mirror are destroyed. The first to hit
the enemy King wins. Watch out for your own: if the beam hits it, you lose.

• Two-minute tutorial: four lessons on the real board, with a hint that shows the solution
• Play against the computer, three levels (works offline too)
• Two players on the same phone, passing it back and forth
• Online with a friend: send them a link and they can play from the browser, no app needed
• Before firing, a dashed line shows where the beam will go, and a warning stops you if you're
  about to hit your own King
• Six starting layouts and two invented pieces: the Prism, which splits the beam in three, and the
  half mirror, which lets half of it through
• No ads, no account, no data collected
• In English and Italian
```

The screenshots are in Italian; for the English listing you can take them again with the game set to
English (⚙️ Settings › Language).

## Immagini

| File | Uso nella Play Console |
|---|---|
| `icon-512.png` | Icona dell'app (512×512) |
| `feature-graphic.png` | Grafica in primo piano (1024×500), da `feature-graphic.html` |
| `screenshots/*.png` | Screenshot del telefono (1080×1920): benvenuto, tutorial, anteprima del raggio, colpo, regole |

`feature-graphic.html` disegna la grafica con il codice del gioco: aprila con un server locale dalla
cartella principale (`python3 -m http.server 8000`, poi
`http://localhost:8000/app/store/feature-graphic.html?title=Nuovo%20nome`) per rifarla con un altro
nome. Gli screenshot sono della versione con il nome attuale: se cambi nome non si vede (il nome
compare solo nel benvenuto), ma va rifatto quello.
