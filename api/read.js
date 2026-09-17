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

function sameAddress(value, candidates) {
  const v = String(value || '').toLowerCase();
  return !!v && candidates.some((x) => String(x || '').toLowerCase() === v);
}

async function recentAddressActivity(addresses, blockCount = 80) {
  const latestHex = await jsonRpc('eth_blockNumber');
  const latest = parseInt(latestHex, 16);
  const count = Math.max(1, Math.min(Number(blockCount) || 80, 200));
  const first = Math.max(0, latest - count + 1);
  const found = [];

  // Read in small batches so this remains a low-impact diagnostic endpoint.
  for (let end = latest; end >= first; end -= 10) {
    const start = Math.max(first, end - 9);
    const nums = [];
    for (let n = end; n >= start; n--) nums.push(n);
    const blocks = await Promise.all(nums.map((n) => jsonRpc('eth_getBlockByNumber', [`0x${n.toString(16)}`, true]).catch(() => null)));
    for (const block of blocks) {
      if (!block) continue;
      for (const tx of block.transactions || []) {
        if (!sameAddress(tx?.from, addresses) && !sameAddress(tx?.to, addresses)) continue;
        found.push({
          hash: tx.hash,
          from: tx.from || null,
          to: tx.to || null,
          value: tx.value || '0x0',
          blockNumber: block.number ? parseInt(block.number, 16) : null,
          timestamp: block.timestamp ? parseInt(block.timestamp, 16) : null,
          input: tx.input || tx.data || null,
        });
      }
    }
    if (found.length >= 30) break;
  }

  return { latest, first, transactions: found.slice(0, 30) };
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

    if (mode === 'recentAddress') {
      const addresses = [src.address, src.alt].filter(Boolean).map(String);
      if (!addresses.length) return res.status(400).json({ ok: false, error: 'address required' });
      const data = await recentAddressActivity(addresses, src.blocks || 80);
      return res.status(200).json({ ok: true, addresses, ...data });
    }

    return res.status(400).json({ ok: false, error: 'bad mode' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e?.message || String(e) });
  }
}
