from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
j = JAVA.read_text()


def add_after_once(text, anchor, addition, label):
    if addition.strip() in text:
        return text
    if anchor not in text:
        raise SystemExit(f'patch target not found: {label}')
    return text.replace(anchor, anchor + addition, 1)

# --- Imports for WebChrome, Service Worker and the narrow HTTPS proxy used only
# for the official Auras indexer host. ---
j = add_after_once(j, 'import android.webkit.WebViewClient;\n',
'''import android.webkit.WebChromeClient;\nimport android.webkit.WebResourceResponse;\nimport android.webkit.ServiceWorkerClient;\nimport android.webkit.ServiceWorkerController;\nimport android.webkit.ServiceWorkerWebSettings;\n''', 'webkit imports')

j = add_after_once(j, 'import java.nio.charset.StandardCharsets;\n',
'''import java.io.ByteArrayInputStream;\nimport java.io.InputStream;\nimport java.net.HttpURLConnection;\nimport java.net.URL;\n''', 'java network imports')

# --- Pinch-to-zoom / fit support. v0.4.4 already enables wide viewport + overview. ---
zoom_anchor = '        s.setUseWideViewPort(true);\n'
zoom_add = '''        s.setSupportZoom(true);\n        s.setBuiltInZoomControls(true);\n        s.setDisplayZoomControls(false);\n'''
if 's.setBuiltInZoomControls(true);' not in j:
    if zoom_anchor not in j:
        raise SystemExit('patch target not found: zoom settings')
    j = j.replace(zoom_anchor, zoom_anchor + zoom_add, 1)

# --- WebChromeClient enables modern browser behaviour used by dApps; ServiceWorker
# network access is explicitly enabled and its fetches receive the same Auras bridge. ---
layer_anchor = '        dappWebView.setLayerType(View.LAYER_TYPE_HARDWARE,null);\n'
layer_add = '''        dappWebView.setWebChromeClient(new WebChromeClient());\n        try {\n            ServiceWorkerController sw=ServiceWorkerController.getInstance();\n            ServiceWorkerWebSettings sws=sw.getServiceWorkerWebSettings();\n            sws.setBlockNetworkLoads(false);\n            sws.setCacheMode(WebSettings.LOAD_DEFAULT);\n            sw.setServiceWorkerClient(new ServiceWorkerClient(){\n                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request){\n                    return proxyAurasApi(request);\n                }\n            });\n        } catch(Exception ignored) {}\n'''
if 'sw.setServiceWorkerClient' not in j:
    if layer_anchor not in j:
        raise SystemExit('patch target not found: web chrome/service worker')
    j = j.replace(layer_anchor, layer_anchor + layer_add, 1)

# --- Intercept normal WebView GET/OPTIONS requests to the official Auras indexer.
# If native proxying fails, return null and Chromium performs its normal request. ---
client_anchor = '        dappWebView.setWebViewClient(new WebViewClient(){\n'
interceptor = '''            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request){\n                WebResourceResponse bridged=proxyAurasApi(request);\n                return bridged!=null?bridged:super.shouldInterceptRequest(view,request);\n            }\n'''
if 'WebResourceResponse bridged=proxyAurasApi(request);' not in j:
    if client_anchor not in j:
        raise SystemExit('patch target not found: WebViewClient')
    j = j.replace(client_anchor, client_anchor + interceptor, 1)

# --- Native HTTPS bridge. This is deliberately allowlisted to auras.asentum.com only.
# It does not proxy wallet/provider traffic and never sees a private key. ---
marker = '    private TextView browserButton(String label)'
helper = r'''    private WebResourceResponse proxyAurasApi(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return null;
        Uri uri=request.getUrl();
        String host=uri.getHost()==null?"":uri.getHost().toLowerCase();
        if (!"auras.asentum.com".equals(host)) return null;
        String method=request.getMethod()==null?"GET":request.getMethod().toUpperCase();
        Map<String,String> cors=new HashMap<>();
        cors.put("Access-Control-Allow-Origin","https://www.auras.finance");
        cors.put("Access-Control-Allow-Credentials","true");
        cors.put("Access-Control-Allow-Methods","GET,HEAD,OPTIONS");
        cors.put("Access-Control-Allow-Headers","*");
        cors.put("Vary","Origin");
        cors.put("Cache-Control","no-store");
        if ("OPTIONS".equals(method)) {
            return new WebResourceResponse("text/plain","UTF-8",204,"No Content",cors,new ByteArrayInputStream(new byte[0]));
        }
        if (!("GET".equals(method)||"HEAD".equals(method))) return null;
        try {
            HttpURLConnection c=(HttpURLConnection)new URL(uri.toString()).openConnection();
            c.setConnectTimeout(9000);
            c.setReadTimeout(12000);
            c.setInstanceFollowRedirects(true);
            c.setUseCaches(false);
            c.setRequestMethod(method);
            c.setRequestProperty("Accept","application/json,text/plain,*/*");
            c.setRequestProperty("Accept-Encoding","identity");
            c.setRequestProperty("Origin","https://www.auras.finance");
            if (dappWebView!=null) c.setRequestProperty("User-Agent",dappWebView.getSettings().getUserAgentString());
            int code=c.getResponseCode();
            InputStream body=code>=400?c.getErrorStream():c.getInputStream();
            if (body==null) body=new ByteArrayInputStream(new byte[0]);
            String ct=c.getContentType();
            String mime="application/json", charset="UTF-8";
            if (ct!=null&&!ct.isEmpty()) {
                String[] parts=ct.split(";");
                if(parts.length>0&&!parts[0].trim().isEmpty()) mime=parts[0].trim();
                for(String p:parts){String q=p.trim();if(q.toLowerCase().startsWith("charset="))charset=q.substring(8).trim();}
            }
            Map<String,String> headers=new HashMap<>(cors);
            String etag=c.getHeaderField("ETag"); if(etag!=null)headers.put("ETag",etag);
            String lm=c.getHeaderField("Last-Modified"); if(lm!=null)headers.put("Last-Modified",lm);
            String reason=c.getResponseMessage(); if(reason==null||reason.isEmpty())reason=code>=200&&code<300?"OK":"HTTP";
            return new WebResourceResponse(mime,charset,code,reason,headers,body);
        } catch(Exception e) {
            return null;
        }
    }

'''
if 'private WebResourceResponse proxyAurasApi(' not in j:
    if marker not in j:
        raise SystemExit('patch target not found: helper marker')
    j = j.replace(marker, helper + marker, 1)

# One guarded retry for Auras when its market panel is still stuck on Loading pairs.
# This helps transient startup races but never loops forever.
finish_anchor = 'if(isHttpUrl(url))saveRecent(url);'
retry = '''if(isHttpUrl(url))saveRecent(url);if(url!=null&&url.contains("auras.finance")){view.postDelayed(()->view.evaluateJavascript("(function(){try{var t=(document.body&&document.body.innerText)||'';if(t.indexOf('Loading pairs')>=0&&!sessionStorage.getItem('asendex:aurasRetry')){sessionStorage.setItem('asendex:aurasRetry','1');location.reload();}}catch(e){}})();",null),6500);}'''
if 'asendex:aurasRetry' not in j:
    if finish_anchor not in j:
        raise SystemExit('patch target not found: Auras guarded retry')
    j = j.replace(finish_anchor, retry, 1)

JAVA.write_text(j)
print('ASENDEX Wallet Mobile v0.4.5 Auras resilient browser patch applied')
