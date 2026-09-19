from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
j = JAVA.read_text()

# Production-style dApp browser settings. patch_v040 already installs Intent/deep-link
# routing, so this patch only upgrades Chromium/WebView compatibility and storage.
if 'import android.webkit.CookieManager;' not in j:
    j = j.replace('import android.webkit.JavascriptInterface;\n', 'import android.webkit.CookieManager;\nimport android.webkit.JavascriptInterface;\n')

old = '''        dappWebView = new WebView(this); WebSettings s=dappWebView.getSettings(); s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setAllowFileAccess(false); s.setAllowContentAccess(false); s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW); s.setJavaScriptCanOpenWindowsAutomatically(false); s.setSupportMultipleWindows(false); s.setUserAgentString(s.getUserAgentString()+" ASENDEXWalletMobile/0.4.0 AsentumExtensionCompatible/1.0"); if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)s.setSafeBrowsingEnabled(true); dappWebView.setBackgroundColor(BG);\n'''

new = '''        dappWebView = new WebView(this);\n        WebSettings s=dappWebView.getSettings();\n        s.setJavaScriptEnabled(true);\n        s.setDomStorageEnabled(true);\n        s.setDatabaseEnabled(true);\n        s.setLoadsImagesAutomatically(true);\n        s.setLoadWithOverviewMode(true);\n        s.setUseWideViewPort(true);\n        s.setAllowFileAccess(false);\n        s.setAllowContentAccess(false);\n        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);\n        s.setJavaScriptCanOpenWindowsAutomatically(false);\n        s.setSupportMultipleWindows(false);\n        s.setMediaPlaybackRequiresUserGesture(true);\n        s.setCacheMode(WebSettings.LOAD_DEFAULT);\n        // Behave like a normal mobile Chromium browser instead of advertising the\n        // Android WebView `wv` marker. Some modern Web3 sites restrict embedded UAs.\n        String ua=s.getUserAgentString().replace("; wv","").replace("Version/4.0 ","");\n        s.setUserAgentString(ua+" ASENDEXWalletMobile/0.4.4 AsentumExtensionCompatible/1.1");\n        if(Build.VERSION.SDK_INT>=Build.VERSION_CODES.O)s.setSafeBrowsingEnabled(true);\n        CookieManager cm=CookieManager.getInstance();\n        cm.setAcceptCookie(true);\n        cm.setAcceptThirdPartyCookies(dappWebView,true);\n        dappWebView.setBackgroundColor(BG);\n        dappWebView.setLayerType(View.LAYER_TYPE_HARDWARE,null);\n'''

if old in j:
    j = j.replace(old, new, 1)
elif 'ASENDEXWalletMobile/0.4.4' not in j:
    raise SystemExit('patch target not found: post-v0.4.0 dApp WebView configuration')

# Flush dApp cookie state after successful page loads, while preserving the provider
# fallback + auto-connect logic installed by earlier patches.
needle = 'super.onPageFinished(view,url);addressBar.setText(url);'
replacement = 'super.onPageFinished(view,url);CookieManager.getInstance().flush();addressBar.setText(url);'
if needle in j:
    j = j.replace(needle, replacement, 1)
elif replacement not in j:
    raise SystemExit('patch target not found: onPageFinished cookie flush')

JAVA.write_text(j)
print('ASENDEX Wallet Mobile v0.4.4 dApp browser compatibility patch applied')
