from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
MANIFEST = ROOT / 'mobile-wallet/app/src/main/AndroidManifest.xml'

j = JAVA.read_text()


def replace_once(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f'patch target not found: {label}')
    return text.replace(old, new, 1)


def add_after_once(text, anchor, addition, marker, label):
    if marker in text:
        return text
    if anchor not in text:
        raise SystemExit(f'patch target not found: {label}')
    return text.replace(anchor, anchor + addition, 1)

# Orientation + configuration support for the terminal browser.
j = add_after_once(
    j,
    'import android.content.SharedPreferences;\n',
    'import android.content.pm.ActivityInfo;\nimport android.content.res.Configuration;\n',
    'import android.content.pm.ActivityInfo;',
    'orientation imports',
)

# Browser state. FIT is the default for wide terminals such as Auras.
j = add_after_once(
    j,
    '    private String autoConnectOrigin = null;\n',
    '    private boolean dappFitMode = true;\n    private boolean browserLandscape = false;\n    private TextView fitButton, rotateButton;\n',
    'private boolean dappFitMode = true;',
    'browser fit fields',
)

# Keep the wallet portrait by default. Browser can explicitly enter landscape later.
j = replace_once(
    j,
    '        super.onCreate(state);\n        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);\n',
    '        super.onCreate(state);\n        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);\n        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);\n',
    'default portrait orientation',
)

# Add professional FIT and orientation controls without sacrificing the wallet/provider button.
old_buttons = '        TextView back=browserButton("‹"), forward=browserButton("›"), connect=browserButton("◈"), reload=browserButton("↻"), close=browserButton("×");\n'
new_buttons = '        TextView back=browserButton("‹"), forward=browserButton("›"), connect=browserButton("◈"), reload=browserButton("↻"), close=browserButton("×");\n        fitButton=browserSmallButton("FIT"); rotateButton=browserButton("↔");\n        fitButton.setContentDescription("Alternar terminal entre FIT e 100%"); rotateButton.setContentDescription("Alternar orientação do navegador");\n'
j = replace_once(j, old_buttons, new_buttons, 'browser fit buttons')

old_listeners = '        reload.setOnClickListener(v->dappWebView.reload()); close.setOnClickListener(v->closeBrowser());\n'
new_listeners = '        fitButton.setOnClickListener(v->toggleFitMode());\n        fitButton.setOnLongClickListener(v->{Toast.makeText(this,"FIT mostra o terminal inteiro; 100% amplia para leitura",Toast.LENGTH_SHORT).show();return true;});\n        rotateButton.setOnClickListener(v->toggleBrowserOrientation());\n        reload.setOnClickListener(v->dappWebView.reload()); close.setOnClickListener(v->closeBrowser());\n'
j = replace_once(j, old_listeners, new_listeners, 'fit button listeners')

old_bar = '        bar.addView(back);bar.addView(forward);bar.addView(addressBar,alp);bar.addView(connect);bar.addView(reload);bar.addView(close); browserContainer.addView(bar,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));\n'
new_bar = '        bar.addView(back);bar.addView(forward);bar.addView(addressBar,alp);bar.addView(connect);bar.addView(fitButton);bar.addView(rotateButton);bar.addView(reload);bar.addView(close); browserContainer.addView(bar,new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,dp(60)));\n'
j = replace_once(j, old_bar, new_bar, 'browser toolbar controls')

# Auto-apply FIT after Auras is fully laid out. The second pass catches dynamic terminal panels.
finish_anchor = 'if(walletUnlocked&&autoConnectOrigin!=null&&autoConnectOrigin.equals(currentOrigin)){setOriginAllowed(currentOrigin,true);autoConnectOrigin=null;view.postDelayed(()->installCompatSession(),350);}'
finish_add = 'if(isAurasUrl(url)){dappFitMode=true;if(fitButton!=null)fitButton.setText("FIT");view.postDelayed(()->applyFitMode(),500);view.postDelayed(()->applyFitMode(),2200);}'
if finish_add not in j:
    if finish_anchor not in j:
        raise SystemExit('patch target not found: Auras page-finished fit')
    j = j.replace(finish_anchor, finish_anchor + finish_add, 1)

# Small toolbar button style.
marker = '    private TextView browserButton(String label)'
helpers = r'''    private TextView browserSmallButton(String label){
        TextView t=browserButton(label);
        t.setTextSize(10);
        t.setTypeface(null,android.graphics.Typeface.BOLD);
        t.setLayoutParams(new LinearLayout.LayoutParams(dp(42),dp(44)));
        return t;
    }

    private boolean isAurasUrl(String url){
        try {
            Uri u=Uri.parse(url==null?"":url);
            String h=u.getHost()==null?"":u.getHost().toLowerCase();
            return "auras.finance".equals(h)||"www.auras.finance".equals(h)||h.endsWith(".auras.finance");
        } catch(Exception e){ return false; }
    }

    private void toggleFitMode(){
        dappFitMode=!dappFitMode;
        if(fitButton!=null)fitButton.setText(dappFitMode?"FIT":"100%");
        applyFitMode();
        Toast.makeText(this,dappFitMode?"Terminal ajustado à tela":"Terminal em 100%",Toast.LENGTH_SHORT).show();
    }

    private void applyFitMode(){
        if(dappWebView==null||dappWebView.getUrl()==null)return;
        if(!dappFitMode){
            dappWebView.evaluateJavascript("(function(){try{var m=document.querySelector('meta[name=viewport]');if(m)m.setAttribute('content','width=device-width,initial-scale=1,minimum-scale=0.2,maximum-scale=5,user-scalable=yes');document.documentElement.style.overflowX='auto';if(document.body)document.body.style.overflowX='auto';}catch(e){}})();",null);
            dappWebView.setInitialScale(100);
            return;
        }
        final boolean auras=isAurasUrl(dappWebView.getUrl());
        String js="(function(){try{var a="+(auras?"true":"false")+";var m=document.querySelector('meta[name=viewport]');if(!m&&document.head){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}if(m&&a)m.setAttribute('content','width=1180,initial-scale=1,minimum-scale=0.20,maximum-scale=5,user-scalable=yes');document.documentElement.style.setProperty('overflow-x','auto','important');if(document.body)document.body.style.setProperty('overflow-x','auto','important');var de=document.documentElement,b=document.body;var w=Math.max(a?1180:0,de?de.scrollWidth:0,b?b.scrollWidth:0,de?de.offsetWidth:0,b?b.offsetWidth:0);return w||1180;}catch(e){return 1180;}})();";
        dappWebView.evaluateJavascript(js,raw->{
            try{
                String clean=raw==null?"":raw.replace("\"","").trim();
                double contentCss=Double.parseDouble(clean);
                float density=getResources().getDisplayMetrics().density;
                float viewportCss=Math.max(1f,dappWebView.getWidth()/density);
                int scale=Math.round((float)(viewportCss/contentCss*100.0));
                scale=Math.max(22,Math.min(100,scale));
                dappWebView.setInitialScale(scale);
            }catch(Exception ignored){dappWebView.setInitialScale(browserLandscape?62:31);}
        });
    }

    private void toggleBrowserOrientation(){
        browserLandscape=!browserLandscape;
        dappFitMode=true;
        if(fitButton!=null)fitButton.setText("FIT");
        if(rotateButton!=null)rotateButton.setText(browserLandscape?"↕":"↔");
        setRequestedOrientation(browserLandscape?ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE:ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
        if(browserContainer!=null)browserContainer.postDelayed(()->applyFitMode(),420);
    }

    @Override public void onConfigurationChanged(Configuration newConfig){
        super.onConfigurationChanged(newConfig);
        if(browserContainer!=null&&browserContainer.getVisibility()==View.VISIBLE&&dappFitMode){
            browserContainer.postDelayed(()->applyFitMode(),300);
        }
    }

'''
if 'private void toggleFitMode()' not in j:
    if marker not in j:
        raise SystemExit('patch target not found: browser helper marker')
    j = j.replace(marker, helpers + marker, 1)

# Leaving the browser returns the main wallet to portrait without destroying WebView state.
old_close = 'private void openBrowser(String url){browserContainer.setVisibility(View.VISIBLE);browserContainer.bringToFront();navigateAddress(url);} private void closeBrowser(){browserContainer.setVisibility(View.GONE);appWebView.bringToFront();appWebView.evaluateJavascript("if(window.loadRecents)loadRecents();if(window.loadActivity)loadActivity();",null);}'
new_close = 'private void openBrowser(String url){browserContainer.setVisibility(View.VISIBLE);browserContainer.bringToFront();navigateAddress(url);} private void closeBrowser(){browserContainer.setVisibility(View.GONE);browserLandscape=false;if(rotateButton!=null)rotateButton.setText("↔");setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);appWebView.bringToFront();appWebView.evaluateJavascript("if(window.loadRecents)loadRecents();if(window.loadActivity)loadActivity();",null);}'
j = replace_once(j, old_close, new_close, 'restore portrait on browser close')

JAVA.write_text(j)

# Avoid Activity recreation while rotating the dApp terminal; WebView/provider state remains intact.
m = MANIFEST.read_text()
old_activity = '            android:screenOrientation="portrait"\n            android:enableOnBackInvokedCallback="true">'
new_activity = '            android:screenOrientation="unspecified"\n            android:configChanges="orientation|screenSize|keyboardHidden"\n            android:enableOnBackInvokedCallback="true">'
m = replace_once(m, old_activity, new_activity, 'manifest orientation config')
MANIFEST.write_text(m)

print('ASENDEX Wallet Mobile v0.4.6 professional terminal FIT patch applied')
