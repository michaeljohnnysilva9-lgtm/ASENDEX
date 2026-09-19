from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'mobile-wallet/web/src/app.js'

s = APP.read_text()

helper_anchor = "function cleanHex(v){return String(v||'').trim().replace(/\\s+/g,'').replace(/^0x/i,'');}\n"
helper = r'''function cleanHex(v){return String(v||'').trim().replace(/\s+/g,'').replace(/^0x/i,'');}
const ASE_CHARSET='qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function aseConvertBits(data,fromBits,toBits,pad){let acc=0,bits=0;const ret=[],maxv=(1<<toBits)-1,maxAcc=(1<<(fromBits+toBits-1))-1;for(const value of data){if(value<0||(value>>fromBits))throw new Error('Endereço Asentum inválido');acc=((acc<<fromBits)|value)&maxAcc;bits+=fromBits;while(bits>=toBits){bits-=toBits;ret.push((acc>>bits)&maxv)}}if(pad){if(bits)ret.push((acc<<(toBits-bits))&maxv)}else if(bits>=fromBits||((acc<<(toBits-bits))&maxv))throw new Error('Endereço Asentum inválido');return Uint8Array.from(ret)}
function aseToHexAddress(addr){const s=String(addr||'').trim();if(/^0x[0-9a-fA-F]{40}$/.test(s))return s.toLowerCase();const low=s.toLowerCase();if(!low.startsWith('ase1'))throw new Error('Endereço Asentum inválido');const body=low.slice(low.lastIndexOf('1')+1);if(body.length<7)throw new Error('Endereço Asentum inválido');const vals=[...body.slice(0,-6)].map(c=>ASE_CHARSET.indexOf(c));if(vals.some(v=>v<0))throw new Error('Endereço Asentum inválido');const bytes=aseConvertBits(vals,5,8,false);if(bytes.length!==20)throw new Error('Endereço Asentum inválido');return '0x'+[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('')}
'''
if 'function aseToHexAddress(' not in s:
    if helper_anchor not in s:
        raise SystemExit('helper anchor not found')
    s = s.replace(helper_anchor, helper, 1)

old = "async function balanceRaw(t){if(!address)return 0n;if(t.native)return BigInt((await api('balance',{address})).balance||0);try{return BigInt(await view(t.address,'balanceOf',[address])||0)}catch{return 0n}}"
new = """async function balanceRaw(t){if(!address)return 0n;if(t.native){let nativeAddress=address;try{nativeAddress=aseToHexAddress(address)}catch{}try{const j=await api('balance',{address:nativeAddress});const raw=String(j.balance??'0');if(!/^\\d+$/.test(raw))throw new Error('Saldo ASE inválido');return BigInt(raw)}catch(primaryError){try{const local=await bridge('getBalance');if(local?.balanceWei!=null&&/^\\d+$/.test(String(local.balanceWei)))return BigInt(local.balanceWei)}catch{}throw primaryError}}try{return BigInt(await view(t.address,'balanceOf',[address])||0)}catch{return 0n}}"""
if old in s:
    s = s.replace(old, new, 1)
elif new not in s:
    raise SystemExit('balanceRaw target not found')

APP.write_text(s)
print('ASENDEX Wallet Mobile v0.4.3 native ASE balance patch applied')
