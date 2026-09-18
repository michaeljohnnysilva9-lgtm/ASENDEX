const NATIVE = { symbol: 'ASE', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', native: true, decimals: 18 };
const EXPLORER = 'https://explorer.asentum.com';
const TREASURY = 'ase16qnk8kgjajray9dltuauf8a7jzjtt0ul5rwqxm';
const FEE_BPS = 10n; // 0.10%
const FEE_DENOM = 10000n;
const GAS_RESERVE = 100000000000000n; // 0.0001 ASE retained when using MAX

let PAIRS = [];
let TOKENS = [NATIVE];
let wallet = '';
let quoteOut = 0n;
let minOut = 0n;
let inBalance = 0n;
let outBalance = 0n;
let impact = null;
let chainOK = false;
let quoteTimer;
let quoteTs = 0;
let allBalances = new Map();
let prices = new Map();
let pairMove = null;
let networkStalled = false;
let networkRecovering = false;
let networkAgeSeconds = null;
let lastObservedBlock = null;
let recoveryAdvances = 0;

const $ = (id) => document.getElementById(id);
const short = (a) => a && a.length > 16 ? `${a.slice(0, 7)}…${a.slice(-5)}` : (a || '—');
const log = (s) => { if ($('log')) $('log').textContent = s; };

function parseUnits(v, d = 18) {
  v = String(v || '');
  if (!/^\d*(\.\d*)?$/.test(v) || !v) return 0n;
  let [a, b = ''] = v.split('.');
  b = (b + '0'.repeat(d)).slice(0, d);
  return BigInt(a || 0) * 10n ** BigInt(d) + BigInt(b || 0);
}

function formatUnits(v, d = 18, p = 8) {
  v = BigInt(v || 0);
  const z = 10n ** BigInt(d);
  const a = v / z;
  const b = (v % z).toString().padStart(d, '0').slice(0, p).replace(/0+$/, '');
  return b ? `${a}.${b}` : String(a);
}

function formatNum(n, p = 4) {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: p });
}

function feeWeiFromASE(aseWei) {
  return BigInt(aseWei || 0) * FEE_BPS / FEE_DENOM;
}

async function api(mode, payload = {}) {
  const r = await fetch('/api/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode, ...payload }),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'read failed');
  return j;
}

async function view(contract, method, args = []) {
  if (wallet && window.asentum?.viewContract) {
    try {
      const r = await window.asentum.viewContract({ to: contract, method, args });
      return r?.result;
    } catch {}
  }
  return (await api('view', { contract, method, args })).result;
}

function tokenByAddress(a) {
  return TOKENS.find((x) => x.address.toLowerCase() === String(a || '').toLowerCase());
}

function findPair(a, b) {
  if (!a || !b) return null;
  const x = a.native ? b : a;
  return PAIRS.find((p) => p.token0.toLowerCase() === x.address.toLowerCase() || p.token1.toLowerCase() === x.address.toLowerCase()) || null;
}

function injectFeeUI() {
  const headRight = document.querySelector('.card .head span.good');
  if (headRight) headRight.textContent = 'Auras AMM · ASENDEX fee 0.10%';

  const meta = document.querySelector('.meta');
  if (meta && !$('asendexFee')) {
    const d = document.createElement('div');
    d.className = 'm';
    d.innerHTML = '<small>ASENDEX fee</small><b id="asendexFee">0.10% · — ASE</b>';
    meta.appendChild(d);
    const r = document.createElement('div');
    r.className = 'm';
    r.innerHTML = '<small>Fee destination</small><b class="mono">ase16q…rwqxm</b>';
    meta.appendChild(r);
  }

  const networkBody = document.querySelector('aside .card .body');
  if (networkBody && !$('treasuryRow')) {
    const row = document.createElement('div');
    row.className = 'kv';
    row.id = 'treasuryRow';
    row.innerHTML = `<span>ASENDEX treasury</span><b class="mono" title="${TREASURY}">${short(TREASURY)}</b>`;
    networkBody.appendChild(row);
  }

  const body = document.querySelector('.grid > .card .body');
  if (body && !$('feeNotice')) {
    const n = document.createElement('div');
    n.id = 'feeNotice';
    n.className = 'risk show med';
    n.style.marginBottom = '10px';
    n.textContent = 'Beta fee model: after a swap is CONFIRMED, the wallet asks for a second explicit approval to send the 0.10% ASENDEX fee in ASE to the public treasury. The fee is never charged before a swap and is not hidden.';
    body.insertBefore(n, body.firstChild);
  }
  if (body && !$('networkHealthNotice')) {
    const n = document.createElement('div');
    n.id = 'networkHealthNotice';
    n.className = 'risk';
    n.style.display = 'none';
    n.style.marginBottom = '10px';
    body.insertBefore(n, body.firstChild);
  }
}

async function network() {
  const j = await api('network');
  chainOK = j.chainId === 1423;
  networkAgeSeconds = j.blockAgeSeconds ?? null;

  const persistedStall = localStorage.getItem('asendex.chain1423.wasStalled') === '1';
  const hardUnhealthy = j.stalled === true || j.rpcMismatch === true || j.healthy === false;

  if (hardUnhealthy) {
    networkStalled = true;
    networkRecovering = false;
    recoveryAdvances = 0;
    localStorage.setItem('asendex.chain1423.wasStalled', '1');
  } else if (persistedStall) {
    if (lastObservedBlock != null && j.blockNumber > lastObservedBlock) recoveryAdvances += 1;
    networkRecovering = recoveryAdvances < 3;
    networkStalled = networkRecovering;
    if (!networkRecovering) {
      localStorage.removeItem('asendex.chain1423.wasStalled');
      recoveryAdvances = 0;
    }
  } else {
    networkStalled = false;
    networkRecovering = false;
    recoveryAdvances = 0;
  }

  lastObservedBlock = j.blockNumber;

  if ($('chain')) $('chain').textContent = j.chainId;
  if ($('block')) $('block').textContent = j.blockNumber.toLocaleString();
  if ($('blk')) $('blk').textContent = '#' + j.blockNumber.toLocaleString();
  if ($('blockAge')) $('blockAge').textContent = networkAgeSeconds == null ? '—' : networkAgeSeconds + 's';
  if ($('rpcHealth')) {
    $('rpcHealth').textContent = j.rpcMismatch === true
      ? 'MISMATCH'
      : (j.secondary ? 'AGREE' : '1 ENDPOINT');
    $('rpcHealth').className = j.rpcMismatch === true ? 'bad' : (j.secondary ? 'good' : 'warn');
  }

  const status = networkRecovering ? 'RECOVERING ' + recoveryAdvances + '/3'
    : (networkStalled ? 'STALLED'
    : (chainOK ? 'LIVE' : 'WRONG CHAIN'));

  if ($('net')) $('net').textContent = status + (chainOK ? ' · 1423' : '');
  if ($('badge')) {
    $('badge').textContent = status;
    $('badge').className = networkStalled || !chainOK ? 'bad' : 'good';
  }

  const notice = $('networkHealthNotice');
  if (notice) {
    if (networkStalled) {
      const age = networkAgeSeconds == null ? 'unknown' : networkAgeSeconds + 's';
      notice.style.display = 'block';
      notice.className = 'risk show high';
      notice.textContent = networkRecovering
        ? 'NETWORK RECOVERING: blocks are moving again, but ASENDEX requires 3 consecutive advancing observations before swaps are re-enabled (' + recoveryAdvances + '/3).'
        : 'NETWORK STALLED / UNHEALTHY: latest block age ' + age + '. New swaps are disabled. Do not resubmit pending transactions until the network recovers.';
    } else {
      notice.style.display = 'none';
    }
  }
  updateButton();
}

async function loadTokenMeta(t) {
  if (t.native) return t;
  try {
    const d = Number(await view(t.address, 'decimals', []));
    if (Number.isFinite(d) && d >= 0 && d <= 36) t.decimals = d;
  } catch {}
  try {
    const s = String(await view(t.address, 'symbol', []) || '').trim();
    if (s) t.symbol = s;
  } catch {}
  return t;
}

async function markets() {
  const j = await api('pairs');
  const old = new Map(prices);
  PAIRS = j.data?.pairs || [];
  prices.clear();

  const m = new Map();
  for (const p of PAIRS) {
    prices.set(String(p.poolId), Number(p.price || 0));
    for (const [address, symbol] of [[p.token0, p.base], [p.token1, p.quote]]) {
      if (address.toLowerCase() !== NATIVE.address && !m.has(address.toLowerCase())) {
        m.set(address.toLowerCase(), { symbol, address, native: false, decimals: 18 });
      }
    }
  }

  // Token contracts are discovered directly from live Auras pair data returned by /api/read.
  // This avoids a hard-coded token list and keeps ASENDEX aligned with pools visible on testnet.
  TOKENS = [NATIVE, ...m.values()];
  await Promise.all(TOKENS.slice(1).map(loadTokenMeta));

  for (const id of ['from', 'to']) {
    const el = $(id);
    if (!el) continue;
    const prev = el.value;
    el.innerHTML = '';
    for (const t of TOKENS) {
      const o = document.createElement('option');
      o.value = t.address;
      o.textContent = t.symbol;
      el.appendChild(o);
    }
    if (prev && TOKENS.some((x) => x.address === prev)) el.value = prev;
  }

  if ($('from') && !$('from').value) $('from').value = NATIVE.address;
  if ($('to') && !$('to').value && TOKENS[1]) $('to').value = TOKENS[1].address;

  const a = tokenByAddress($('from')?.value);
  const b = tokenByAddress($('to')?.value);
  const p = a && b ? findPair(a, b) : null;
  pairMove = null;
  if (p && old.has(String(p.poolId))) {
    const before = old.get(String(p.poolId));
    const now = Number(p.price || 0);
    if (before > 0 && now > 0) pairMove = Math.abs((now - before) / before * 100);
  }

  await refreshAllBalances();
  renderTokens();
  tokenSelectCopyIcon('from');
  tokenSelectCopyIcon('to');
  changed('from', false);
}

async function connect() {
  try {
    if (!window.asentum) { await new Promise(r => setTimeout(r, 700)); }
    if (!window.asentum) throw new Error('Asentum extension not detected. Open ASENDEX in the same browser profile where the Asentum extension is installed, unlock the extension, then reload this page.');
    const r = await window.asentum.connect();
    wallet = r?.address || await window.asentum.getAddress?.() || '';
    if ($('wallet')) $('wallet').textContent = short(wallet);
    if ($('connect')) $('connect').textContent = 'Connected';
    await refreshAllBalances();
    await balances();
    renderTokens();
    renderActivity();
    await refreshActivity();
    updateButton();
  } catch (e) {
    log(`Connect failed: ${e.message}`);
  }
}

async function balanceOf(t) {
  if (!wallet) return 0n;
  if (t.native) return BigInt((await api('balance', { address: wallet })).balance || 0);
  try { return BigInt(await view(t.address, 'balanceOf', [wallet]) || 0); }
  catch { return 0n; }
}

async function refreshAllBalances() {
  if (!wallet) { allBalances.clear(); return; }
  await Promise.all(TOKENS.map(async (t) => {
    try { allBalances.set(t.address.toLowerCase(), await balanceOf(t)); }
    catch { allBalances.set(t.address.toLowerCase(), 0n); }
  }));
}

async function balances() {
  const a = tokenByAddress($('from')?.value);
  const b = tokenByAddress($('to')?.value);
  if (!a || !b || !wallet) return;
  [inBalance, outBalance] = await Promise.all([balanceOf(a), balanceOf(b)]);
  allBalances.set(a.address.toLowerCase(), inBalance);
  allBalances.set(b.address.toLowerCase(), outBalance);
  if ($('bal')) $('bal').textContent = `Balance ${formatUnits(inBalance, a.decimals)} ${a.symbol}`;
  if ($('balout')) $('balout').textContent = `Balance ${formatUnits(outBalance, b.decimals)} ${b.symbol}`;
  updateButton();
}

function renderTokens() {
  const box = $('tokens');
  if (!box) return;
  box.innerHTML = '';
  for (const p of PAIRS) {
    const t = tokenByAddress(p.token0.toLowerCase() === NATIVE.address ? p.token1 : p.token0);
    if (!t) continue;
    const d = document.createElement('div');
    const bal = allBalances.get(t.address.toLowerCase());
    d.className = 'tok';
    d.innerHTML = `<span><b>${t.symbol}/ASE</b><br><small>Pool #${p.poolId} · ${(p.feeBps / 100).toFixed(2)}% · TVL ${formatNum(p.tvlQuote, 2)}</small><div style="display:flex;align-items:center;gap:6px;margin-top:5px"><code class="mono" style="font-size:10px;user-select:all;word-break:break-all" title="${t.address}">${t.address}</code><button class="copy-contract" data-address="${t.address}" title="Copy ${t.symbol} contract" aria-label="Copy ${t.symbol} contract" style="border:0;background:transparent;color:var(--c);cursor:pointer;font-size:15px;padding:2px">⧉</button></div></span><span class="tb">${bal == null ? '—' : `${formatUnits(bal, t.decimals, 6)} ${t.symbol}`}</span>`;
    d.onclick = (ev) => { if (ev.target.closest('.copy-contract')) return; $('from').value = NATIVE.address; $('to').value = t.address; changed('to'); };
    const copyBtn = d.querySelector('.copy-contract');
    if (copyBtn) copyBtn.onclick = async (ev) => { ev.stopPropagation(); try { await navigator.clipboard.writeText(t.address); copyBtn.textContent = '✓'; copyBtn.title = 'Copied'; setTimeout(() => { copyBtn.textContent = '⧉'; copyBtn.title = 'Copy ' + t.symbol + ' contract'; }, 1200); } catch { copyBtn.textContent = '!'; setTimeout(() => copyBtn.textContent = '⧉', 1200); } };
    box.appendChild(d);
  }
  if ($('count')) $('count').textContent = `${PAIRS.length} pairs`;
}

function tokenSelectCopyIcon(id) {
  const sel = $(id);
  if (!sel || sel.parentElement.querySelector('.select-copy-contract')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'select-copy-contract';
  btn.textContent = '⧉';
  btn.title = 'Copy selected token contract';
  btn.setAttribute('aria-label', 'Copy selected token contract');
  btn.style.cssText = 'width:28px;height:28px;padding:0;border:0;background:transparent;color:var(--m);font-size:16px;cursor:pointer;opacity:.72';
  btn.onclick = async () => {
    const t = tokenByAddress(sel.value);
    if (!t || t.native) return;
    try {
      await navigator.clipboard.writeText(t.address);
      btn.textContent = '✓';
      btn.title = t.symbol + ' contract copied';
      setTimeout(() => { btn.textContent = '⧉'; btn.title = 'Copy ' + t.symbol + ' contract'; }, 1200);
    } catch {
      btn.textContent = '!';
      setTimeout(() => btn.textContent = '⧉', 1200);
    }
  };
  sel.insertAdjacentElement('afterend', btn);
}

function changed(src, doQuote = true) {
  let a = tokenByAddress($('from')?.value);
  let b = tokenByAddress($('to')?.value);
  if (!a || !b) return;
  if (a.address === b.address) $(src === 'from' ? 'to' : 'from').value = a.native ? TOKENS[1]?.address : NATIVE.address;
  a = tokenByAddress($('from').value);
  b = tokenByAddress($('to').value);
  if (!a.native && !b.native) $(src === 'from' ? 'to' : 'from').value = NATIVE.address;
  const p = findPair(tokenByAddress($('from').value), tokenByAddress($('to').value));
  if ($('fee')) $('fee').textContent = p ? `${(p.feeBps / 100).toFixed(2)}%` : '—';
  balances();
  if (doQuote) quote();
}

function setRisk(p) {
  const e = $('risk');
  if (!e) return;
  if (impact == null && pairMove == null) { e.className = 'risk'; return; }
  const tvl = Number(p?.tvlQuote || 0);
  let cls = 'low';
  const parts = [];
  if (impact != null) parts.push(`Impacto estimado ${impact.toFixed(2)}%`);
  if (tvl > 0) parts.push(`TVL ${formatNum(tvl, 2)}`);
  if (pairMove != null) parts.push(`pool move recente ${pairMove.toFixed(2)}%`);
  if ((impact ?? 0) >= 5 || tvl < 25 || (pairMove ?? 0) >= 10) {
    cls = 'high';
    parts.unshift('ALERTA: liquidez/variação elevada. Reduza o valor e revise a cotação.');
  } else if ((impact ?? 0) >= 1 || tvl < 100 || (pairMove ?? 0) >= 3) {
    cls = 'med';
    parts.unshift('Atenção: liquidez fina ou preço em movimento.');
  } else parts.unshift('Condições da cotação parecem estáveis para este teste.');
  e.className = `risk show ${cls}`;
  e.textContent = parts.join(' · ');
}

async function getQuote(a, b, p, v) {
  return BigInt(await view(p.amm, 'quote', [String(p.poolId), a.address, v.toString()]));
}

function updateFeePreview(a, b, input, output) {
  const el = $('asendexFee');
  if (!el) return;
  let fee = 0n;
  if (a?.native) fee = feeWeiFromASE(input);
  else if (b?.native) fee = feeWeiFromASE(output);
  el.textContent = `0.10% · ${formatUnits(fee, 18, 8)} ASE`;
}

function quote() {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(async () => {
    quoteOut = 0n; minOut = 0n; impact = null; quoteTs = 0;
    if ($('aout')) $('aout').value = '';
    if ($('min')) $('min').textContent = '—';
    if ($('impact')) $('impact').textContent = '—';
    const a = tokenByAddress($('from')?.value);
    const b = tokenByAddress($('to')?.value);
    const p = findPair(a, b);
    const v = parseUnits($('ain')?.value, a?.decimals || 18);
    updateFeePreview(a, b, v, 0n);
    if (!p || !v) { updateButton(); return; }
    try {
      quoteOut = await getQuote(a, b, p, v);
      minOut = quoteOut * (10000n - BigInt($('slip')?.value || '100')) / 10000n;
      quoteTs = Date.now();
      if ($('aout')) $('aout').value = formatUnits(quoteOut, b.decimals);
      if ($('min')) $('min').textContent = `${formatUnits(minOut, b.decimals)} ${b.symbol}`;
      updateFeePreview(a, b, v, quoteOut);
      const probe = v / 1000n;
      if (probe > 0n && probe < v) {
        const q = await getQuote(a, b, p, probe);
        const linear = q * v / probe;
        if (linear > 0n && quoteOut <= linear) impact = Number((linear - quoteOut) * 10000n / linear) / 100;
      } else impact = 0;
      if ($('impact')) $('impact').textContent = `${impact.toFixed(2)}%`;
      setRisk(p);
      updateButton();
    } catch (e) {
      log(`Quote error: ${e.message}`);
      updateButton();
    }
  }, 250);
}

async function freshQuoteGuard(a, b, p, v) {
  const fresh = await getQuote(a, b, p, v);
  const old = quoteOut;
  if (old <= 0n) { quoteOut = fresh; minOut = fresh * (10000n - BigInt($('slip')?.value || '100')) / 10000n; return true; }
  const diff = old > fresh ? old - fresh : fresh - old;
  const move = Number(diff * 10000n / old) / 100;
  quoteOut = fresh;
  minOut = fresh * (10000n - BigInt($('slip')?.value || '100')) / 10000n;
  if ($('aout')) $('aout').value = formatUnits(quoteOut, b.decimals);
  if ($('min')) $('min').textContent = `${formatUnits(minOut, b.decimals)} ${b.symbol}`;
  updateFeePreview(a, b, v, quoteOut);
  quoteTs = Date.now();
  if (move >= 3) {
    const e = $('risk');
    if (e) {
      e.className = 'risk show high';
      e.textContent = `ALERTA: a cotação mudou ${move.toFixed(2)}% desde a última leitura. Nenhuma transação foi enviada. Revise e confirme novamente.`;
    }
    log(`Swap pausado: pool price moved ${move.toFixed(2)}%.`);
    updateButton();
    return false;
  }
  return true;
}

function updateButton() {
  const btn = $('swap');
  if (!btn) return;
  const a = tokenByAddress($('from')?.value);
  const b = tokenByAddress($('to')?.value);
  const p = a && b ? findPair(a, b) : null;
  const v = a ? parseUnits($('ain')?.value, a.decimals) : 0n;
  if (networkStalled) { btn.disabled = true; btn.textContent = 'Network stalled — do not submit'; return; }
  if (!chainOK) { btn.disabled = true; btn.textContent = 'Chain unavailable'; return; }
  if (!wallet) { btn.disabled = true; btn.textContent = 'Connect wallet to swap'; return; }
  if (!p || !v || !quoteOut) { btn.disabled = true; btn.textContent = 'Enter an amount'; return; }
  const extra = a.native ? feeWeiFromASE(v) + GAS_RESERVE : 0n;
  if (v + extra > inBalance) { btn.disabled = true; btn.textContent = `Insufficient ${a.symbol} balance`; return; }
  if (impact != null && impact >= 20) { btn.disabled = true; btn.textContent = 'Price impact too high'; return; }
  if (quoteTs && Date.now() - quoteTs > 30000) { btn.disabled = true; btn.textContent = 'Quote expired — edit amount'; return; }
  btn.disabled = false;
  btn.textContent = `Swap ${a.symbol} → ${b.symbol}`;
}

async function receipt(hash) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = (await api('receipt', { txHash: hash })).receipt;
      if (r?.blockNumber) return r;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return null;
}

async function call(to, method, args = [], value = '0') {
  const r = await window.asentum.callContract({ to, method, args, value: String(value) });
  const h = r?.txHash || r;
  if (!h) throw new Error('No tx hash returned');
  return h;
}

function decodeEvent(data) {
  try {
    if (!data || !/^0x[0-9a-f]*$/i.test(data)) return null;
    const h = data.slice(2);
    const u = Uint8Array.from([...h.matchAll(/../g)].map((x) => parseInt(x[0], 16)));
    return JSON.parse(new TextDecoder().decode(u));
  } catch { return null; }
}

function actualOut(rcpt, tokenOut) {
  for (const l of rcpt?.logs || []) {
    const j = decodeEvent(l.data);
    if (j?.amountOut != null) return BigInt(j.amountOut);
    if (j?.value != null && j?.to && String(l.address || '').toLowerCase() === tokenOut.address.toLowerCase()) return BigInt(j.value);
  }
  return null;
}

function showTx(ok, hash, rcpt, out, tokenOut, feeInfo = null) {
  const box = $('tx');
  if (!box) return;
  box.className = 'tx show';
  $('txstatus').innerHTML = ok ? '<span class="good">CONFIRMED ✓</span>' : '<span class="bad">REVERTED ✕</span>';
  const feeLine = feeInfo ? `<br>ASENDEX fee: ${feeInfo.amount || '—'} ASE · ${feeInfo.status}${feeInfo.txHash ? ` · <a target="_blank" href="${EXPLORER}/tx/${feeInfo.txHash}">${short(feeInfo.txHash)} ↗</a>` : ''}` : '';
  $('txinfo').innerHTML = `<br>TX: <a target="_blank" href="${EXPLORER}/tx/${hash}">${short(hash)} ↗</a><br>Block: ${parseInt(rcpt.blockNumber, 16)}<br>Gas: ${parseInt(rcpt.gasUsed || '0x0', 16).toLocaleString()}<br>Output real: ${out != null ? `${formatUnits(out, tokenOut.decimals)} ${tokenOut.symbol}` : '—'}${feeLine}`;
}

function activityKey() { return `asendex.activity.1423.${(wallet || 'anonymous').toLowerCase()}`; }
function activities() { try { return JSON.parse(localStorage.getItem(activityKey()) || '[]'); } catch { return []; } }
function saveActivities(a) { localStorage.setItem(activityKey(), JSON.stringify(a.slice(0, 50))); }
function upsertActivity(item) {
  const a = activities();
  const i = a.findIndex((x) => x.hash === item.hash);
  if (i >= 0) a[i] = { ...a[i], ...item }; else a.unshift(item);
  saveActivities(a);
  renderActivity();
}

function renderActivity() {
  const body = $('actbody');
  const empty = $('actempty');
  if (!body || !empty) return;
  const a = activities();
  body.innerHTML = '';
  empty.style.display = a.length ? 'none' : 'block';
  if (!a.length) {
    empty.textContent = wallet ? 'No ASENDEX swaps stored for this wallet yet.' : 'Connect your wallet to load ASENDEX activity.';
    return;
  }
  for (const x of a) {
    const tr = document.createElement('tr');
    const cls = x.status === 'confirmed' ? 'good' : x.status === 'reverted' ? 'bad' : 'warn';
    const status = x.status === 'confirmed' ? 'CONFIRMED ✓' : x.status === 'reverted' ? 'REVERTED ✕' : 'PENDING';
    const feeText = x.feeStatus ? `<br><small class="${x.feeStatus === 'PAID' ? 'good' : 'warn'}">Fee ${x.feeStatus}${x.feeAmount ? ` · ${x.feeAmount} ASE` : ''}</small>` : '';
    tr.innerHTML = `<td class="status ${cls}">${status}</td><td>${x.from} → ${x.to}</td><td>${x.input || '—'} ${x.from}</td><td>${x.output || '—'} ${x.to}${feeText}</td><td>${x.block || '—'}</td><td>${x.gas || '—'}</td><td><a target="_blank" href="${EXPLORER}/tx/${x.hash}">${short(x.hash)} ↗</a>${x.feeTx ? `<br><a target="_blank" href="${EXPLORER}/tx/${x.feeTx}">fee ${short(x.feeTx)} ↗</a>` : ''}</td>`;
    body.appendChild(tr);
  }
}

async function refreshActivity() {
  if (!wallet) return;
  const a = activities();
  let changed = false;
  for (const x of a) {
    if (x.status === 'confirmed' || x.status === 'reverted') continue;
    try {
      const r = (await api('receipt', { txHash: x.hash })).receipt;
      if (!r?.blockNumber) continue;
      const b = tokenByAddress(x.tokenOut) || { address: x.tokenOut, decimals: x.outDecimals || 18, symbol: x.to };
      const yes = String(r.status).toLowerCase() === '0x1';
      const o = yes ? actualOut(r, b) : null;
      x.status = yes ? 'confirmed' : 'reverted';
      x.block = parseInt(r.blockNumber, 16);
      x.gas = parseInt(r.gasUsed || '0x0', 16).toLocaleString();
      x.output = o != null ? formatUnits(o, b.decimals) : '—';
      changed = true;
    } catch {}
  }
  if (changed) { saveActivities(a); renderActivity(); }
}

async function collectFee(aseWei, swapHash) {
  if (aseWei <= 0n) return { status: 'NOT_APPLICABLE', amount: '0' };
  const amount = formatUnits(aseWei, 18, 18);
  if (!window.asentum?.sendTransfer) return { status: 'UNAVAILABLE', amount };

  log(`Swap confirmed. ASENDEX fee: ${formatUnits(aseWei, 18, 8)} ASE.\nApprove the separate fee transfer in your Asentum wallet.\nTreasury: ${TREASURY}`);
  try {
    const r = await window.asentum.sendTransfer({ to: TREASURY, amount: aseWei.toString() });
    const feeHash = r?.txHash || r;
    if (!feeHash) throw new Error('No fee tx hash returned');
    upsertActivity({ hash: swapHash, feeStatus: 'PENDING', feeAmount: formatUnits(aseWei, 18, 8), feeTx: feeHash });
    const fr = await receipt(feeHash);
    if (!fr) return { status: 'PENDING', amount: formatUnits(aseWei, 18, 8), txHash: feeHash };
    const ok = String(fr.status).toLowerCase() === '0x1';
    return { status: ok ? 'PAID' : 'REVERTED', amount: formatUnits(aseWei, 18, 8), txHash: feeHash };
  } catch (e) {
    return { status: 'UNPAID', amount: formatUnits(aseWei, 18, 8), error: e?.message || String(e) };
  }
}

async function swap() {
  const a = tokenByAddress($('from')?.value);
  const b = tokenByAddress($('to')?.value);
  const p = findPair(a, b);
  const v = parseUnits($('ain')?.value, a.decimals);
  $('swap').disabled = true;

  try {
    await network();
    if (networkStalled) throw new Error('Network is stalled, recovering, or RPC heads disagree. No swap was submitted.');
    await balances();
    const preFee = a.native ? feeWeiFromASE(v) : 0n;
    if (a.native && v + preFee + GAS_RESERVE > inBalance) throw new Error('Saldo ASE insuficiente para swap + taxa ASENDEX + reserva de gas');
    if (!a.native && v > inBalance) throw new Error('Saldo insuficiente');
    if (!(await freshQuoteGuard(a, b, p, v))) return;

    if (!a.native) {
      let allowance = 0n;
      try { allowance = BigInt(await view(a.address, 'allowance', [wallet, p.amm]) || 0); } catch {}
      if (allowance < v) {
        log(`Approve ${a.symbol} na extensão…`);
        const approveHash = await call(a.address, 'approve', [p.amm, v.toString()]);
        const approveReceipt = await receipt(approveHash);
        if (!approveReceipt || String(approveReceipt.status).toLowerCase() !== '0x1') throw new Error('Approve falhou/reverteu');
      }
    }

    const inputDisplay = formatUnits(v, a.decimals);
    log(`Confirm swap ${a.symbol} → ${b.symbol}\nASENDEX fee 0.10% is collected only after a confirmed swap.`);
    const hash = await call(p.amm, 'swapExactIn', [String(p.poolId), a.address, v.toString(), minOut.toString()], a.native ? v.toString() : '0');
    upsertActivity({ hash, status: 'pending', from: a.symbol, to: b.symbol, input: inputDisplay, output: '—', tokenOut: b.address, outDecimals: b.decimals, poolId: String(p.poolId), createdAt: Date.now(), feeStatus: 'WAITING_SWAP' });
    log(`Submitted ${hash}\nWaiting receipt…`);

    const r = await receipt(hash);
    if (!r) {
      log('Receipt timeout. NÃO reenvie imediatamente. Activity continuará como PENDING.');
      return;
    }

    const yes = String(r.status).toLowerCase() === '0x1';
    const out = yes ? actualOut(r, b) : null;
    upsertActivity({ hash, status: yes ? 'confirmed' : 'reverted', output: out != null ? formatUnits(out, b.decimals) : '—', block: parseInt(r.blockNumber, 16), gas: parseInt(r.gasUsed || '0x0', 16).toLocaleString(), feeStatus: yes ? 'AWAITING_APPROVAL' : 'NOT_CHARGED' });

    if (!yes) {
      showTx(false, hash, r, null, b, { status: 'NOT_CHARGED', amount: '0' });
      log('✕ REVERTED · ASENDEX fee not charged');
      return;
    }

    let feeWei = 0n;
    if (a.native) feeWei = feeWeiFromASE(v);
    else if (b.native && out != null) feeWei = feeWeiFromASE(out);

    let feeInfo = { status: 'NOT_APPLICABLE', amount: '0' };
    if (feeWei > 0n) {
      feeInfo = await collectFee(feeWei, hash);
      upsertActivity({ hash, feeStatus: feeInfo.status, feeAmount: feeInfo.amount, feeTx: feeInfo.txHash || null });
    }

    showTx(true, hash, r, out, b, feeInfo);
    log(`✓ SWAP CONFIRMED\nASENDEX fee: ${feeInfo.status}${feeInfo.amount ? ` · ${feeInfo.amount} ASE` : ''}${feeInfo.status === 'UNPAID' ? '\nThe swap succeeded; the separate fee approval was not completed.' : ''}`);
    await refreshAllBalances();
    await balances();
    renderTokens();
  } catch (e) {
    log(`Swap stopped: ${e.message}`);
  } finally {
    updateButton();
  }
}


async function selfTransfer(count = 1) {
  if (!wallet) return log('Connect wallet first.');
  if (!window.asentum?.sendTransfer) return log('Wallet transfer API unavailable.');
  const actionLog = $('actionlog');
  const amount = 1000000000000000n; // 0.001 ASE
  try {
    await network();
    if (networkStalled || !chainOK) throw new Error('Network is not healthy.');
    const bal = await balanceOf(NATIVE);
    const needed = amount * BigInt(count) + GAS_RESERVE * BigInt(count);
    if (bal < needed) throw new Error('Insufficient ASE for test transfers + gas.');
    const hashes = [];
    for (let i = 0; i < count; i++) {
      if (actionLog) actionLog.textContent = 'Approve test transaction ' + (i + 1) + '/' + count + ' in your wallet…';
      const r = await window.asentum.sendTransfer({ to: wallet, amount: amount.toString() });
      const h = r?.txHash || r;
      if (!h) throw new Error('No tx hash returned');
      hashes.push(h);
      const rcpt = await receipt(h);
      if (!rcpt || String(rcpt.status).toLowerCase() !== '0x1') throw new Error('Test transaction did not confirm');
    }
    if (actionLog) actionLog.innerHTML = 'CONFIRMED ✓ · ' + hashes.map(h => '<a target="_blank" href="' + EXPLORER + '/tx/' + h + '">' + short(h) + ' ↗</a>').join(' · ') + '<br>These are genuine testnet transactions. ASENDEX does not claim or guarantee XP; Asentum decides XP eligibility.';
    await refreshAllBalances(); await balances(); renderTokens();
  } catch (e) {
    if (actionLog) actionLog.textContent = 'Action stopped: ' + e.message;
  }
}

injectFeeUI();
$('connect') && ($('connect').onclick = connect);
$('from') && ($('from').onchange = () => changed('from'));
$('to') && ($('to').onchange = () => changed('to'));
$('ain') && ($('ain').oninput = quote);
$('slip') && ($('slip').onchange = quote);
$('flip') && ($('flip').onclick = () => { const x = $('from').value; $('from').value = $('to').value; $('to').value = x; changed('from'); });
$('max') && ($('max').onclick = () => {
  const a = tokenByAddress($('from')?.value);
  if (!a || !wallet) return;
  let amount = inBalance;
  if (a.native) {
    // MAX reserves gas and anticipates the 0.10% post-swap fee.
    const usable = amount > GAS_RESERVE ? amount - GAS_RESERVE : 0n;
    amount = usable * FEE_DENOM / (FEE_DENOM + FEE_BPS);
  }
  $('ain').value = formatUnits(amount, a.decimals, 12);
  quote();
});
$('swap') && ($('swap').onclick = swap);
$('selftx') && ($('selftx').onclick = () => selfTransfer(1));
$('batchtx') && ($('batchtx').onclick = () => selfTransfer(3));
$('refreshact') && ($('refreshact').onclick = refreshActivity);
$('clearact') && ($('clearact').onclick = () => { if (wallet) { localStorage.removeItem(activityKey()); renderActivity(); } });

Promise.allSettled([network(), markets()]).then(() => {
  setInterval(() => network().catch(() => {}), 15000);
  setInterval(() => markets().catch(() => {}), 15000);
  setInterval(() => refreshActivity().catch(() => {}), 20000);
  setInterval(updateButton, 5000);
});

if (window.asentum?.getAddress) {
  window.asentum.getAddress().then(async (a) => {
    if (!a) return;
    wallet = a;
    if ($('wallet')) $('wallet').textContent = short(wallet);
    if ($('connect')) $('connect').textContent = 'Connected';
    await refreshAllBalances();
    await balances();
    renderTokens();
    renderActivity();
    refreshActivity();
    updateButton();
  }).catch(() => {});
}
