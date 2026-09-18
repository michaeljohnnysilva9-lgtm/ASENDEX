const ASENTUM = process.env.ASENTUM_RPC_URL || 'https://testnet.asentum.com';
const EXPLORER_RPC = process.env.ASENTUM_EXPLORER_RPC_URL || 'https://explorer.asentum.com/rpc';
const PAIRS = process.env.AURAS_PAIRS_URL || 'https://auras.asentum.com/api/pairs';

async function jsonRpcAt(url, method, params = []) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'ASENDEX-Beta/4.2' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || 'RPC error');
  return j.result;
}

async function jsonRpc(method, params = []) {
  return jsonRpcAt(EXPLORER_RPC, method, params);
}

function normalizeUnixSeconds(value) {
  if (value == null) return null;
  let n = typeof value === 'string' && value.startsWith('0x') ? parseInt(value, 16) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  while (n > 100000000000) n = Math.floor(n / 1000);
  return Math.floor(n);
}

function normalizeNativeAddress(value) {
  const a = String(value || '').trim();
  // Asentum's current /balance endpoint can return a different result for the
  // same 20-byte hex address when mixed-case hex is supplied. Canonicalize
  // only EVM-style hex addresses; preserve native ase1... strings verbatim.
  return /^0x[0-9a-fA-F]{40}$/.test(a) ? a.toLowerCase() : a;
}

async function getJson(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { ...(options.headers || {}), 'user-agent': 'ASENDEX-Beta/4.2' } });
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
      const block = await jsonRpc('eth_getBlockByNumber', [bn, false]);
      const blockTimestampRaw = block?.timestamp ?? null;
      const blockTimestamp = normalizeUnixSeconds(blockTimestampRaw);
      const now = Math.floor(Date.now() / 1000);
      const blockAgeSeconds = blockTimestamp ? Math.max(0, now - blockTimestamp) : null;
      const stalled = blockAgeSeconds != null ? blockAgeSeconds > 120 : null;

      let secondary = null;
      try {
        const [cid2, bn2] = await Promise.all([
          jsonRpcAt(ASENTUM, 'eth_chainId'),
          jsonRpcAt(ASENTUM, 'eth_blockNumber'),
        ]);
        secondary = {
          chainId: parseInt(cid2, 16),
          blockNumber: parseInt(bn2, 16),
        };
      } catch {}

      const chainId = parseInt(cid, 16);
      const blockNumber = parseInt(bn, 16);
      const divergenceBlocks = secondary ? Math.abs(blockNumber - secondary.blockNumber) : null;
      const rpcMismatch = secondary
        ? secondary.chainId !== chainId || divergenceBlocks > 2
        : null;
      const healthy = stalled === false && rpcMismatch !== true;

      return res.status(200).json({
        ok: true,
        chainId,
        blockNumber,
        blockHash: block?.hash || null,
        parentHash: block?.parentHash || null,
        blockTimestamp,
        blockTimestampRaw,
        blockAgeSeconds,
        stalled,
        stallThresholdSeconds: 120,
        secondary,
        divergenceBlocks,
        rpcMismatch,
        healthy,
      });
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
      const address = normalizeNativeAddress(src.address);
      if (!address) return res.status(400).json({ ok: false, error: 'address required' });
      const data = await getJson(`${ASENTUM}/balance/${encodeURIComponent(address)}`, { cache: 'no-store' });
      return res.status(200).json({ ok: true, balance: String(data?.balance ?? '0'), normalizedAddress: address });
    }

    if (mode === 'receipt') {
      const r = await fetch(`${ASENTUM}/receipts/${encodeURIComponent(src.txHash)}`, {
        cache: 'no-store',
        headers: { 'user-agent': 'ASENDEX-Beta/4.2' },
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
