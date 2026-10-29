package io.github.cobalt38.laserchess;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

// Aggiornamento dell'app scaricata dal sito (canale "github", vedi app/js/AppUpdates.js): l'APK nuovo
// si scarica nella cache privata dell'app, non in Download, e si apre l'installazione di Android.
// Alla prima volta Android chiede di permettere a Laser Chess di installare app: tornando nell'app
// l'installazione riparte da sola. A ogni avvio la cartella degli aggiornamenti si svuota, così l'APK
// installato (o rifiutato) non resta sul telefono.
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private File pending; // APK scaricato che aspetta il permesso di installare app

    @Override
    public void load() {
        File[] old = updatesDir().listFiles();
        if (old != null) for (File f : old) f.delete();
    }

    private File updatesDir() {
        return new File(getContext().getCacheDir(), "updates");
    }

    // install({ url }): scarica l'APK (solo https) e apre l'installazione. Si risolve quando il
    // download è finito, così la pagina può dire "scarico l'aggiornamento" nel frattempo
    @PluginMethod
    public void install(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Indirizzo non valido");
            return;
        }
        new Thread(() -> {
            try {
                File dir = updatesDir();
                dir.mkdirs();
                File apk = new File(dir, "laserchess.apk");
                download(url, apk);
                getActivity().runOnUiThread(() -> {
                    pending = apk;
                    installPending();
                });
                call.resolve();
            } catch (IOException e) {
                call.reject("Download non riuscito", e);
            }
        }).start();
    }

    private void download(String url, File to) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        try {
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + conn.getResponseCode());
            try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(to)) {
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            }
        } finally {
            conn.disconnect();
        }
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void installPending() {
        if (pending == null) return;
        if (!canInstall()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(settings);
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", pending);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        pending = null;
        getActivity().startActivity(intent);
    }

    // Di ritorno dalle impostazioni di Android: se il permesso c'è, si installa
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (pending != null && canInstall()) installPending();
    }
}
