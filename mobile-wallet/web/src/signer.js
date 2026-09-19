import { AsentumClient, AsentumWallet, formatAse } from '@asentum/sdk';

const RPC = 'https://testnet.asentum.com';
const client = new AsentumClient(RPC);
let wallet = null;
const enc = new TextEncoder();
const dec = new TextDecoder();

function hexToBytes(hex) {
  const s = String(hex || '').trim().replace(/\s+/g, '').replace(/^0x/i, '');
  if (!s || s.length % 2 || !/^[0-9a-fA-F]+$/.test(s)) throw new Error('Private Key hexadecimal inválida');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function normalizedHex(hex) { return '0x' + String(hex || '').trim().replace(/\s+/g, '').replace(/^0x/i, '').toLowerCase(); }
function bytesToB64(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function b64ToBytes(s) { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }

// Native Asentum address representation. The SDK currently signs using the
// equivalent 20-byte 0x form internally; the wallet UI/provider exposes ase1.
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32_GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
function convertBits(data, fromBits, toBits, pad) {
  let acc = 0, bits = 0; const ret = [], maxv = (1 << toBits) - 1, maxAcc = (1 << (fromBits + toBits - 1)) - 1;
  for (const value of data) {
    if (value < 0 || (value >> fromBits)) throw new Error('Endereço Asentum inválido');
    acc = ((acc << fromBits) | value) & maxAcc; bits += fromBits;
    while (bits >= toBits) { bits -= toBits; ret.push((acc >> bits) & maxv); }
  }
  if (pad) { if (bits) ret.push((acc << (toBits - bits)) & maxv); }
  else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) throw new Error('Endereço Asentum inválido');
  return Uint8Array.from(ret);
}
function bech32Polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= BECH32_GEN[i];
  }
  return chk;
}
function bech32HrpExpand(hrp) {
  const ret = [];
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) >>> 5);
  ret.push(0);
  for (let i = 0; i < hrp.length; i++) ret.push(hrp.charCodeAt(i) & 31);
  return ret;
}
function bech32Checksum(hrp, data) {
  const values = bech32HrpExpand(hrp).concat(Array.from(data)).concat([0,0,0,0,0,0]);
  const mod = bech32Polymod(values) ^ 1;
  const ret = [];
  for (let p = 0; p < 6; p++) ret.push((mod >>> (5 * (5 - p))) & 31);
  return ret;
}
function hexToAse1(addr) {
  const s = String(addr || '').trim();
  if (/^ase1[02-9ac-hj-np-z]+$/i.test(s)) return s.toLowerCase();
  const clean = s.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{40}$/.test(clean)) throw new Error('Endereço Asentum deve conter 20 bytes');
  const bytes = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  const data = convertBits(bytes, 8, 5, true);
  const combined = Array.from(data).concat(bech32Checksum('ase', data));
  return 'ase1' + combined.map(c => CHARSET[c]).join('');
}
function aseToHex(addr) {
  const s = String(addr || '').trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) return s;
  const low = s.toLowerCase();
  if (!low.startsWith('ase1') || (s !== low && s !== s.toUpperCase())) throw new Error('Endereço de destino inválido');
  const pos = low.lastIndexOf('1');
  const body = low.slice(pos + 1);
  if (body.length < 7) throw new Error('Endereço Asentum inválido');
  const vals = [...body.slice(0, -6)].map(c => CHARSET.indexOf(c));
  if (vals.some(v => v < 0)) throw new Error('Endereço Asentum inválido');
  const bytes = convertBits(vals, 5, 8, false);
  if (bytes.length !== 20) throw new Error('Endereço Asentum não contém 20 bytes');
  return '0x' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}
function publicAddress(w = requireWallet()) { return hexToAse1(w.address); }

async function deriveKey(password, salt) {
  if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))));
  return JSON.stringify({ v: 2, kdf: 'PBKDF2-SHA256', iterations: 310000, salt: bytesToB64(salt), iv: bytesToB64(iv), cipher: bytesToB64(cipher) });
}
async function decryptVault(raw, password) {
  if (!raw) throw new Error('Nenhuma carteira salva');
  const box = JSON.parse(raw);
  const key = await deriveKey(password, b64ToBytes(box.salt));
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(box.iv) }, key, b64ToBytes(box.cipher));
    return JSON.parse(dec.decode(plain));
  } catch { throw new Error('Senha incorreta ou cofre inválido'); }
}
function walletFromData(data) {
  if (data.mode === 'private' || data.mode === 'seed') return AsentumWallet.fromSeed(client, hexToBytes(data.privateKeyHex || data.seedHex));
  if (data.mode === 'keys') return AsentumWallet.fromSecretKey(client, data.secretKeyHex, data.publicKeyHex);
  throw new Error('Formato de carteira não suportado');
}
async function saveAndUnlock(data, password) {
  const encrypted = await encryptVault(data, password);
  SignerNative.saveVault(encrypted);
  wallet = walletFromData(data);
  const address = publicAddress(wallet);
  SignerNative.saveAddress(address);
  return { address };
}
async function unlock(password) {
  const data = await decryptVault(SignerNative.loadVault(), password);
  wallet = walletFromData(data);
  const address = publicAddress(wallet);
  SignerNative.saveAddress(address);
  return { address };
}
function requireWallet() { if (!wallet) throw new Error('Carteira bloqueada'); return wallet; }

function amountForSdk(p) {
  if (p.amountAse != null) return String(p.amountAse).trim();
  const a = String(p.amount ?? '').trim();
  if (!a) throw new Error('Quantidade não informada');
  if (p.unit === 'wei' || /^\d+$/.test(a)) return formatAse(BigInt(a));
  return a;
}
function valueForSdk(v) {
  const s = String(v ?? '0').trim();
  if (/^\d+$/.test(s)) return formatAse(BigInt(s));
  return s || '0';
}

async function state() {
  const w = requireWallet();
  let balance = '0';
  try { balance = formatAse(await w.getBalance()); } catch { balance = '—'; }
  return { address: publicAddress(w), balance, rpc: RPC };
}
async function invoke(method, p = {}) {
  switch (method) {
    case 'createWallet': {
      const w = AsentumWallet.create(client);
      return saveAndUnlock({ mode: 'keys', secretKeyHex: w.secretKeyHex, publicKeyHex: w.publicKeyHex }, p.password);
    }
    case 'importPrivateKey': {
      const key = hexToBytes(p.privateKeyHex);
      if (key.length !== 32) throw new Error('A Private Key exportada pela wallet Asentum deve ter 32 bytes (64 caracteres hex).');
      const normalized = normalizedHex(p.privateKeyHex);
      const w = AsentumWallet.fromSeed(client, key);
      if (!w.address) throw new Error('Não foi possível derivar o endereço Asentum');
      return saveAndUnlock({ mode: 'private', privateKeyHex: normalized }, p.password);
    }
    // Backward compatibility with the first beta vault.
    case 'importSeed': {
      const key = hexToBytes(p.seedHex);
      if (key.length !== 32) throw new Error('A chave deve ter 32 bytes');
      return saveAndUnlock({ mode: 'private', privateKeyHex: normalizedHex(p.seedHex) }, p.password);
    }
    case 'importKeys': {
      const w = AsentumWallet.fromSecretKey(client, p.secretKeyHex, p.publicKeyHex);
      return saveAndUnlock({ mode: 'keys', secretKeyHex: p.secretKeyHex, publicKeyHex: p.publicKeyHex }, p.password);
    }
    case 'unlock': return unlock(p.password);
    case 'lock': wallet = null; return { locked: true };
    case 'state': return state();
    case 'getAddress': return { address: publicAddress() };
    case 'getBalance': { const w = requireWallet(); const raw = await w.getBalance(); return { balance: formatAse(raw), balanceWei: raw.toString(), address: publicAddress(w) }; }
    case 'sendTransfer': {
      const tx = await requireWallet().sendTransfer({ to: aseToHex(p.to), amount: amountForSdk(p) });
      return { txHash: tx.hash };
    }
    case 'callContract': {
      const tx = await requireWallet().sendCall({ to: p.to, method: p.method, args: p.args || [], value: valueForSdk(p.value) });
      return { txHash: tx.hash };
    }
    case 'viewContract': {
      const r = await client.viewCall(p.to, p.method, p.args || []);
      if (!r.ok) throw new Error(r.reason || 'Leitura de contrato falhou');
      return { result: r.returnValue };
    }
    case 'deployContract': {
      const c = await requireWallet().deploy(p.source || '');
      return { txHash: c.deployTx?.hash || '', contractAddress: c.address };
    }
    default: throw new Error('Método não suportado: ' + method);
  }
}
window.__signerRequest = async function(id, method, payloadJson) {
  try {
    const payload = payloadJson ? JSON.parse(payloadJson) : {};
    const result = await invoke(method, payload);
    SignerNative.complete(String(id), true, JSON.stringify(result ?? {}));
  } catch (e) {
    SignerNative.complete(String(id), false, JSON.stringify({ message: e?.message || String(e) }));
  }
};
SignerNative.ready();