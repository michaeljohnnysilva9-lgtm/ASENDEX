import { AsentumClient, AsentumWallet, formatAse } from '@asentum/sdk';

const RPC = 'https://testnet.asentum.com';
const client = new AsentumClient(RPC);
let wallet = null;
const enc = new TextEncoder();
const dec = new TextDecoder();

function hexToBytes(hex) {
  const s = String(hex || '').trim().replace(/^0x/i, '');
  if (!s || s.length % 2 || !/^[0-9a-fA-F]+$/.test(s)) throw new Error('Hexadecimal inválido');
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToB64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function deriveKey(password, salt) {
  if (!password || password.length < 8) throw new Error('Use uma senha com pelo menos 8 caracteres');
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 310000 },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}
async function encryptVault(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iterations: 310000, salt: bytesToB64(salt), iv: bytesToB64(iv), cipher: bytesToB64(cipher) });
}
async function decryptVault(raw, password) {
  if (!raw) throw new Error('Nenhuma carteira salva');
  const box = JSON.parse(raw);
  const key = await deriveKey(password, b64ToBytes(box.salt));
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(box.iv) }, key, b64ToBytes(box.cipher));
    return JSON.parse(dec.decode(plain));
  } catch {
    throw new Error('Senha incorreta ou backup inválido');
  }
}
async function saveAndUnlock(data, password) {
  const encrypted = await encryptVault(data, password);
  SignerNative.saveVault(encrypted);
  wallet = data.mode === 'seed'
    ? AsentumWallet.fromSeed(client, hexToBytes(data.seedHex))
    : AsentumWallet.fromSecretKey(client, data.secretKeyHex, data.publicKeyHex);
  SignerNative.saveAddress(wallet.address);
  return { address: wallet.address };
}
async function unlock(password) {
  const data = await decryptVault(SignerNative.loadVault(), password);
  wallet = data.mode === 'seed'
    ? AsentumWallet.fromSeed(client, hexToBytes(data.seedHex))
    : AsentumWallet.fromSecretKey(client, data.secretKeyHex, data.publicKeyHex);
  SignerNative.saveAddress(wallet.address);
  return { address: wallet.address };
}
function requireWallet() {
  if (!wallet) throw new Error('Carteira bloqueada');
  return wallet;
}
async function state() {
  const w = requireWallet();
  let balance = '0';
  try { balance = formatAse(await w.getBalance()); } catch (_) { balance = '—'; }
  return { address: w.address, balance, rpc: RPC };
}
async function invoke(method, p = {}) {
  switch (method) {
    case 'createWallet': {
      const w = AsentumWallet.create(client);
      return saveAndUnlock({ mode: 'keys', secretKeyHex: w.secretKeyHex, publicKeyHex: w.publicKeyHex }, p.password);
    }
    case 'importSeed': {
      const seed = hexToBytes(p.seedHex);
      if (seed.length !== 32) throw new Error('A seed deve ter exatamente 32 bytes (64 caracteres hex)');
      AsentumWallet.fromSeed(client, seed);
      return saveAndUnlock({ mode: 'seed', seedHex: '0x' + p.seedHex.trim().replace(/^0x/i, '') }, p.password);
    }
    case 'importKeys': {
      const sk = hexToBytes(p.secretKeyHex);
      const pk = hexToBytes(p.publicKeyHex);
      if (sk.length < 1000 || pk.length < 1000) throw new Error('Secret/Public Key não parecem ser chaves Dilithium3 completas');
      const w = AsentumWallet.fromSecretKey(client, p.secretKeyHex, p.publicKeyHex);
      if (!w.address) throw new Error('Não foi possível derivar o endereço');
      return saveAndUnlock({ mode: 'keys', secretKeyHex: p.secretKeyHex.trim(), publicKeyHex: p.publicKeyHex.trim() }, p.password);
    }
    case 'unlock': return unlock(p.password);
    case 'lock': wallet = null; return { locked: true };
    case 'state': return state();
    case 'getAddress': return { address: requireWallet().address };
    case 'getBalance': return { balance: formatAse(await requireWallet().getBalance()), address: requireWallet().address };
    case 'sendTransfer': {
      const tx = await requireWallet().sendTransfer({ to: p.to, amount: p.amount });
      return { txHash: tx.hash };
    }
    case 'callContract': {
      const tx = await requireWallet().sendCall({ to: p.to, method: p.method, args: p.args || [], value: p.value || '0' });
      return { txHash: tx.hash };
    }
    case 'viewContract': {
      const r = await client.viewCall(p.to, p.method, p.args || []);
      if (!r.ok) throw new Error(r.reason || 'View call falhou');
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
