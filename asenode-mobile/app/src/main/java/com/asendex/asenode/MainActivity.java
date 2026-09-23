package com.asendex.asenode;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.ChannelSftp;
import com.jcraft.jsch.HostKey;
import com.jcraft.jsch.HostKeyRepository;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import com.jcraft.jsch.UserInfo;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.Properties;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int PICK_VALIDATOR_KEY = 1423;
    private static final int BG = Color.rgb(6, 8, 14);
    private static final int CARD = Color.rgb(15, 19, 28);
    private static final int TEXT = Color.rgb(244, 248, 255);
    private static final int MUTED = Color.rgb(143, 155, 176);
    private static final int GREEN = Color.rgb(39, 226, 160);
    private static final int CYAN = Color.rgb(57, 203, 255);
    private static final int PURPLE = Color.rgb(143, 96, 255);
    private static final int RED = Color.rgb(255, 91, 110);

    private final ExecutorService io = Executors.newCachedThreadPool();
    private final Handler main = new Handler(Looper.getMainLooper());

    private EditText hostField, portField, userField, passField, terminalInput;
    private TextView connectionState, nodeSummary, outputView;
    private SshController ssh;
    private String currentPassword = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        buildUi();
    }

    private void buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(BG);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(18), dp(24), dp(18), dp(36));
        scroll.addView(root, new ScrollView.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView eyebrow = label("ASENDEX LABS · ASENTUM TESTNET", 11, GREEN, true);
        root.addView(eyebrow);
        TextView title = label("ASENODE\nMobile Operator", 31, TEXT, true);
        title.setLineSpacing(0, 0.92f);
        root.addView(title);
        TextView intro = label("Controle um validator Asentum oficial pelo Android, sem PowerShell. O app usa SSH; o processo de consenso continua sendo o software oficial da Asentum.", 14, MUTED, false);
        intro.setPadding(0, dp(8), 0, dp(16));
        root.addView(intro);

        LinearLayout statusCard = card();
        connectionState = label("● DESCONECTADO", 12, RED, true);
        statusCard.addView(connectionState);
        nodeSummary = label("Chain 1423  ·  Bond mínimo 500 ASE\nValidator: —\nStatus: —\nBlock: —", 15, TEXT, false);
        nodeSummary.setPadding(0, dp(10), 0, 0);
        statusCard.addView(nodeSummary);
        root.addView(statusCard);

        LinearLayout warning = card();
        TextView wt = label("IMPORTANTE PARA SEUS 500 ASE EM BOND", 12, CYAN, true);
        warning.addView(wt);
        TextView wb = label("Para continuar usando o bond existente, o novo node precisa usar a MESMA validator.key do node antigo. Desligue completamente o Operator antigo antes de iniciar outro node com essa chave. Nunca rode a mesma validator.key em duas máquinas ao mesmo tempo.", 13, TEXT, false);
        wb.setPadding(0, dp(8), 0, 0);
        warning.addView(wb);
        root.addView(warning);

        LinearLayout conn = card();
        conn.addView(label("CONEXÃO DO VALIDATOR", 12, GREEN, true));
        hostField = input("IP / hostname do VPS", false);
        portField = input("Porta SSH (22)", false);
        portField.setInputType(InputType.TYPE_CLASS_NUMBER);
        portField.setText("22");
        userField = input("Usuário (root recomendado)", false);
        userField.setText("root");
        passField = input("Senha SSH", true);
        conn.addView(hostField);
        conn.addView(portField);
        conn.addView(userField);
        conn.addView(passField);
        Button connect = button("CONECTAR", GREEN, Color.BLACK);
        connect.setOnClickListener(v -> connect());
        conn.addView(connect);
        root.addView(conn);

        LinearLayout actions = card();
        actions.addView(label("OPERATOR", 12, CYAN, true));
        actions.addView(rowButton("STATUS", CYAN, v -> runCli("asentum-validator status 2>&1"),
                "BALANCE", PURPLE, v -> runCli("asentum-validator balance 2>&1")));
        actions.addView(rowButton("EARNINGS", GREEN, v -> runCli("asentum-validator earnings 2>&1"),
                "LOGS", CYAN, v -> runCli("timeout 8s asentum-validator logs 2>&1 || true")));
        actions.addView(rowButton("RESTART", PURPLE, v -> runCli("asentum-validator restart 2>&1"),
                "UPDATE", GREEN, v -> runCli("asentum-validator update 2>&1")));
        actions.addView(rowButton("START", GREEN, v -> runCli("asentum-validator start 2>&1"),
                "STOP", RED, v -> runCli("asentum-validator stop 2>&1")));
        root.addView(actions);

        LinearLayout migrate = card();
        migrate.addView(label("MIGRAR SEU VALIDATOR EXISTENTE", 12, CYAN, true));
        TextView mt = label("Use isto para levar a validator.key que já corresponde ao seu bond de 500 ASE para o VPS. O arquivo é enviado diretamente pelo canal SSH e não é salvo pelo ASENODE.", 13, MUTED, false);
        mt.setPadding(0, dp(6), 0, dp(10));
        migrate.addView(mt);
        Button importKey = button("IMPORTAR validator.key", CYAN, Color.BLACK);
        importKey.setOnClickListener(v -> pickValidatorKey());
        migrate.addView(importKey);
        root.addView(migrate);

        LinearLayout install = card();
        install.addView(label("INSTALAÇÃO OFICIAL NO VPS", 12, GREEN, true));
        TextView it = label("Abre um terminal SSH dentro do app e executa o instalador oficial da Asentum. Para seu bond existente, importe a validator.key primeiro. O instalador oficial requer Ubuntu 22.04+/Debian 12+, 2 cores, 4 GB RAM e armazenamento suficiente.", 13, MUTED, false);
        it.setPadding(0, dp(6), 0, dp(10));
        install.addView(it);
        Button installer = button("ABRIR INSTALADOR ASENTUM", GREEN, Color.BLACK);
        installer.setOnClickListener(v -> startInstaller());
        install.addView(installer);
        terminalInput = input("Responder ao instalador / comando", false);
        install.addView(terminalInput);
        Button send = button("ENVIAR AO TERMINAL", PURPLE, Color.WHITE);
        send.setOnClickListener(v -> sendTerminal());
        install.addView(send);
        root.addView(install);

        LinearLayout console = card();
        console.addView(label("CONSOLE", 12, CYAN, true));
        outputView = label("Pronto. Conecte ao VPS para começar.", 12, Color.rgb(198, 211, 230), false);
        outputView.setTypeface(Typeface.MONOSPACE);
        outputView.setTextIsSelectable(true);
        outputView.setPadding(0, dp(8), 0, 0);
        console.addView(outputView);
        root.addView(console);

        TextView foot = label("ASENODE Mobile 0.1.0 beta · usa o node oficial Asentum; não substitui nem modifica o motor de consenso.", 11, MUTED, false);
        foot.setGravity(Gravity.CENTER);
        foot.setPadding(0, dp(10), 0, 0);
        root.addView(foot);

        setContentView(scroll);
    }

    private void connect() {
        final String host = hostField.getText().toString().trim();
        final String user = userField.getText().toString().trim();
        final String password = passField.getText().toString();
        int port = 22;
        try { port = Integer.parseInt(portField.getText().toString().trim()); } catch (Exception ignored) {}
        final int p = port;
        if (host.isEmpty() || user.isEmpty() || password.isEmpty()) {
            toast("Preencha IP/host, usuário e senha SSH.");
            return;
        }
        connectionState.setText("● CONECTANDO…");
        connectionState.setTextColor(CYAN);
        append("\nConectando a " + host + ":" + p + "…");
        io.execute(() -> {
            try {
                if (ssh != null) ssh.disconnect();
                currentPassword = password;
                ssh = new SshController(this, host, p, user, password);
                ssh.connect();
                main.post(() -> {
                    connectionState.setText("● CONECTADO");
                    connectionState.setTextColor(GREEN);
                    append("\nSSH conectado com verificação TOFU de host key.");
                });
                String s = ssh.run("asentum-validator status 2>&1 || true", 25_000);
                main.post(() -> renderStatus(s));
            } catch (Exception e) {
                main.post(() -> {
                    connectionState.setText("● FALHA SSH");
                    connectionState.setTextColor(RED);
                    append("\nERRO: " + e.getMessage());
                });
            }
        });
    }

    private void runCli(String cmd) {
        if (!ready()) return;
        append("\n\n$ " + cmd.replace(" 2>&1", ""));
        io.execute(() -> {
            try {
                String out = ssh.run(cmd, 60_000);
                main.post(() -> {
                    append("\n" + out.trim());
                    if (cmd.contains(" status")) renderStatus(out);
                });
            } catch (Exception e) {
                main.post(() -> append("\nERRO: " + e.getMessage()));
            }
        });
    }

    private void startInstaller() {
        if (!ready()) return;
        append("\n\nAbrindo terminal interativo do instalador oficial…");
        io.execute(() -> {
            try {
                ssh.startShell(chunk -> main.post(() -> append(chunk)));
                Thread.sleep(500);
                ssh.sendShell("curl -fsSL https://explorer.asentum.com/install/validator -o /tmp/asentum-validator-install.sh && bash /tmp/asentum-validator-install.sh\n");
            } catch (Exception e) {
                main.post(() -> append("\nERRO NO TERMINAL: " + e.getMessage()));
            }
        });
    }

    private void sendTerminal() {
        if (!ready()) return;
        String line = terminalInput.getText().toString();
        if (line.isEmpty()) return;
        try {
            ssh.sendShell(line + "\n");
            terminalInput.setText("");
        } catch (Exception e) {
            append("\nERRO: terminal não está aberto. Toque em ABRIR INSTALADOR ASENTUM.");
        }
    }

    private void pickValidatorKey() {
        if (!ready()) return;
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        startActivityForResult(i, PICK_VALIDATOR_KEY);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_VALIDATOR_KEY || resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        append("\nPreparando migração da validator.key…");
        io.execute(() -> {
            try {
                byte[] bytes = readAll(getContentResolver().openInputStream(uri));
                if (bytes.length == 0 || bytes.length > 64 * 1024) throw new Exception("Arquivo validator.key inválido ou grande demais.");
                ssh.uploadValidatorKey(bytes);
                main.post(() -> {
                    append("\nvalidator.key enviada com permissão 600. Serviço reiniciado quando disponível.");
                    toast("validator.key migrada para o VPS.");
                });
            } catch (Exception e) {
                main.post(() -> append("\nERRO AO MIGRAR CHAVE: " + e.getMessage()));
            }
        });
    }

    private byte[] readAll(InputStream in) throws Exception {
        if (in == null) throw new Exception("Não foi possível abrir o arquivo.");
        try (InputStream input = in; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buf = new byte[4096];
            int n;
            while ((n = input.read(buf)) >= 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    private boolean ready() {
        if (ssh == null || !ssh.isConnected()) {
            toast("Conecte ao VPS primeiro.");
            return false;
        }
        return true;
    }

    private void renderStatus(String raw) {
        append("\n" + raw.trim());
        String lower = raw.toLowerCase(Locale.ROOT);
        String status = "—";
        if (lower.contains("signing")) status = "SIGNING";
        else if (lower.contains("active")) status = "ACTIVE";
        else if (lower.contains("pending")) status = "PENDING";
        else if (lower.contains("dormant")) status = "DORMANT";
        else if (lower.contains("idle")) status = "IDLE";
        else if (lower.contains("not found") || lower.contains("command not found")) status = "NÃO INSTALADO";

        String block = find(raw, "(?i)(?:block(?: height)?|height)\\s*[:=]?\\s*#?([0-9,]+)");
        String stake = find(raw, "(?i)(?:stake|bonded)\\s*[:=]?\\s*([0-9.,]+\\s*ASE)");
        String address = find(raw, "(?i)(ase1[a-z0-9]{20,}|0x[a-f0-9]{40})");
        if (block.isEmpty()) block = "—";
        if (stake.isEmpty()) stake = "—";
        if (address.isEmpty()) address = "—";
        if (address.length() > 23) address = address.substring(0, 12) + "…" + address.substring(address.length() - 8);
        nodeSummary.setText("Chain 1423  ·  Bond mínimo 500 ASE\nValidator: " + address + "\nStatus: " + status + "  ·  Stake: " + stake + "\nBlock: " + block);
    }

    private String find(String s, String regex) {
        try {
            Matcher m = Pattern.compile(regex).matcher(s);
            if (m.find()) return m.group(m.groupCount() >= 1 ? 1 : 0);
        } catch (Exception ignored) {}
        return "";
    }

    private void append(String s) {
        outputView.append(s);
    }

    private void toast(String s) {
        Toast.makeText(this, s, Toast.LENGTH_SHORT).show();
    }

    private LinearLayout card() {
        LinearLayout c = new LinearLayout(this);
        c.setOrientation(LinearLayout.VERTICAL);
        c.setPadding(dp(16), dp(16), dp(16), dp(16));
        c.setBackgroundColor(CARD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.setMargins(0, 0, 0, dp(12));
        c.setLayoutParams(lp);
        return c;
    }

    private TextView label(String text, int sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(text);
        t.setTextSize(sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return t;
    }

    private EditText input(String hint, boolean password) {
        EditText e = new EditText(this);
        e.setHint(hint);
        e.setHintTextColor(MUTED);
        e.setTextColor(TEXT);
        e.setSingleLine(true);
        if (password) e.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(52));
        lp.setMargins(0, dp(8), 0, 0);
        e.setLayoutParams(lp);
        return e;
    }

    private Button button(String text, int bg, int fg) {
        Button b = new Button(this);
        b.setText(text);
        b.setTextColor(fg);
        b.setTextSize(12);
        b.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        b.setBackgroundTintList(ColorStateList.valueOf(bg));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48));
        lp.setMargins(0, dp(9), 0, 0);
        b.setLayoutParams(lp);
        return b;
    }

    private LinearLayout rowButton(String t1, int c1, View.OnClickListener l1, String t2, int c2, View.OnClickListener l2) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        Button b1 = button(t1, c1, c1 == GREEN || c1 == CYAN ? Color.BLACK : Color.WHITE);
        Button b2 = button(t2, c2, c2 == GREEN || c2 == CYAN ? Color.BLACK : Color.WHITE);
        LinearLayout.LayoutParams p1 = new LinearLayout.LayoutParams(0, dp(48), 1);
        p1.setMargins(0, dp(7), dp(4), 0);
        LinearLayout.LayoutParams p2 = new LinearLayout.LayoutParams(0, dp(48), 1);
        p2.setMargins(dp(4), dp(7), 0, 0);
        b1.setLayoutParams(p1); b2.setLayoutParams(p2);
        b1.setOnClickListener(l1); b2.setOnClickListener(l2);
        row.addView(b1); row.addView(b2);
        return row;
    }

    private int dp(int n) {
        return Math.round(n * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        if (ssh != null) ssh.disconnect();
        io.shutdownNow();
        super.onDestroy();
    }

    static class SshController {
        private final Context context;
        private final String host, user, password;
        private final int port;
        private Session session;
        private ChannelShell shell;
        private OutputStream shellIn;

        SshController(Context context, String host, int port, String user, String password) {
            this.context = context.getApplicationContext();
            this.host = host; this.port = port; this.user = user; this.password = password;
        }

        void connect() throws Exception {
            JSch jsch = new JSch();
            jsch.setHostKeyRepository(new TofuHostKeyRepository(context, host + ":" + port));
            session = jsch.getSession(user, host, port);
            session.setPassword(password);
            Properties config = new Properties();
            config.put("StrictHostKeyChecking", "yes");
            config.put("PreferredAuthentications", "password,keyboard-interactive");
            session.setConfig(config);
            session.setServerAliveInterval(15_000);
            session.setServerAliveCountMax(3);
            session.connect(15_000);
        }

        boolean isConnected() { return session != null && session.isConnected(); }

        String run(String command, long timeoutMs) throws Exception {
            if (!isConnected()) throw new Exception("SSH desconectado.");
            ChannelExec ch = (ChannelExec) session.openChannel("exec");
            ByteArrayOutputStream err = new ByteArrayOutputStream();
            ch.setCommand(command);
            ch.setInputStream(null);
            ch.setErrStream(err);
            InputStream in = ch.getInputStream();
            ch.connect(10_000);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            long start = System.currentTimeMillis();
            while (true) {
                while (in.available() > 0) {
                    int n = in.read(buf, 0, Math.min(buf.length, in.available()));
                    if (n < 0) break;
                    out.write(buf, 0, n);
                }
                if (ch.isClosed() && in.available() == 0) break;
                if (System.currentTimeMillis() - start > timeoutMs) {
                    ch.disconnect();
                    throw new Exception("Comando excedeu o tempo limite.");
                }
                Thread.sleep(80);
            }
            ch.disconnect();
            if (err.size() > 0) out.write(err.toByteArray());
            return out.toString("UTF-8");
        }

        synchronized void startShell(Consumer<String> callback) throws Exception {
            if (!isConnected()) throw new Exception("SSH desconectado.");
            if (shell != null && shell.isConnected()) return;
            shell = (ChannelShell) session.openChannel("shell");
            shell.setPty(true);
            InputStream out = shell.getInputStream();
            shellIn = shell.getOutputStream();
            shell.connect(10_000);
            Thread reader = new Thread(() -> {
                byte[] buf = new byte[2048];
                try {
                    int n;
                    while (shell != null && shell.isConnected() && (n = out.read(buf)) >= 0) {
                        if (n > 0) callback.accept(new String(buf, 0, n));
                    }
                } catch (Exception e) {
                    callback.accept("\n[terminal encerrado: " + e.getMessage() + "]\n");
                }
            }, "asenode-shell-reader");
            reader.setDaemon(true);
            reader.start();
        }

        synchronized void sendShell(String line) throws Exception {
            if (shell == null || !shell.isConnected() || shellIn == null) throw new Exception("Terminal não iniciado.");
            shellIn.write(line.getBytes("UTF-8"));
            shellIn.flush();
        }

        void uploadValidatorKey(byte[] data) throws Exception {
            if (!isConnected()) throw new Exception("SSH desconectado.");
            ChannelSftp sftp = (ChannelSftp) session.openChannel("sftp");
            sftp.connect(10_000);
            try (ByteArrayInputStream in = new ByteArrayInputStream(data)) {
                sftp.put(in, "/tmp/asentum-validator.key");
            } finally {
                sftp.disconnect();
            }
            String cmd = "mkdir -p /opt/asentum/data && " +
                    "if [ -f /opt/asentum/data/validator.key ]; then cp /opt/asentum/data/validator.key /opt/asentum/data/validator.key.asenode-backup; fi && " +
                    "install -m 600 /tmp/asentum-validator.key /opt/asentum/data/validator.key && rm -f /tmp/asentum-validator.key && " +
                    "(systemctl restart asentum-validator 2>/dev/null || true)";
            String result = run(cmd, 30_000);
            if (result.toLowerCase(Locale.ROOT).contains("permission denied")) throw new Exception("Sem permissão. Conecte como root ou um usuário com acesso a /opt/asentum.");
        }

        void disconnect() {
            try { if (shell != null) shell.disconnect(); } catch (Exception ignored) {}
            try { if (session != null) session.disconnect(); } catch (Exception ignored) {}
        }
    }

    static class TofuHostKeyRepository implements HostKeyRepository {
        private final SharedPreferences prefs;
        private final String id;

        TofuHostKeyRepository(Context c, String id) {
            this.prefs = c.getSharedPreferences("ssh_host_keys", MODE_PRIVATE);
            this.id = id;
        }

        @Override public int check(String host, byte[] key) {
            String fp = sha256(key);
            String saved = prefs.getString(id, null);
            if (saved == null) {
                prefs.edit().putString(id, fp).apply();
                return OK;
            }
            return saved.equals(fp) ? OK : CHANGED;
        }

        @Override public void add(HostKey hostkey, UserInfo ui) {}
        @Override public void remove(String host, String type) {}
        @Override public void remove(String host, String type, byte[] key) {}
        @Override public String getKnownHostsRepositoryID() { return "ASENODE TOFU"; }
        @Override public HostKey[] getHostKey() { return new HostKey[0]; }
        @Override public HostKey[] getHostKey(String host, String type) { return new HostKey[0]; }

        private static String sha256(byte[] data) {
            try {
                byte[] d = MessageDigest.getInstance("SHA-256").digest(data);
                StringBuilder sb = new StringBuilder("SHA256:");
                String b64 = android.util.Base64.encodeToString(d, android.util.Base64.NO_WRAP);
                sb.append(b64);
                return sb.toString();
            } catch (Exception e) {
                return "invalid";
            }
        }
    }
}
