![CatWifGIF](https://github.com/user-attachments/assets/16b9ae3a-4783-4c88-88ce-ea28a65f8430)


ISTRUZIONI BELLISSIMEEEEE 🚀🤖:
https://legacy.thinkfun.com/wp-content/uploads/2017/10/LaserCh-1034-Instructions.pdf

## Come si gioca

Vince chi colpisce per primo il King avversario con il proprio laser. A ogni turno si sposta
un proprio pezzo di una casella (anche in diagonale) **oppure** lo si ruota, poi si spara.

- **Tocca** un tuo pezzo, poi tocca una casella evidenziata per spostarlo (oppure **trascinalo**)
- Per ruotarlo **toccalo di nuovo** (o tienilo premuto, o tasto destro): compaiono le frecce **↺ ↻**.
  Al primo tocco si vedono solo le caselle dove spostarlo, così le frecce non le coprono. Anche
  **Q**/**E**; col mouse sopra una freccia l'anteprima mostra il raggio ruotato
- Poi premi **SPARA** (oppure **Spazio**, o tocca il tuo laser)
- Prima di sparare una **linea tratteggiata** mostra dove andrà il raggio e segna con un mirino
  i pezzi che verrebbero eliminati
- **↶ Annulla** (o **Ctrl+Z**) annulla la mossa finché non spari
- **Esc** annulla, **R** ricomincia
- Se la stessa posizione si ripete tre volte puoi **dichiarare patta**

Sotto la board un riquadro spiega sempre cosa fare: l'obiettivo, i due passi del turno, il passo
attuale e cosa fa il pezzo che hai toccato (anche se è dell'avversario). Guarda anche l'anteprima
del laser: avvisa in rosso se il tuo raggio colpirebbe il tuo King (e prima di sparare chiede
conferma) e in verde se colpirebbe quello avversario. Si può nascondere da **⚙️ Opzioni**.
All'inizio della partita due etichette indicano i King ("Il tuo King", "King avversario"); dopo
ogni colpo un messaggio dice quali pezzi sono stati eliminati. SPARA toccato prima di muovere
spiega cosa fare.

A ogni scheda nuova (o avvio dell'app) una finestra di **benvenuto** propone il **tutorial**: quattro lezioni sulla
board vera (ruotare uno specchio, spostare un pezzo, non colpire il proprio King, aggirare uno
scudo), ognuna vinta con una mossa, con il pulsante **💡 Aiuto** che mostra la soluzione. Si
riapre da **Regole** o da **Nuova partita**.

La finestra **Nuova partita** sceglie:
- **contro il computer** (Facile, Medio, Difficile; Facile per chi non ha ancora scelto; si può
  giocare col blu o con l'arancione),
  **in due sullo stesso schermo** oppure **online**;
- la **disposizione iniziale**: ACE (predefinita, consigliata dal manuale per iniziare), le altre del
  manuale (CURIOSITY, GRAIL, MERCURY, SOPHIE) oppure PRISMA, inventata per questo gioco (Prism e
  specchio semitrasparente sono già in campo);
- le **varianti** con i pezzi inventati (Prism e specchio semitrasparente). I loro pezzi vanno
  in caselle scelte in modo che alla prima mossa nessuno possa eliminare un pezzo avversario
  (le disposizioni del manuale sono già così).

Ricaricando la pagina la partita in corso riprende da dove era. Chiudendo la scheda (o l'app) e
riaprendola si riparte dal benvenuto, che ha il pulsante **Riprendi la partita** se ce n'era una in
corso; scegliendo il tutorial o una partita nuova, quella salvata viene sostituita. Nel browser le
impostazioni (nomi, livello, opzioni) valgono finché la scheda resta aperta; l'app le ricorda.

Funziona anche da telefono, in verticale e in orizzontale. La board non gira mai di lato: il laser
blu spara sempre verso l'alto dello schermo (per chi gioca con l'arancione la board è girata di
180°, così ognuno ha i suoi pezzi in basso).

## Giocare online

1. **🌐 Online** → scrivi il tuo nome → **Crea link partita**
2. Manda il link al tuo amico (o dettagli il codice di 6 lettere)
3. Quando lo apre e preme **Entra**, la partita parte: chi crea il link gioca col blu

Se la connessione cade (telefono bloccato, cambio di rete) chi è entrato col link si ricollega da
solo e la partita continua; l'host resta in ascolto sullo stesso codice, quindi il link non cambia
mai. Anche ricaricando la pagina si rientra nella stessa partita. Una nuova partita la crea l'host;
l'altro giocatore la può chiedere e l'host accetta o rifiuta.

Non serve scambiarsi indirizzi IP. I due browser si collegano direttamente con WebRTC
(connessione cifrata) grazie a [PeerJS](https://peerjs.com), una libreria open source: il suo
server pubblico serve solo a far trovare i due giocatori tramite il codice. Come in ogni gioco
con collegamento diretto, l'altro giocatore può vedere il tuo indirizzo IP.

Il link funziona dalla versione pubblicata su GitHub Pages: se apri la pagina dal disco, il link
punta a un file sul tuo computer e il tuo amico non può aprirlo. Dall'app il link punta sempre alla
versione pubblicata, quindi l'amico può giocare dal browser anche senza l'app.

## Lingue

Il gioco è in italiano e in inglese. Segue la lingua del dispositivo (inglese se non è nessuna
delle due) e si cambia in **⚙️ Opzioni › Lingua**: la pagina si ricarica e la partita riprende
da dove era.

- I testi della pagina restano scritti in italiano in `shared/index.html`; gli elementi da tradurre
  hanno `data-i18n="chiave"` (il contenuto) o `data-i18n-title`, `-aria-label`, `-placeholder`,
  `-alt` (gli attributi).
- I testi scritti dal codice passano da `t("chiave", { nome: ... })`: l'italiano è in
  `shared/js/i18n/it.js`, l'inglese (di tutti e due i tipi) in `shared/js/i18n/en.js`.
- Per aggiungere una lingua: copia `en.js` (es. `es.js`, con `STRINGS.es = {...}`) e traducilo,
  aggiungi il suo `<script>` in `shared/index.html` dopo `en.js` e una voce in `LANGUAGES`
  (`shared/js/i18n/i18n.js`).
- `tests/rules.test.js` controlla che ogni lingua abbia tutte le chiavi, con gli stessi `{segnaposto}`,
  e che il codice non usi chiavi inesistenti.

Lo storico delle mosse è salvato come dati (pezzo, caselle, rotazione) e scritto nella lingua di chi
guarda, anche online.

## Due versioni, un solo gioco

Il gioco è uno solo, in `shared/`: la pagina, lo stile, le regole, il disegno dei pezzi, il
computer, il gioco online e l'interfaccia. Le due versioni aggiungono solo quello che le riguarda:

- `web/`: la versione per il browser, pubblicata su GitHub Pages
- `app/`: l'app per Android e iOS (vedi [App](#app-android-e-ios))

`shared/index.html` ha due righe segnaposto, `<!-- @libs -->` e `<!-- @platform -->`, che la build
di ciascuna versione sostituisce con p5.js e PeerJS (dal CDN nel web, copie locali nell'app) e con
i propri script. Questi definiscono `Platform`, l'unico punto in cui il codice comune chiede
qualcosa alla piattaforma: condividere e copiare il link d'invito, vibrare, il tasto Indietro di
Android, dove salvare la partita in corso, l'indirizzo dei link d'invito, il controllo delle
versioni nuove (solo web). `web/js/Platform.js` e `app/js/Platform.js` hanno le stesse funzioni.

## Pubblicazione (web)

Per giocare in locale: `node web/build.mjs`, poi apri `web/dist/index.html` nel browser (p5.js
arriva dal CDN). La build va rifatta dopo ogni modifica.

A ogni push su `master` il workflow `.github/workflows/static.yml` esegue `node web/build.mjs` con
il commit e pubblica `web/dist` su GitHub Pages. La build scrive il commit negli indirizzi di JS e
CSS (`sketch.js?v=3b14d2b`) e in `version.json`: GitHub Pages fa tenere i file in cache 10 minuti,
ma con indirizzi nuovi basta ricaricare la pagina per avere tutta la versione nuova. Chi ha già il
gioco aperto vede la barra "C'è una versione nuova del gioco" con il pulsante **Aggiorna** (la
partita riprende da dove era). In `shared/` restano i segnaposto `?v=dev`. Sul sito c'è anche
`privacy.html` (da `web/`), l'informativa sulla privacy che serve per Google Play.

### Installare il sito come app

Il sito si installa come app dal browser, senza store e senza gli avvisi di Android sugli APK:
in Chrome ed Edge (Android e computer) il benvenuto e le Regole mostrano **📱 Installa l'app**, che
la mette tra le app del telefono con la sua icona; su iPhone e iPad spiegano come aggiungerla alla
schermata Home da Safari. Servono `web/manifest.webmanifest` (nome, colori, icone in `web/icons/`) e
`web/sw.js`, il service worker che salva il gioco per giocarci anche senza internet (contro il
computer): `web/build.mjs` ci scrive la versione e l'elenco dei file. Si aggiorna da sola come il
sito; il service worker si registra solo nella versione pubblicata (non con la versione `dev`).

## Test

- Regole, configurazioni e computer, senza browser (serve Node.js 18 o più recente):
  `node --test tests/*.test.js`
- Nel browser (Firefox + Selenium), vedi [tests/e2e/README.md](tests/e2e/README.md)

I test senza browser controllano anche le lezioni del tutorial: all'inizio il raggio non vince e la
soluzione mostrata da **💡 Aiuto** sì.

## Struttura

```
shared/                 il gioco, uguale nelle due versioni
  index.html            pagina del gioco (carica tutti gli script, in ordine; segnaposto per le build)
  css/style.css         layout, barra laterale, pulsanti, finestre
  assets/icon.ico       icona
  js/
    sketch.js           avvio p5: setup/draw, input (mouse e touch), adattamento allo schermo, impostazioni
    config/
      constants.js      dimensioni, direzioni, colori, velocità del laser, caselle riservate
      setups.js         configurazioni iniziali del manuale e varianti con i pezzi inventati
      lessons.js        lezioni del tutorial
    i18n/
      i18n.js           lingua scelta, t(), traduzione della pagina
      it.js  en.js      testi del codice in italiano; in inglese anche quelli della pagina
    core/
      Board.js          regole e stato della partita: turni, mosse, annulla, patta, anteprima del laser, disegno
      Cell.js           casella della board
      Player.js         giocatore
      LaserBeam.js      percorso del raggio e sua animazione
    pieces/
      Piece.js          classe base dei pezzi
      Laser.js  King.js  Defender.js  Deflector.js  Switch.js
      variants/         pezzi inventati: Prism.js, HalfMirror.js
    fx/
      Effects.js        scintille ed esplosioni
      Sound.js          effetti sonori sintetizzati
    ai/
      Engine.js         regole su un array di numeri (lette dalle classi dei pezzi) e ricerca della mossa
      AIPlayer.js       il computer come avversario: pensa a pezzi, muove, poi spara
    net/
      Online.js         partita online: collegamento con PeerJS, ping, ricollegamento, ripresa, risincronizzazione
    ui/
      GameUI.js         barra laterale e finestre: stato, suggerimenti e avvisi, comandi, storico, benvenuto, nuova partita, nomi, regole
      Tutorial.js       tutorial: carica le lezioni, giudica il colpo, aiuto
      OnlinePanel.js    finestra "Gioca online": generatore del link, ingresso, stato connessione
web/                    versione per il browser (GitHub Pages)
  build.mjs             shared/ + web/ -> web/dist, con la versione
  js/Platform.js        Platform per il browser
  js/Updates.js         avviso "c'è una versione nuova"
  js/AppInstall.js      "Installa l'app" dal browser, come farlo su iPhone, o l'APK per Android
  manifest.webmanifest  il sito come app installabile (nome, colori, icone in icons/)
  sw.js                 service worker: il gioco salvato per giocare senza internet
  privacy.html          informativa sulla privacy (anche per l'app)
app/                    app per Android e iOS (Capacitor), vedi sotto
tests/
  harness.js            carica gli script di shared/ in Node, senza p5
  rules.test.js         configurazioni, prima mossa senza catture, motore uguale alla board, computer, nomi, anteprima, tutorial
  e2e/                  test nel browser (Firefox + Selenium)
```

Per aggiungere un pezzo inventato: crea la sua classe in `shared/js/pieces/variants/`, aggiungila in
`shared/index.html` e in `shared/js/config/setups.js` (tra i `PIECE_TYPES` e nelle `VARIANTS`), e
scrivi nome e descrizione in ogni lingua (`piece.<Classe>`, `info.<Classe>`, `variant.<chiave>.label`
e `.desc` in `shared/js/i18n/`). Il computer
legge le regole del pezzo (`hit`, `rotations`, `canMoveTo`) dalla classe, quindi lo usa da solo.
La casella scritta in `VARIANTS` è quella preferita: se da lì si potrebbe eliminare un pezzo
avversario alla prima mossa, il gioco sceglie la casella libera più vicina dove non succede, e
`tests/rules.test.js` lo controlla per ogni disposizione e combinazione di varianti.

## App (Android e iOS)

La cartella `app/` trasforma lo stesso gioco di `shared/` in un'app per Android e iOS con
[Capacitor](https://capacitorjs.com) 8. La versione web su GitHub Pages resta com'è: l'app è una
copia in più. Nell'app p5 e PeerJS sono inclusi (contro il computer si gioca anche senza internet)
e ci sono i plugin per vibrazione, tasto Indietro, condivisione del link, appunti, barre di sistema
e schermata di avvio.

Si lavora dalla cartella `app/`. Serve Node.js 18 o più recente; se manca `npm`, va bene
`corepack npm` al suo posto (corepack è incluso in Node).

```
cd app
corepack npm install         # la prima volta e dopo ogni cambio di package.json
corepack npm run app:sync    # gioco -> app/www -> progetti android/ e ios/
```

`app:sync` va rifatto dopo ogni modifica al gioco. `build.mjs` copia `shared/` in `app/www`, mette
al posto di `<!-- @libs -->` p5 e PeerJS locali e al posto di `<!-- @platform -->` Capacitor, i suoi
plugin (in `window.Capacitor.Plugins`, es. `Capacitor.Plugins.Haptics`) e i file di `app/js`;
scrive la versione (`package.json` + commit) e toglie lo zoom con due dita.

### Android

Servono Android Studio (il suo JDK va bene: il progetto usa Gradle 9.1, che funziona anche con il
JDK 25 di Android Studio) e l'SDK di Android con le licenze accettate. Le piattaforme mancanti le
scarica Gradle da solo. Da riga di comando:

```
export JAVA_HOME=~/Desktop/android-studio-quail3-linux.tar./android-studio/jbr   # il JDK di Android Studio
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties                       # una volta
corepack npm run app:apk     # -> android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Oppure si apre la cartella `app/android` in Android Studio (o `corepack npm run app:android`, che
su Linux vuole il percorso di Android Studio in `CAPACITOR_ANDROID_STUDIO_PATH`).

### Scaricare l'app dal sito

A ogni push su `master`, se nei segreti del repository c'è la chiave di firma, il workflow di GitHub
Pages costruisce anche l'APK firmato e lo mette sul sito: `download/laserchess.apk`, con
`download/latest.json` (numero di build, versione, dimensione; li scrive `app/publish-apk.mjs`).
Nel browser, il benvenuto e le Regole mostrano allora **📱 Scarica l'app per Android** (non su
iPhone e iPad). Senza la chiave il workflow pubblica solo la versione web e il link non si vede.

L'APK del sito ha il canale `github` (`APP_CHANNEL`, scritto da `build.mjs` nella pagina): all'avvio,
e tornando nell'app dopo almeno un'ora, legge `latest.json` sul sito e, se c'è una build più nuova,
mostra una barra con **Scarica** e **Più tardi** (non lo ripropone fino alla build successiva).
Con **Scarica** l'app scarica l'APK nella sua cache privata, non in Download, e apre l'installazione
di Android (`ApkUpdaterPlugin.java`, in `app/android/.../laserchess/`): la prima volta Android chiede
di permettere a Laser Chess di installare app, poi l'installazione riparte da sola. La partita
salvata resta e al prossimo avvio l'APK si cancella. Se il download non riesce, l'APK si apre nel
browser. Solo il primo APK, scaricato dal browser, resta in Download. Il numero di
build è il numero di commit (`git rev-list --count HEAD`), quindi ogni push fa una build nuova. Le
app costruite in locale (`app:apk`, canale `local`) e quella di Google Play non controllano.

La chiave di firma è `app/android/laserchess-release.jks`, con le password in
`app/android/keystore.properties` (tutti e due fuori da git). **Fanne una copia di sicurezza fuori
dal computer**: senza, chi ha installato l'APK del sito dovrà disinstallarlo per avere quello firmato
con una chiave nuova. Per metterla nei segreti del repository (una volta sola):

```
cd app/android
PASS=$(sed -n 's/^storePassword=//p' keystore.properties)
base64 -w0 laserchess-release.jks | gh secret set ANDROID_KEYSTORE_BASE64
printf '%s' "$PASS" | gh secret set ANDROID_KEYSTORE_PASSWORD
printf '%s' "$PASS" | gh secret set ANDROID_KEY_PASSWORD
printf 'laserchess' | gh secret set ANDROID_KEY_ALIAS
gh workflow run static.yml      # ripubblica subito, con l'APK
```

Android installa un APK sopra un altro solo se sono firmati con la stessa chiave: l'APK di debug
costruito in locale, quello del sito e quello di Google Play (firmato da Google) non si aggiornano
l'uno con l'altro; per passare da uno all'altro si disinstalla prima.

### Pubblicare su Google Play

Testi e immagini per la scheda, risposte per la Play Console e passi da fare a mano (test chiuso,
privacy, nome): [app/store/README.md](app/store/README.md). Qui sotto la parte tecnica.

1. **Nome e id dell'app** sono solo in `app/capacitor.config.json` (`appName`, `appId`): Android li
   legge da lì in `android/app/build.gradle`, iOS li riceve da `build.mjs`. Vanno decisi prima del
   primo caricamento: su Google Play l'id (`io.github.cobalt38.laserchess`) non si può più cambiare.
   Anche il nome "Laser Chess" va controllato (è il nome del gioco di ThinkFun).
2. **Versione**: solo in `app/package.json` (`"version": "1.0.0"`). Il `versionCode` che Google Play
   vuole sempre più grande si calcola da lì: `1.2.3` -> 10203. Prima di ogni caricamento si aumenta la
   versione (minor e patch fino a 99).
3. **Chiave di caricamento**: va bene la stessa dell'APK del sito (`laserchess-release.jks`, con
   `keystore.properties` già pronto; vedi sopra). Per farne una a parte, una volta sola:

   ```
   cd app/android
   ~/Desktop/android-studio-quail3-linux.tar./android-studio/jbr/bin/keytool -genkeypair -v \
     -keystore upload-key.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   e accanto, in `app/android/keystore.properties` (percorsi relativi ad `app/android`):

   ```
   storeFile=upload-key.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```

   Chiave e file delle password restano fuori da git (`app/.gitignore`). **Va fatta una copia di
   sicurezza fuori dal computer**: con la firma delle app di Google Play (attiva di default per le
   app nuove) questa è solo la chiave di caricamento e se si perde Google la può sostituire su
   richiesta; senza, perderla vuol dire non poter più aggiornare l'app.
4. `corepack npm run app:bundle` -> `android/app/build/outputs/bundle/release/app-release.aab`, da
   caricare nella Play Console. Senza `keystore.properties` la build riesce lo stesso ma il file non è
   firmato e Google Play lo rifiuta.

Prima di caricare su Google Play togli dal manifest (`app/android/app/src/main/AndroidManifest.xml`)
il permesso `REQUEST_INSTALL_PACKAGES`: serve solo all'APK del sito per aggiornarsi da sé, e Google Play
non lo ammette (lì gli aggiornamenti li fa lo store). Costruisci il bundle con `APP_CHANNEL=play`.

L'app punta ad Android 16 (`targetSdk` 36, quello che Google Play chiede dal 31 agosto 2026) e
funziona da Android 7 (`minSdk` 24). Niente offuscamento del codice: il gioco è JavaScript.

### iOS

Il progetto (`app/ios`) usa Swift Package Manager, non CocoaPods, ma si compila solo su un Mac con
Xcode: lì `cd app && npm install && npm run app:ios` apre Xcode, poi in *Signing & Capabilities* si
sceglie il proprio team e con *Product > Archive* si carica su App Store Connect. Id, nome e versione
li scrive `build.mjs` (la stessa versione di Android). L'app usa solo la cifratura standard del
sistema (HTTPS, WebRTC), di solito dichiarata a App Store Connect come esente.

### Icona e schermata di avvio

Sono disegnate con il codice dei pezzi: `app/resources/icon.html` (si apre con un server locale
dalla cartella principale, es. `python3 -m http.server 8000` e
`http://localhost:8000/app/resources/icon.html?mode=icon`, poi `foreground`, `background`,
`splash`). I PNG salvati vanno in `app/resources` e `corepack npm run app:icons` ne ricava tutte le
misure per Android e iOS.

### Bordi dello schermo

La pagina usa `viewport-fit=cover`. Su Android 15 e più recenti l'app arriva fino ai bordi e
Capacitor (`SystemBars`, `insetsHandling: "css"`) fa valere `env(safe-area-inset-*)` come su iOS;
con WebView più vecchie sposta lui la pagina sotto le barre di sistema e i valori sono 0. Nel CSS
quindi basta `env(safe-area-inset-*)`.

```
app/
  package.json         dipendenze (Capacitor, plugin, p5 e PeerJS da copiare) e comandi app:*
  capacitor.config.json  nome, id, colori, barre di sistema, schermata di avvio
  build.mjs            shared/ -> www/ per l'app
  publish-apk.mjs      APK firmato e latest.json nella versione web (lo usa il workflow)
  js/                  adattatore del gioco per l'app (copiato in www/platform) e controllo degli aggiornamenti
  resources/           sorgenti di icona e schermata di avvio
  android/  ios/       progetti nativi (generati da Capacitor, poi adattati)
```
