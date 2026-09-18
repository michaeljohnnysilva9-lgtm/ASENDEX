package com.asentum.wallet;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int BG = Color.rgb(4, 7, 6);
    private static final int PANEL = Color.rgb(8, 16, 12);
    private static final int GREEN = Color.rgb(64, 255, 136);
    private static final String PREFS = "asentum_wallet";
    private static final String RPC = "https://testnet.asentum.com";

    private SharedPreferences prefs;
    private FrameLayout root;
    private WebView appWebView;
    private WebView signerWebView;
    private WebView dappWebView;
    private LinearLayout browserContainer;
    private EditText addressBar;
    private boolean signerReady = false;
    private boolean walletUnlocked = false;
    private int signerSeq = 1;

    private static class Pending {
        String channel;
        String requestId;
        String method;
        String origin;
        Pending(String c, String r, String m, String o) { channel=c; requestId=r; method=m; origin=o; }
    }
    private final Map<String, Pending> signerPending = new HashMap<>();
    private final List<Runnable> signerQueue = new ArrayList<>();

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        WebView.setWebContentsDebuggingEnabled(false);
        buildUi();
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void buildUi() {
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);

        appWebView = new WebView(this);
        configureLocalWebView(appWebView);
        appWebView.addJavascriptInterface(new AppBridge(), "AppBridge");
        root.addView(appWebView, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        signerWebView = new WebView(this);
        configureLocalWebView(signerWebView);
        signerWebView.addJavascriptInterface(new SignerBridge(), "SignerNative");
        FrameLayout.LayoutParams signerLp = new FrameLayout.LayoutParams(2, 2);
        signerLp.gravity = Gravity.BOTTOM | Gravity.END;
        signerWebView.setVisibility(View.INVISIBLE);
        root.addView(signerWebView, signerLp);

        buildBrowser();
        signerWebView.loadUrl("file:///android_asset/signer.html");
        appWebView.loadUrl("file:///android_asset/index.html");
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void configureLocalWebView(WebView v) {
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.setSafeBrowsingEnabled(true);
        v.setBackgroundColor(BG);
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    private void buildBrowser() {
        browserContainer = new LinearLayout(this);
        browserContainer.setOrientation(LinearLayout.VERTICAL);
        browserContainer.setBackgroundColor(BG);
        browserContainer.setVisibility(View.GONE);

        LinearLayout bar = new LinearLayout(this);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(8), dp(8), dp(8), dp(8));
        bar.setBackgroundColor(PANEL);

        TextView back = browserButton("‹");
        TextView forward = browserButton("›");
        TextView reload = browserButton("↻");
        TextView close = browserButton("×");
        addressBar = new EditText(this);
        addressBar.setSingleLine(true);
        addressBar.setTextColor(Color.WHITE);
        addressBar.setHintTextColor(Color.rgb(105, 130, 115));
        addressBar.setHint("https://...");
        addressBar.setTextSize(13);
        addressBar.setPadding(dp(12), 0, dp(12), 0);
        addressBar.setBackgroundColor(Color.rgb(7, 15, 11));
        LinearLayout.LayoutParams addressLp = new LinearLayout.LayoutParams(0, dp(44), 1f);
        addressLp.setMargins(dp(5),0,dp(5),0);

        back.setOnClickListener(v -> { if (dappWebView.canGoBack()) dappWebView.goBack(); });
        forward.setOnClickListener(v -> { if (dappWebView.canGoForward()) dappWebView.goForward(); });
        reload.setOnClickListener(v -> dappWebView.reload());
        close.setOnClickListener(v -> closeBrowser());
        addressBar.setOnEditorActionListener((v, actionId, event) -> { navigateAddress(addressBar.getText().toString()); return true; });

        bar.addView(back); bar.addView(forward); bar.addView(addressBar, addressLp); bar.addView(reload); bar.addView(close);
        browserContainer.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(60)));

        dappWebView = new WebView(this);
        WebSettings s = dappWebView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " AsentumWallet/0.1.0");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) s.setSafeBrowsingEnabled(true);
        dappWebView.setBackgroundColor(BG);
        dappWebView.addJavascriptInterface(new DappBridge(), "AsentumNative");
        installProviderScript();
        dappWebView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                String scheme = u.getScheme();
                return !("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme));
            }
            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                addressBar.setText(url);
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) view.evaluateJavascript(PROVIDER_JS, null);
                if (isHttpUrl(url)) saveRecent(url);
            }
        });
        browserContainer.addView(dappWebView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        root.addView(browserContainer, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private TextView browserButton(String label) {
        TextView t = new TextView(this);
        t.setText(label); t.setTextColor(GREEN); t.setTextSize(26); t.setGravity(Gravity.CENTER);
        t.setBackgroundColor(Color.TRANSPARENT);
        t.setLayoutParams(new LinearLayout.LayoutParams(dp(42), dp(44)));
        return t;
    }

    private static final String PROVIDER_JS = "(function(){if(window.asentum&&window.asentum.__mobile)return;"+
        "var seq=1,p={};function q(method,params){return new Promise(function(res,rej){var id=String(seq++);p[id]={res:res,rej:rej};AsentumNative.request(id,JSON.stringify({method:method,params:params||{}}));});}"+
        "window.__asentumNativeResolve=function(id,ok,json){var x=p[String(id)];if(!x)return;delete p[String(id)];var d={};try{d=json?JSON.parse(json):{};}catch(e){d={message:json};}if(ok)x.res(d);else x.rej(new Error(d.message||'Wallet request rejected'));};"+
        "window.asentum={__mobile:true,getAddress:function(){return q('getAddress').then(function(r){return r.address;});},connect:function(){return q('connect');},disconnect:function(){return q('disconnect').then(function(){return;});},sendTransfer:function(v){return q('sendTransfer',v);},callContract:function(v){return q('callContract',v);},viewContract:function(v){return q('viewContract',v);},deployContract:function(v){return q('deployContract',v);}};"+
        "try{window.dispatchEvent(new Event('asentum#initialized'));}catch(e){} })();";

    private void installProviderScript() {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(dappWebView, PROVIDER_JS, Collections.singleton("*"));
        }
    }

    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }
    private boolean isHttpUrl(String url) { return url != null && (url.startsWith("https://") || url.startsWith("http://")); }

    private void navigateAddress(String raw) {
        String u = raw == null ? "" : raw.trim();
        if (u.isEmpty()) return;
        if (!u.matches("(?i)^https?://.*")) u = "https://" + u;
        try {
            Uri uri = Uri.parse(u);
            if (uri.getHost() == null) throw new Exception();
            dappWebView.loadUrl(u);
        } catch (Exception e) { Toast.makeText(this, "URL inválida", Toast.LENGTH_SHORT).show(); }
    }

    private void openBrowser(String url) {
        browserContainer.setVisibility(View.VISIBLE);
        browserContainer.bringToFront();
        navigateAddress(url);
    }
    private void closeBrowser() {
        browserContainer.setVisibility(View.GONE);
        appWebView.bringToFront();
        appWebView.evaluateJavascript("loadRecents();loadActivity();", null);
    }

    private String originOf(String url) {
        try {
            Uri u = Uri.parse(url);
            if (u.getScheme() == null || u.getHost() == null) return "unknown";
            String p = u.getPort() > 0 ? ":" + u.getPort() : "";
            return u.getScheme() + "://" + u.getHost() + p;
        } catch (Exception e) { return "unknown"; }
    }

    private boolean isOriginAllowed(String origin) { return prefs.getBoolean("origin_" + origin, false); }
    private void setOriginAllowed(String origin, boolean yes) { prefs.edit().putBoolean("origin_" + origin, yes).apply(); }

    private void approveConnect(String id, String origin) {
        if (!walletUnlocked) { returnDapp(id,false,error("Carteira bloqueada. Abra o app e desbloqueie primeiro.")); return; }
        if (isOriginAllowed(origin)) { returnDapp(id,true,new JSONObjectBuilder().put("address", savedAddress()).build()); return; }
        AlertDialog d = new AlertDialog.Builder(this)
            .setTitle("Conectar carteira")
            .setMessage(origin + "\n\nEste dApp poderá ver seu endereço e solicitar transações. Cada transação continuará exigindo confirmação.")
            .setNegativeButton("Cancelar", (x,w) -> returnDapp(id,false,error("Conexão rejeitada")))
            .setPositiveButton("Conectar", (x,w) -> { setOriginAllowed(origin,true); returnDapp(id,true,new JSONObjectBuilder().put("address",savedAddress()).build()); })
            .create();
        d.setOnShowListener(x -> d.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(GREEN));
        d.show();
    }

    private void approveTransaction(String id, String method, JSONObject params, String origin, String channel) {
        if (!walletUnlocked) { returnChannel(channel,id,false,error("Carteira bloqueada")); return; }
        StringBuilder msg = new StringBuilder();
        if (origin != null) msg.append(origin).append("\n\n");
        if ("sendTransfer".equals(method)) {
            msg.append("Enviar ").append(params.optString("amount","?")).append(" ASE\nPara: ").append(params.optString("to","?"));
        } else if ("callContract".equals(method)) {
            msg.append("Chamar contrato\n").append(params.optString("to","?")).append("\nMétodo: ").append(params.optString("method","?"));
        } else if ("deployContract".equals(method)) {
            msg.append("Implantar novo contrato Asentum\nCódigo: ").append(params.optString("source","").length()).append(" caracteres");
        }
        msg.append("\n\nRede: Asentum Testnet\n").append(RPC);
        AlertDialog d = new AlertDialog.Builder(this)
            .setTitle("Confirmar solicitação")
            .setMessage(msg.toString())
            .setNegativeButton("Cancelar", (x,w) -> returnChannel(channel,id,false,error("Transação rejeitada")))
            .setPositiveButton("Confirmar", (x,w) -> dispatchSigner(channel,id,method,params,origin))
            .create();
        d.setOnShowListener(x -> d.getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(GREEN));
        d.show();
    }

    private void handleDapp(String id, JSONObject req) {
        String method = req.optString("method");
        JSONObject p = req.optJSONObject("params"); if (p == null) p = new JSONObject();
        String origin = originOf(dappWebView.getUrl());
        switch (method) {
            case "connect": approveConnect(id, origin); break;
            case "disconnect": setOriginAllowed(origin,false); returnDapp(id,true,new JSONObject()); break;
            case "getAddress":
                if (!walletUnlocked || !isOriginAllowed(origin)) returnDapp(id,false,error("dApp não conectado"));
                else returnDapp(id,true,new JSONObjectBuilder().put("address",savedAddress()).build());
                break;
            case "viewContract":
                if (!walletUnlocked || !isOriginAllowed(origin)) returnDapp(id,false,error("dApp não conectado"));
                else dispatchSigner("dapp",id,method,p,origin);
                break;
            case "sendTransfer": case "callContract": case "deployContract":
                if (!isOriginAllowed(origin)) { returnDapp(id,false,error("Conecte a carteira antes")); return; }
                approveTransaction(id,method,p,origin,"dapp");
                break;
            default: returnDapp(id,false,error("Método não suportado: " + method));
        }
    }

    private void handleApp(String id, JSONObject req) {
        String method = req.optString("method");
        JSONObject p = req.optJSONObject("params"); if (p == null) p = new JSONObject();
        switch (method) {
            case "bootstrap":
                JSONObject b = new JSONObjectBuilder().put("hasVault",prefs.contains("vault")).put("address",savedAddress()).put("unlocked",walletUnlocked).build();
                returnApp(id,true,b); break;
            case "getRecents": returnApp(id,true,new JSONObjectBuilder().putRaw("items",readArray("recents")).build()); break;
            case "clearRecents": prefs.edit().remove("recents").apply(); returnApp(id,true,new JSONObject()); break;
            case "getActivity": returnApp(id,true,new JSONObjectBuilder().putRaw("items",readArray("activity")).build()); break;
            case "copyAddress":
                ((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Asentum address",savedAddress()));
                Toast.makeText(this,"Endereço copiado",Toast.LENGTH_SHORT).show(); returnApp(id,true,new JSONObject()); break;
            case "openBrowser": openBrowser(p.optString("url")); returnApp(id,true,new JSONObject()); break;
            case "sendTransfer": approveTransaction(id,method,p,null,"app"); break;
            case "createWallet": case "importSeed": case "importKeys": case "unlock": case "lock": case "state": case "getBalance":
                dispatchSigner("app",id,method,p,null); break;
            default: returnApp(id,false,error("Método não suportado: " + method));
        }
    }

    private void dispatchSigner(String channel, String requestId, String method, JSONObject payload, String origin) {
        Runnable r = () -> {
            String sid = "s" + (signerSeq++);
            signerPending.put(sid,new Pending(channel,requestId,method,origin));
            String js = "window.__signerRequest(" + JSONObject.quote(sid) + "," + JSONObject.quote(method) + "," + JSONObject.quote(payload.toString()) + ");";
            signerWebView.evaluateJavascript(js,null);
        };
        if (signerReady) r.run(); else signerQueue.add(r);
    }

    private void signerComplete(String sid, boolean ok, String json) {
        Pending p = signerPending.remove(sid);
        if (p == null) return;
        JSONObject result;
        try { result = new JSONObject(json == null || json.isEmpty() ? "{}" : json); } catch(Exception e) { result = error("Resposta inválida do signer"); ok=false; }
        if (ok && ("unlock".equals(p.method)||"importSeed".equals(p.method)||"importKeys".equals(p.method)||"createWallet".equals(p.method))) walletUnlocked=true;
        if (ok && "lock".equals(p.method)) walletUnlocked=false;
        if (ok && ("sendTransfer".equals(p.method)||"callContract".equals(p.method)||"deployContract".equals(p.method))) {
            String hash = result.optString("txHash","");
            if (!hash.isEmpty()) saveActivity(p.method,hash,p.origin);
        }
        returnChannel(p.channel,p.requestId,ok,result);
    }

    private void returnChannel(String channel,String id,boolean ok,JSONObject obj) { if ("dapp".equals(channel)) returnDapp(id,ok,obj); else returnApp(id,ok,obj); }
    private void returnApp(String id, boolean ok, JSONObject obj) {
        String js = "window.__appResolve("+JSONObject.quote(id)+","+(ok?"true":"false")+","+JSONObject.quote(obj.toString())+");";
        appWebView.evaluateJavascript(js,null);
    }
    private void returnDapp(String id, boolean ok, JSONObject obj) {
        if (dappWebView == null) return;
        String js = "window.__asentumNativeResolve("+JSONObject.quote(id)+","+(ok?"true":"false")+","+JSONObject.quote(obj.toString())+");";
        dappWebView.evaluateJavascript(js,null);
    }

    private JSONObject error(String m) { return new JSONObjectBuilder().put("message",m).build(); }
    private String savedAddress() { return prefs.getString("wallet_address",""); }

    private JSONArray readArray(String key) {
        try { return new JSONArray(prefs.getString(key,"[]")); } catch(Exception e) { return new JSONArray(); }
    }
    private void writeArray(String key, JSONArray a) { prefs.edit().putString(key,a.toString()).apply(); }

    private void saveRecent(String url) {
        JSONArray old = readArray("recents"), fresh = new JSONArray();
        try {
            JSONObject n = new JSONObject(); n.put("url",url); n.put("time",System.currentTimeMillis()); fresh.put(n);
            for (int i=0;i<old.length() && fresh.length()<20;i++) {
                JSONObject x=old.optJSONObject(i); if(x!=null && !url.equals(x.optString("url"))) fresh.put(x);
            }
            writeArray("recents",fresh);
        } catch(Exception ignored) {}
    }
    private void saveActivity(String method,String hash,String origin) {
        JSONArray old=readArray("activity"), fresh=new JSONArray();
        try {
            JSONObject n=new JSONObject(); n.put("method",method); n.put("label",labelFor(method)); n.put("txHash",hash); n.put("origin",origin==null?"Asentum Wallet":origin); n.put("time",System.currentTimeMillis()); fresh.put(n);
            for(int i=0;i<old.length()&&fresh.length()<50;i++) fresh.put(old.opt(i));
            writeArray("activity",fresh);
        } catch(Exception ignored) {}
    }
    private String labelFor(String m){ if("sendTransfer".equals(m))return "Transferência ASE"; if("callContract".equals(m))return "Interação com contrato"; if("deployContract".equals(m))return "Deploy de contrato"; return m; }

    public class AppBridge {
        @JavascriptInterface public void request(String id, String raw) {
            runOnUiThread(() -> { try { handleApp(id,new JSONObject(raw)); } catch(Exception e){ returnApp(id,false,error(e.getMessage())); } });
        }
    }
    public class DappBridge {
        @JavascriptInterface public void request(String id, String raw) {
            runOnUiThread(() -> { try { handleDapp(id,new JSONObject(raw)); } catch(Exception e){ returnDapp(id,false,error(e.getMessage())); } });
        }
    }
    public class SignerBridge {
        @JavascriptInterface public void ready() {
            runOnUiThread(() -> { signerReady=true; for(Runnable r:new ArrayList<>(signerQueue)) r.run(); signerQueue.clear(); });
        }
        @JavascriptInterface public String loadVault() { return prefs.getString("vault",""); }
        @JavascriptInterface public void saveVault(String raw) { prefs.edit().putString("vault",raw).apply(); }
        @JavascriptInterface public void saveAddress(String address) { prefs.edit().putString("wallet_address",address).apply(); }
        @JavascriptInterface public void complete(String id, boolean ok, String json) { runOnUiThread(() -> signerComplete(id,ok,json)); }
    }

    private static class JSONObjectBuilder {
        private final JSONObject o=new JSONObject();
        JSONObjectBuilder put(String k,Object v){try{o.put(k,v);}catch(JSONException ignored){}return this;}
        JSONObjectBuilder putRaw(String k,Object v){return put(k,v);}
        JSONObject build(){return o;}
    }

    @Override public void onBackPressed() {
        if (browserContainer != null && browserContainer.getVisibility()==View.VISIBLE) {
            if (dappWebView.canGoBack()) dappWebView.goBack(); else closeBrowser();
        } else super.onBackPressed();
    }

    @Override protected void onStop() {
        super.onStop();
        if (walletUnlocked && signerReady) {
            signerWebView.evaluateJavascript("window.__signerRequest('autolock','lock','{}');",null);
            walletUnlocked=false;
        }
    }

    @Override protected void onStart() {
        super.onStart();
        if (prefs.contains("vault") && !walletUnlocked && appWebView != null) {
            if (browserContainer != null) browserContainer.setVisibility(View.GONE);
            appWebView.loadUrl("file:///android_asset/index.html");
            appWebView.bringToFront();
        }
    }
}
