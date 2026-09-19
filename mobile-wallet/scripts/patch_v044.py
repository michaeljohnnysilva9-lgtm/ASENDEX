from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
j = JAVA.read_text()

# Imports required by a production-style dApp browser.
if 'import android.content.Intent;' not in j:
    j = j.replace('import android.content.ClipboardManager;\n', 'import android.content.ClipboardManager;\nimport android.content.Intent;\n')
if 'import android.webkit.CookieManager;' not in j:
    j = j.replace('import android.webkit.JavascriptInterface;\n', 'import android.webkit.CookieManager;\nimport android.webkit.JavascriptInterface;\n')
if 'import android.webkit.WebResourceError;' not in j:
    j = j.replace('import android.webkit.WebResourceRequest;\n', 'import android.webkit.WebResourceRequest;\nimport android.webkit.WebResourceError;\n')

old = '''        dappWebView = new WebView(this); WebSettings s=dappWebView.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSupportMultipleWindows(false); s.setUserAgentString(s.getUserAgentString()+" ASENDEXWalletMobile/0.3.1 AsentumExtensionCompatible/1.0"); if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)s.setSafeBrowsingEnabled(true); dappWebView.setBackgroundColor(BG);\n        dappWebView.addJavascriptInterface(new DappBridge(),"AsentumNative"); installProviderScript();\n        dappWebView.setWebViewClient(new WebViewClient(){\n            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){String scheme=request.getUrl().getScheme();return !("https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme));}\n            @Override public void onPageFinished(WebView view,String url){super.onPageFinished(view,url);addressBar.setText(url);if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))view.evaluateJavascript(PROVIDER_JS,null);if(isHttpUrl(url))saveRecent(url);}\n        });\n'''

new = '''        dappWebView = new WebView(this);\n        WebSettings s=dappWebView.getSettings();\n        s.setJavaScriptEnabled(true);\n        s.setDomStorageEnabled(true);\n        s.setDatabaseEnabled(true);\n        s.setLoadsImagesAutomatically(true);\n        s.setLoadWithOverviewMode(true);\n        s.setUseWideViewPort(true);\n        s.setAllowFileAccess(false);\n        s.setAllowContentAccess(false);\n        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);\n        s.setJavaScriptCanOpenWindowsAutomatically(false);\n        s.setSupportMultipleWindows(false);\n        s.setMediaPlaybackRequiresUserGesture(true);\n        s.setCacheMode(WebSettings.LOAD_DEFAULT);\n        // Present as a normal mobile Chromium browser instead of exposing the Android WebView\n        // `wv` marker. Several Web3 frontends apply reduced/blocked behavior to embedded WebViews.\n        String ua=s.getUserAgentString().replace("; wv","").replace("Version/4.0 ","");\n        s.setUserAgentString(ua+" ASENDEXWalletMobile/0.4.4 AsentumExtensionCompatible/1.1");\n        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)s.setSafeBrowsingEnabled(true);\n        CookieManager cm=CookieManager.getInstance();\n        cm.setAcceptCookie(true);\n        cm.setAcceptThirdPartyCookies(dappWebView,true);\n        dappWebView.setBackgroundColor(BG);\n        dappWebView.setLayerType(View.LAYER_TYPE_HARDWARE,null);\n        dappWebView.addJavascriptInterface(new DappBridge(),"AsentumNative"); installProviderScript();\n        dappWebView.setWebViewClient(new WebViewClient(){\n            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request){\n                Uri uri=request.getUrl(); String scheme=uri.getScheme();\n                if("https".equalsIgnoreCase(scheme)||"http".equalsIgnoreCase(scheme)) return false;\n                return openExternalUri(uri.toString());\n            }\n            @Override public void onPageFinished(WebView view,String url){\n                super.onPageFinished(view,url); addressBar.setText(url); cm.flush();\n                if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))view.evaluateJavascript(PROVIDER_JS,null);\n                if(isHttpUrl(url))saveRecent(url);\n            }\n            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error){\n                super.onReceivedError(view,request,error);\n                if(request.isForMainFrame()) Toast.makeText(MainActivity.this,"Falha ao abrir dApp: "+error.getDescription(),Toast.LENGTH_LONG).show();\n            }\n        });\n'''

if old not in j:
    if 'ASENDEXWalletMobile/0.4.4' not in j:
        raise SystemExit('patch target not found: dApp WebView configuration')
else:
    j = j.replace(old, new, 1)

anchor = '''    private TextView browserButton(String label){TextView t=new TextView(this);t.setText(label);t.setTextColor(CYAN);t.setTextSize(24);t.setGravity(Gravity.CENTER);t.setBackgroundColor(Color.TRANSPARENT);t.setLayoutParams(new LinearLayout.LayoutParams(dp(38),dp(44)));return t;}\n'''
extra = '''    private boolean openExternalUri(String raw){\n        try {\n            Intent i;\n            if(raw!=null && raw.startsWith("intent:")) i=Intent.parseUri(raw,Intent.URI_INTENT_SCHEME);\n            else i=new Intent(Intent.ACTION_VIEW,Uri.parse(raw));\n            i.addCategory(Intent.CATEGORY_BROWSABLE);\n            startActivity(i);\n            return true;\n        } catch(Exception e) {\n            Toast.makeText(this,"Nenhum aplicativo compatível para abrir este link",Toast.LENGTH_SHORT).show();\n            return true;\n        }\n    }\n'''
if extra not in j:
    if anchor not in j:
        raise SystemExit('patch target not found: browserButton anchor')
    j = j.replace(anchor, anchor + extra, 1)

JAVA.write_text(j)
print('ASENDEX Wallet Mobile v0.4.4 dApp browser compatibility patch applied')
