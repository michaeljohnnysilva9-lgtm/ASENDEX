from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JAVA = ROOT / 'mobile-wallet/app/src/main/java/com/asentum/wallet/MainActivity.java'
SIGNER = ROOT / 'mobile-wallet/web/src/signer.js'

j = JAVA.read_text()

# Auras contract orders can contain bigint values in args/value. JSON.stringify
# throws on bigint before the request ever reaches Android, so Buy/Sell can look
# like a no-op. Use a deterministic JSON replacer at the injected provider edge.
old_q = "function q(m,a){return new Promise(function(res,rej){var id=String(seq++);p[id]={res:res,rej:rej};AsentumNative.request(id,JSON.stringify({method:m,params:a||{}}));});}"
new_q = "function enc(v){return JSON.stringify(v,function(k,x){if(typeof x==='bigint')return x.toString();if(typeof Uint8Array!=='undefined'&&x instanceof Uint8Array)return Array.prototype.slice.call(x);return x;});}function q(m,a){return new Promise(function(res,rej){var id=String(seq++);p[id]={res:res,rej:rej};try{AsentumNative.request(id,enc({method:m,params:a||{}}));}catch(e){delete p[id];rej(e);}});}"
if old_q in j:
    j = j.replace(old_q, new_q, 1)
elif new_q not in j:
    raise SystemExit('patch target not found: provider request serializer')

# Make the provider slightly more interoperable without changing the official
# Asentum API. Some dApps feature-detect a generic request() method.
old_tail = "deployContract:function(v){return q('deployContract',v);},on:function(n,fn)"
new_tail = "deployContract:function(v){return q('deployContract',v);},request:function(v){if(!v||!v.method)return Promise.reject(new Error('method required'));return q(v.method,v.params||{});},on:function(n,fn)"
if old_tail in j:
    j = j.replace(old_tail, new_tail, 1)
elif new_tail not in j:
    raise SystemExit('patch target not found: provider generic request')

JAVA.write_text(j)

s = SIGNER.read_text()

# SDK betas may return {hash}, {txHash}, {transactionHash}, or a hash string.
# Always return the official provider shape {txHash} and fail loudly if the
# signer did not receive a transaction identifier.
anchor = "function valueForSdk(v) {\n  const s = String(v ?? '0').trim();\n  if (/^\\d+$/.test(s)) return formatAse(BigInt(s));\n  return s || '0';\n}\n"
helper = anchor + "function txResult(tx) {\n  const hash = typeof tx === 'string' ? tx : String(tx?.hash || tx?.txHash || tx?.transactionHash || '');\n  if (!hash) throw new Error('Transação não retornou tx hash');\n  return { txHash: hash, hash };\n}\n"
if 'function txResult(tx)' not in s:
    if anchor not in s:
        raise SystemExit('patch target not found: tx result helper')
    s = s.replace(anchor, helper, 1)

s = s.replace("      return { txHash: tx.hash };", "      return txResult(tx);")

SIGNER.write_text(s)
print('ASENDEX Wallet Mobile v0.4.8 order execution compatibility patch applied')
