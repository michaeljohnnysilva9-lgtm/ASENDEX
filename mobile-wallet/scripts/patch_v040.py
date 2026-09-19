from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
MANIFEST = ROOT / 'mobile-wallet/app/src/main/AndroidManifest.xml'
APP = ROOT / 'mobile-wallet/web/src/app.js'
INDEX = ROOT / 'mobile-wallet/web/index.html'


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f'patch target not found: {label}')
    return text.replace(old, new, 1)

# --- Android native browser: ASENDEX deep link + external wallet handoff ---
j = JAVA.read_text()
j = replace_once(j,
    'import android.content.ClipData;\n',
    'import android.content.ClipData;\nimport android.content.ActivityNotFoundException;\nimport android.content.Intent;\n',
    'android imports')

j = replace_once(j,
    'private boolean signerReady = false, walletUnlocked = false;\n',
    'private boolean signerReady = false, walletUnlocked = false;\n    private String autoConnectOrigin = null;\n',
    'auto connect field')

j = replace_once(j,
    '        buildUi();\n    }\n',
    '        buildUi();\n        handleIncomingIntent(getIntent());\n    }\n\n    @Override protected void onNewIntent(Intent intent) {\n        super.onNewIntent(intent);\n        setIntent(intent);\n        handleIncomingIntent(intent);\n    }\n',
    'incoming intent')

j = j.replace('ASENDEXWalletMobile/0.3.1', 'ASENDEXWalletMobile/0.4.0')
j = j.replace("version:'0.3.1'", "version:'0.4.0'")

old_override = '@Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){String scheme=request.getUrl().getScheme();return !("https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme));}'
new_override = '@Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){return handleExternalWalletUrl(request.getUrl());}'
j = replace_once(j, old_override, new_override, 'external wallet URL router')

old_finished = '@Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);addressBar.setText(url);if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))view.evaluateJavascript(PROVIDER_JS,null);if(isHttpUrl(url))saveRecent(url);}'
new_finished = '@Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);addressBar.setText(url);if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))view.evaluateJavascript(PROVIDER_JS,null);if(isHttpUrl(url))saveRecent(url);String currentOrigin=originOf(url);if(walletUnlocked&&autoConnectOrigin!=null&&autoConnectOrigin.equals(currentOrigin)){setOriginAllowed(currentOrigin,true);autoConnectOrigin=null;view.postDelayed(()->installCompatSession(),350);}}'
j = replace_once(j, old_finished, new_finished, 'auto connect dapp')

old_long = 'connect.setOnLongClickListener(v->{Toast.makeText(this,"Conectar este dApp como extensão Asentum",Toast.LENGTH_SHORT).show();return true;});'
new_long = 'connect.setOnLongClickListener(v->{showWalletHandoffMenu();return true;});'
j = replace_once(j, old_long, new_long, 'wallet chooser long press')

marker = '    private TextView browserButton(String label)'
helpers = r'''    private boolean handleExternalWalletUrl(Uri uri) {
        if (uri == null) return true;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if ("http".equals(scheme) || "https".equals(scheme)) return false;
        if ("metamask".equals(scheme) || "okx".equals(scheme) || "wc".equals(scheme) || "intent".equals(scheme)) {
            launchExternalUri(uri.toString());
            return true;
        }
        Toast.makeText(this, "Link externo bloqueado: " + scheme, Toast.LENGTH_SHORT).show();
        return true;
    }

    private void launchExternalUri(String raw) {
        try {
            Intent intent = raw.startsWith("intent:")
                ? Intent.parseUri(raw, Intent.URI_INTENT_SCHEME)
                : new Intent(Intent.ACTION_VIEW, Uri.parse(raw));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Wallet externa não instalada", Toast.LENGTH_LONG).show();
        } catch (Exception e) {
            Toast.makeText(this, "Não foi possível abrir a wallet externa", Toast.LENGTH_LONG).show();
        }
    }

    private void showWalletHandoffMenu() {
        if (dappWebView == null || dappWebView.getUrl() == null) return;
        final String current = dappWebView.getUrl();
        String[] items = {"ASENDEX Wallet · Asentum nativa", "MetaMask · abrir dApp externamente", "OKX Wallet · aguardar deep link do dApp"};
        new AlertDialog.Builder(this)
            .setTitle("Escolher wallet")
            .setItems(items, (d, which) -> {
                if (which == 0) connectCurrentDappCompat();
                else if (which == 1) {
                    String clean = current.replaceFirst("(?i)^https?://", "");
                    launchExternalUri("https://metamask.app.link/dapp/" + clean);
                } else {
                    Toast.makeText(this, "Quando o dApp emitir o link OKX/WalletConnect, a ASENDEX Wallet abrirá o app automaticamente.", Toast.LENGTH_LONG).show();
                }
            }).show();
    }

    private void openBrowserConnected(String url) {
        if (!walletUnlocked) {
            Toast.makeText(this, "Desbloqueie a wallet primeiro", Toast.LENGTH_SHORT).show();
            return;
        }
        String origin = originOf(url);
        if (!"unknown".equals(origin)) autoConnectOrigin = origin;
        openBrowser(url);
    }

    private void handleIncomingIntent(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        if (!"asendex".equalsIgnoreCase(data.getScheme())) return;
        String target = data.getQueryParameter("url");
        if (target != null && isHttpUrl(target)) {
            root.postDelayed(() -> openBrowser(target), 350);
        }
    }

'''
if helpers not in j:
    if marker not in j: raise SystemExit('patch target not found: java helper marker')
    j = j.replace(marker, helpers + marker, 1)

old_case = 'case "openBrowser":openBrowser(p.optString("url"));returnApp(id,true,new JSONObject());break;'
new_case = 'case "openBrowser":openBrowser(p.optString("url"));returnApp(id,true,new JSONObject());break;case "openDappConnected":openBrowserConnected(p.optString("url"));returnApp(id,true,new JSONObject());break;'
j = replace_once(j, old_case, new_case, 'open connected dapp app bridge')
JAVA.write_text(j)

# --- Manifest: app-to-app invocation and visibility for external wallet schemes ---
m = MANIFEST.read_text()
queries = '''    <queries>\n        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="metamask" /></intent>\n        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="okx" /></intent>\n        <intent><action android:name="android.intent.action.VIEW" /><data android:scheme="wc" /></intent>\n    </queries>\n\n'''
if '<queries>' not in m:
    m = m.replace('\n    <application', '\n' + queries + '    <application', 1)

deep_filter = '''            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="asendex" android:host="open" />\n            </intent-filter>\n'''
launcher_end = '''            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n'''
if 'android:scheme="asendex"' not in m:
    m = m.replace(launcher_end, launcher_end + deep_filter, 1)
MANIFEST.write_text(m)

# --- Mobile UI: native swap is already directly signed by the unlocked local wallet.
# Add explicit auto-connected status + liquidity entry point routed through the wallet browser. ---
a = APP.read_text()
liquidity_fn = '''\nasync function openLiquidity(){\n try{\n   if(!address){const s=await bridge('state');address=s.address||'';}\n   if(!address)throw new Error('Wallet bloqueada');\n   toast('Abrindo Auras Pools com ASENDEX Wallet conectada');\n   await bridge('openDappConnected',{url:'https://www.auras.finance/pools'});\n }catch(e){toast('Não foi possível abrir Pools: '+e.message);}\n}\n'''
if 'async function openLiquidity()' not in a:
    needle='async function searchContract()'
    if needle not in a: raise SystemExit('patch target not found: searchContract')
    a=a.replace(needle,liquidity_fn+'\n'+needle,1)

a = a.replace("$('receiveAddress').textContent=address;renderSecurity();", "$('receiveAddress').textContent=address;if($('nativeSwapWallet'))$('nativeSwapWallet').textContent='AUTO · '+short(address);renderSecurity();", 1)

expose='window.openLiquidity=openLiquidity;'
if expose not in a:
    needle='window.openExplorer=openExplorer;'
    if needle not in a: raise SystemExit('patch target not found: window exports')
    a=a.replace(needle,needle+expose,1)
APP.write_text(a)

# --- HTML additions ---
h = INDEX.read_text()
h = h.replace('ASENDEX WALLET MOBILE 0.2.0-beta.', 'ASENDEX WALLET MOBILE 0.4.0-beta.')
h = h.replace('ASENDEX WALLET MOBILE 0.3.2-beta.', 'ASENDEX WALLET MOBILE 0.4.0-beta.')
h = h.replace('ASENDEX WALLET MOBILE 0.3.3-beta.', 'ASENDEX WALLET MOBILE 0.4.0-beta.')

swap_title='<div class="sectionTitle"><h2 style="font-size:22px">Swap ASENDEX</h2><span id="networkBadge" class="statusPill">VERIFICANDO</span></div>'
new_title='<div class="sectionTitle"><h2 style="font-size:22px">Swap ASENDEX</h2><div style="display:flex;gap:6px;align-items:center"><span id="nativeSwapWallet" class="statusPill ok">WALLET · AUTO</span><span id="networkBadge" class="statusPill">VERIFICANDO</span></div></div>'
if swap_title in h: h=h.replace(swap_title,new_title,1)

liq_card='''\n<div class="sectionTitle"><h2>Liquidity & Pools</h2><span class="beta">AURAS NATIVE AMM</span></div><div class="card searchCard"><div class="name">Criar pool ou adicionar liquidez</div><div class="notice">Use TOKEN + ASE, escolha o fee tier e assine com a ASENDEX Wallet já desbloqueada. As transações continuam exigindo sua confirmação.</div><button class="primary" onclick="openLiquidity()">Criar Pool / Add Liquidity</button></div>\n'''
if 'Criar Pool / Add Liquidity' not in h:
    marker='<div class="sectionTitle"><h2>Adicionar token</h2>'
    if marker not in h: raise SystemExit('patch target not found: add token section')
    h=h.replace(marker,liq_card+marker,1)

h=h.replace('Nenhum dApp é pré-autorizado. Cada domínio pede conexão e cada transação exige confirmação.', 'Nenhum dApp é pré-autorizado. Cada domínio pede conexão e cada transação exige confirmação. Deep links de MetaMask, OKX e WalletConnect são entregues ao Android para abrir a wallet externa instalada quando o próprio dApp solicitar.')
INDEX.write_text(h)

print('ASENDEX Wallet Mobile v0.4.0 integration patch applied')
