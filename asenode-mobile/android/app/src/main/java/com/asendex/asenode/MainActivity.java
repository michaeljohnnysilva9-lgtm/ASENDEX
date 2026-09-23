package com.asendex.asenode;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.widget.EditText;
import android.widget.TextView;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.HostKey;
import com.jcraft.jsch.HostKeyRepository;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends AppCompatActivity {
    private EditText host, port, user, password;
    private TextView nodeState, status, fingerprint;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler ui = new Handler(Looper.getMainLooper());
    private SharedPreferences prefs;

    private static final String CTL =
        "if [ -x /usr/local/sbin/asenode-control ]; then sudo -n /usr/local/sbin/asenode-control %s; " +
        "elif command -v asentum-validator >/dev/null 2>&1; then asentum-validator %s; " +
        "else echo 'ASENTUM_CONTROL_NOT_FOUND'; exit 127; fi";

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        prefs = getSharedPreferences("asenode", Context.MODE_PRIVATE);
        host = findViewById(R.id.host);
        port = findViewById(R.id.port);
        user = findViewById(R.id.user);
        password = findViewById(R.id.password);
        nodeState = findViewById(R.id.nodeState);
        status = findViewById(R.id.status);
        fingerprint = findViewById(R.id.fingerprint);

        host.setText(prefs.getString("host", ""));
        port.setText(prefs.getString("port", "22"));
        user.setText(prefs.getString("user", "asenode"));

        findViewById(R.id.connect).setOnClickListener(v -> run(ctl("status"), "STATUS"));
        findViewById(R.id.sync).setOnClickListener(v -> run(ctl("sync"), "SYNC / STATUS"));
        findViewById(R.id.start).setOnClickListener(v -> run(ctl("start"), "START"));
        findViewById(R.id.restart).setOnClickListener(v -> confirm("Reiniciar validator?", "O node ficará offline por alguns segundos.", ctl("restart"), "RESTART"));
        findViewById(R.id.balance).setOnClickListener(v -> run(ctl("balance"), "BALANCE"));
        findViewById(R.id.earnings).setOnClickListener(v -> run(ctl("earnings"), "EARNINGS"));
        findViewById(R.id.logs).setOnClickListener(v -> run(ctl("logs 100"), "LOGS"));
        findViewById(R.id.update).setOnClickListener(v -> confirm("Atualizar validator?", "Executa a rotina de atualização no servidor, preservando a validator.key.", ctl("update"), "UPDATE"));
        findViewById(R.id.stop).setOnClickListener(v -> confirm("Parar validator?", "Enquanto parado ele não assina blocos.", ctl("stop"), "STOP"));
    }

    private String ctl(String action) {
        String escaped = action.replace("'", "");
        return String.format(CTL, escaped, escaped);
    }

    private void confirm(String title, String msg, String cmd, String label) {
        new AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(msg)
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Confirmar", (d,w) -> run(cmd, label))
            .show();
    }

    private void run(String command, String label) {
        final String h = host.getText().toString().trim();
        final String u = user.getText().toString().trim();
        final String p = password.getText().toString();
        int prt = 22;
        try { prt = Integer.parseInt(port.getText().toString().trim()); } catch (Exception ignored) {}
        final int sshPort = prt;

        if (h.isEmpty() || u.isEmpty() || p.isEmpty()) {
            status.setText("Preencha IP/host, usuário e senha SSH.");
            return;
        }

        prefs.edit()
            .putString("host", h)
            .putString("port", String.valueOf(sshPort))
            .putString("user", u)
            .apply();

        nodeState.setText("● CONECTANDO…");
        status.setText(label + "\nConectando com segurança ao validator…");

        io.execute(() -> {
            Session s = null;
            try {
                JSch jsch = new JSch();
                TofuRepo tofu = new TofuRepo(prefs, h + ":" + sshPort);
                jsch.setHostKeyRepository(tofu);
                s = jsch.getSession(u, h, sshPort);
                s.setPassword(p);
                s.setConfig("StrictHostKeyChecking", "yes");
                s.setConfig("PreferredAuthentications", "password,keyboard-interactive");
                s.connect(15000);

                String fp = tofu.currentFingerprint;
                String out = exec(s, command);
                ui.post(() -> {
                    nodeState.setText("● CONECTADO");
                    fingerprint.setText("Host key: " + (fp == null ? "confiável" : fp));
                    status.setText(out.isEmpty() ? "Comando concluído sem saída." : out);
                });
            } catch (Exception e) {
                final String err = e.getClass().getSimpleName() + ": " + e.getMessage();
                ui.post(() -> {
                    nodeState.setText("● ERRO");
                    status.setText(err);
                });
            } finally {
                if (s != null && s.isConnected()) s.disconnect();
            }
        });
    }

    private String exec(Session session, String command) throws Exception {
        ChannelExec ch = (ChannelExec) session.openChannel("exec");
        ch.setCommand(command);
        ch.setInputStream(null);
        InputStream stdout = ch.getInputStream();
        InputStream stderr = ch.getErrStream();
        ch.connect(10000);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[4096];
        long started = System.currentTimeMillis();

        while (true) {
            while (stdout.available() > 0) {
                int n = stdout.read(buf);
                if (n < 0) break;
                out.write(buf, 0, n);
            }
            if (stderr != null) {
                while (stderr.available() > 0) {
                    int n = stderr.read(buf);
                    if (n < 0) break;
                    out.write(buf, 0, n);
                }
            }
            if (ch.isClosed() && stdout.available() == 0 && (stderr == null || stderr.available() == 0)) break;
            if (System.currentTimeMillis() - started > 120000) {
                out.write("\n[timeout after 120s]".getBytes("UTF-8"));
                break;
            }
            Thread.sleep(120);
        }

        int code = ch.getExitStatus();
        ch.disconnect();
        if (code != 0) out.write(("\n[exit " + code + "]").getBytes("UTF-8"));
        return out.toString("UTF-8");
    }

    @Override protected void onDestroy() {
        io.shutdownNow();
        super.onDestroy();
    }

    static class TofuRepo implements HostKeyRepository {
        private final SharedPreferences prefs;
        private final String serverId;
        String currentFingerprint;

        TofuRepo(SharedPreferences prefs, String serverId) {
            this.prefs = prefs;
            this.serverId = serverId;
        }

        private String fp(byte[] key) {
            try {
                byte[] d = MessageDigest.getInstance("SHA-256").digest(key);
                return "SHA256:" + Base64.encodeToString(d, Base64.NO_WRAP | Base64.NO_PADDING);
            } catch (Exception e) {
                return "unknown";
            }
        }

        @Override public int check(String host, byte[] key) {
            currentFingerprint = fp(key);
            String saved = prefs.getString("hostkey:" + serverId, null);
            if (saved == null) {
                prefs.edit().putString("hostkey:" + serverId, currentFingerprint).apply();
                return OK;
            }
            return saved.equals(currentFingerprint) ? OK : CHANGED;
        }

        @Override public void add(HostKey hostkey, com.jcraft.jsch.UserInfo ui) {}
        @Override public void remove(String host, String type) {}
        @Override public void remove(String host, String type, byte[] key) {}
        @Override public String getKnownHostsRepositoryID() { return "ASENTUM OPERATOR MOBILE TOFU"; }
        @Override public HostKey[] getHostKey() { return new HostKey[0]; }
        @Override public HostKey[] getHostKey(String host, String type) { return new HostKey[0]; }
    }
}
