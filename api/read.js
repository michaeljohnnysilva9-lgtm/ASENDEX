const ASENTUM = process.env.ASENTUM_RPC_URL || 'https://testnet.asentum.com';
const EXPLORER_RPC = process.env.ASENTUM_EXPLORER_RPC_URL || 'https://explorer.asentum.com/rpc';
const PAIRS = process.env.AURAS_PAIRS_URL || 'https://auras.asentum.com/api/pairs';

async function jsonRpc(method, params = []) {
  const r = await fetch(EXPLORER_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'ASENDEX-Beta/4.0' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`Explorer RPC HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'Explorer RPC error');
  return j.result;
}

async function getJson(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { ...(options.headers || {}), 'user-agent': 'ASENDEX-Beta/4.0' } });
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${String(text).slice(0, 160)}`);
  return j;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const src = req.method === 'GET' ? (req.query || {}) : (req.body || {});
    const mode = String(src.mode || '');

    if (mode === 'network') {
      const [cid, bn] = await Promise.all([jsonRpc('eth_chainId'), jsonRpc('eth_blockNumber')]);
      return res.status(200).json({ ok: true, chainId: parseInt(cid, 16), blockNumber: parseInt(bn, 16) });
    }

    if (mode === 'pairs') {
      const data = await getJson(PAIRS, { cache: 'no-store' });
      return res.status(200).json({ ok: true, data });
    }

    if (mode === 'view') {
      const data = await getJson(`${ASENTUM}/view`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contract: src.contract, method: src.method, args: src.args || [] }),
      });
      if (data?.ok === false) throw new Error(data?.reason || 'view failed');
      return res.status(200).json({ ok: true, result: data?.returnValue });
    }

    if (mode === 'balance') {
      const data = await getJson(`${ASENTUM}/balance/${encodeURIComponent(src.address)}`, { cache: 'no-store' });
      return res.status(200).json({ ok: true, balance: String(data?.balance ?? '0') });
    }

    if (mode === 'receipt') {
      const r = await fetch(`${ASENTUM}/receipts/${encodeURIComponent(src.txHash)}`, {
        cache: 'no-store',
        headers: { 'user-agent': 'ASENDEX-Beta/4.0' },
      });
      if (r.status === 404) return res.status(200).json({ ok: true, receipt: null });
      const text = await r.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!r.ok) throw new Error(`receipt HTTP ${r.status}`);
      return res.status(200).json({ ok: true, receipt: data });
    }

    return res.status(400).json({ ok: false, error: 'bad mode' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e?.message || String(e) });
  }
}
