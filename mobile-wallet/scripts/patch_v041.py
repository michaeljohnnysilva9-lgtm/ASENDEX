from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'

j = JAVA.read_text()
old = '''    @Override protected void onStop(){super.onStop();if(walletUnlocked&&signerReady){signerWebView.evaluateJavascript("window.__signerRequest('autolock','lock','{}');",null);walletUnlocked=false;}}\n    @Override protected void onStart(){super.onStart();if(prefs!=null&&prefs.contains("vault")&&!walletUnlocked&&appWebView!=null){if(browserContainer!=null)browserContainer.setVisibility(View.GONE);appWebView.loadUrl("file:///android_asset/index.html");appWebView.bringToFront();}}\n'''
new = '''    // ASENDEX Wallet 0.4.1: switching to another Android app must not lock or reload the wallet.\n    // The unlocked session and current WebView/browser state remain in memory until the user\n    // explicitly chooses "Bloquear wallet" or Android terminates the process.\n    @Override protected void onStop(){super.onStop();}\n    @Override protected void onStart(){super.onStart();}\n'''
if old not in j:
    if new in j:
        print('ASENDEX Wallet Mobile v0.4.1 lifecycle patch already applied')
    else:
        raise SystemExit('patch target not found: immediate background autolock lifecycle')
else:
    JAVA.write_text(j.replace(old, new, 1))
    print('ASENDEX Wallet Mobile v0.4.1 lifecycle patch applied')
