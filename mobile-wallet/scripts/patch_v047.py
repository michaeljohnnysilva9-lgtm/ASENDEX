from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
j = JAVA.read_text()

# Auras and other Asentum dApps use the public RPC directly for read-only
# contract calls. Those calls do not pass through the wallet signer, so the
# signer-side ase1 -> 0x normalization cannot affect balanceOf/allowance reads.
# Install a document-start compatibility layer that rewrites ONLY POST /view
# request args sent to the official Asentum testnet RPC. Public ase1 addresses
# remain unchanged everywhere else and transaction signing is untouched.
compat_js = r'''(function(){
  if(window.__asendexReadCompatInstalled)return;
  window.__asendexReadCompatInstalled=true;
  var CS='qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  function bits(data,fromBits,toBits,pad){
    var acc=0,b=0,out=[],maxv=(1<<toBits)-1,maxAcc=(1<<(fromBits+toBits-1))-1;
    for(var i=0;i<data.length;i++){
      var v=data[i]; if(v<0||(v>>fromBits))throw new Error('invalid ase address');
      acc=((acc<<fromBits)|v)&maxAcc; b+=fromBits;
      while(b>=toBits){b-=toBits;out.push((acc>>b)&maxv);}
    }
    if(pad){if(b)out.push((acc<<(toBits-b))&maxv);}
    else if(b>=fromBits||((acc<<(toBits-b))&maxv))throw new Error('invalid ase address');
    return out;
  }
  function aseHex(v){
    if(typeof v!=='string')return v;
    var s=v.trim();
    if(/^0x[0-9a-fA-F]{40}$/.test(s))return s.toLowerCase();
    var low=s.toLowerCase(); if(low.indexOf('ase1')!==0)return v;
    var p=low.lastIndexOf('1'), body=low.slice(p+1); if(body.length<7)return v;
    var payload=body.slice(0,-6), vals=[];
    for(var i=0;i<payload.length;i++){var n=CS.indexOf(payload.charAt(i));if(n<0)return v;vals.push(n);}
    try{
      var bytes=bits(vals,5,8,false); if(bytes.length!==20)return v;
      var h='0x'; for(var k=0;k<bytes.length;k++)h+=bytes[k].toString(16).padStart(2,'0');
      return h;
    }catch(e){return v;}
  }
  function normalize(v){
    if(typeof v==='string')return aseHex(v);
    if(Array.isArray(v))return v.map(normalize);
    if(v&&typeof v==='object'){
      var o={}; Object.keys(v).forEach(function(k){o[k]=normalize(v[k]);}); return o;
    }
    return v;
  }
  function target(url){
    try{var u=new URL(String(url),location.href);return u.protocol==='https:'&&u.hostname==='testnet.asentum.com'&&u.pathname==='/view';}
    catch(e){return false;}
  }
  function rewrite(body){
    if(typeof body!=='string'||!body)return body;
    try{var q=JSON.parse(body);if(q&&Array.isArray(q.args)){q.args=normalize(q.args);return JSON.stringify(q);}}catch(e){}
    return body;
  }
  var originalFetch=window.fetch&&window.fetch.bind(window);
  if(originalFetch){
    window.fetch=function(input,init){
      try{
        var url=(typeof input==='string'||input instanceof URL)?String(input):(input&&input.url)||'';
        var method=((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
        if(target(url)&&method==='POST'){
          if(init&&typeof init.body==='string'){
            var next=Object.assign({},init,{body:rewrite(init.body)});
            return originalFetch(input,next);
          }
          if(typeof Request!=='undefined'&&input instanceof Request&&(!init||typeof init.body==='undefined')){
            return input.clone().text().then(function(body){
              var nb=rewrite(body); if(nb===body)return originalFetch(input,init);
              var req=new Request(input,{body:nb}); return originalFetch(req,init);
            });
          }
        }
      }catch(e){}
      return originalFetch(input,init);
    };
  }
  if(typeof XMLHttpRequest!=='undefined'){
    var xo=XMLHttpRequest.prototype.open, xs=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open=function(method,url){this.__asendexMethod=String(method||'GET').toUpperCase();this.__asendexUrl=String(url||'');return xo.apply(this,arguments);};
    XMLHttpRequest.prototype.send=function(body){if(this.__asendexMethod==='POST'&&target(this.__asendexUrl))body=rewrite(body);return xs.call(this,body);};
  }
  window.__asendexAseToHex=aseHex;
})();'''

literal = json.dumps(compat_js)
anchor = '    private static final String PROVIDER_JS='
const_line = f'    private static final String ASENTUM_READ_COMPAT_JS={literal};\n'
if 'ASENTUM_READ_COMPAT_JS=' not in j:
    if anchor not in j:
        raise SystemExit('patch target not found: provider constant')
    j = j.replace(anchor, const_line + anchor, 1)

old_install = '    private void installProviderScript(){if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))WebViewCompat.addDocumentStartJavaScript(dappWebView,PROVIDER_JS, Collections.singleton("*"));}\n'
new_install = '    private void installProviderScript(){if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)){WebViewCompat.addDocumentStartJavaScript(dappWebView,PROVIDER_JS, Collections.singleton("*"));WebViewCompat.addDocumentStartJavaScript(dappWebView,ASENTUM_READ_COMPAT_JS, Collections.singleton("*"));}}\n'
if old_install in j:
    j = j.replace(old_install, new_install, 1)
elif new_install not in j:
    raise SystemExit('patch target not found: installProviderScript')

old_fallback = 'if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))view.evaluateJavascript(PROVIDER_JS,null);'
new_fallback = 'if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)){view.evaluateJavascript(PROVIDER_JS,null);view.evaluateJavascript(ASENTUM_READ_COMPAT_JS,null);}'
if old_fallback in j:
    j = j.replace(old_fallback, new_fallback, 1)
elif new_fallback not in j:
    raise SystemExit('patch target not found: document-start fallback')

JAVA.write_text(j)
print('ASENDEX Wallet Mobile v0.4.7 dApp token balance normalization patch applied')
