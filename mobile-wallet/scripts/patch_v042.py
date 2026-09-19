from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
INDEX = ROOT / 'mobile-wallet/web/index.html'

j = JAVA.read_text()

# Inject a compatibility shim at document start. The official @asentum/connect
# package may intentionally render its extension option disabled when a dApp
# still passes extensionStatus='soon', even when window.asentum is present.
# This shim only touches that known disabled Asentum extension option and routes
# the click through the real ASENDEX window.asentum provider + native approval.
marker = '    private void installProviderScript(){'
shim = r'''    private static final String ASENTUM_CONNECT_SHIM_JS="(function(){if(window.__asendexNativeConnectShim)return;window.__asendexNativeConnectShim=true;function announce(){try{window.dispatchEvent(new Event('asentum#initialized'));window.dispatchEvent(new CustomEvent('asentum:initialized',{detail:{provider:'ASENDEX Wallet Mobile',extension:true,nativeConnect:true}}));}catch(e){}}function save(addr){try{localStorage.setItem('asentum:connect:address',JSON.stringify({address:addr,method:'extension'}));}catch(e){}}function patchButton(btn){try{if(!window.asentum||!window.asentum.__asendexMobile)return;var txt=(btn.innerText||btn.textContent||'').toLowerCase();if(txt.indexOf('browser extension')<0)return;var disabled=!!btn.disabled||btn.getAttribute('aria-disabled')==='true'||txt.indexOf('soon')>=0;if(!disabled)return;btn.disabled=false;btn.removeAttribute('disabled');btn.setAttribute('aria-disabled','false');btn.style.opacity='1';btn.style.cursor='pointer';var nodes=btn.querySelectorAll('*');for(var i=0;i<nodes.length;i++){var t=(nodes[i].textContent||'').trim();if(t.toLowerCase()==='soon')nodes[i].textContent='ASENDEX';else if(t.indexOf('once it ships')>=0)nodes[i].textContent='ASENDEX Wallet Mobile detected · tap to connect';}if(btn.__asendexBound)return;btn.__asendexBound=true;btn.addEventListener('click',function(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();btn.style.pointerEvents='none';Promise.resolve(window.asentum.connect()).then(function(r){var addr=r&&r.address?r.address:r;if(!addr)throw new Error('No address returned');save(addr);announce();try{window.dispatchEvent(new CustomEvent('asentum:accountsChanged',{detail:{address:addr}}));}catch(e){}setTimeout(function(){location.reload();},220);}).catch(function(){btn.style.pointerEvents='auto';});},true);}catch(e){}}function scan(){try{var bs=document.querySelectorAll('button');for(var i=0;i<bs.length;i++)patchButton(bs[i]);}catch(e){}}function boot(){scan();announce();try{new MutationObserver(function(){scan();}).observe(document.documentElement||document,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-disabled']});}catch(e){}setTimeout(scan,80);setTimeout(scan,350);setTimeout(scan,1200);}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();})();";

'''
if 'ASENTUM_CONNECT_SHIM_JS' not in j:
    if marker not in j:
        raise SystemExit('patch target not found: installProviderScript')
    j = j.replace(marker, shim + marker, 1)

old_install = '    private void installProviderScript(){if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))WebViewCompat.addDocumentStartJavaScript(dappWebView,PROVIDER_JS, Collections.singleton("*"));}'
new_install = '    private void installProviderScript(){if(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)){WebViewCompat.addDocumentStartJavaScript(dappWebView,PROVIDER_JS, Collections.singleton("*"));WebViewCompat.addDocumentStartJavaScript(dappWebView,ASENTUM_CONNECT_SHIM_JS, Collections.singleton("*"));}}'
if old_install in j:
    j = j.replace(old_install, new_install, 1)
elif new_install not in j:
    raise SystemExit('patch target not found: document-start injection')

old_fallback = 'if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))view.evaluateJavascript(PROVIDER_JS,null);'
new_fallback = 'if(!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)){view.evaluateJavascript(PROVIDER_JS,null);view.evaluateJavascript(ASENTUM_CONNECT_SHIM_JS,null);}'
if old_fallback in j:
    j = j.replace(old_fallback, new_fallback, 1)
elif new_fallback not in j:
    raise SystemExit('patch target not found: fallback provider injection')

JAVA.write_text(j)

h = INDEX.read_text()
for old in ['ASENDEX WALLET MOBILE 0.4.0-beta.', 'ASENDEX WALLET MOBILE 0.4.1-beta.']:
    h = h.replace(old, 'ASENDEX WALLET MOBILE 0.4.2-beta.')
INDEX.write_text(h)

print('ASENDEX Wallet Mobile v0.4.2 native Asentum Connect compatibility patch applied')
