import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const gradle = await readFile(resolve('../app/build.gradle'), 'utf8');
const versionMatch = gradle.match(/versionName\s+['\"]([^'\"]+)['\"]/);
if (!versionMatch) throw new Error('Android versionName not found');
const VERSION = versionMatch[1];
const out = resolve('../app/src/main/assets');
await mkdir(out, { recursive: true });
const common = { bundle: true, format: 'iife', target: ['chrome100'], minify: true, sourcemap: false, define: { 'process.env.NODE_ENV': '"production"' } };

// The public wallet address is exposed as native ase1... Bech32, while token
// contracts currently expect the equivalent 20-byte 0x address in address
// arguments such as balanceOf(owner) / allowance(owner, spender). Normalize
// ase1 values at the signer boundary so the wallet portfolio and connected
// dApps read the real ERC-20-style testnet token balances without changing
// the address shown to the user.
const signerSourcePath = resolve('src/signer.js');
const signerBuildPath = resolve('src/.signer.build.js');
let signerSource = await readFile(signerSourcePath, 'utf8');
const publicAddressLine = "function publicAddress(w = requireWallet()) { return hexToAse1(w.address); }";
const normalizer = `${publicAddressLine}\nfunction normalizeContractArg(v) {\n  if (typeof v === 'string' && /^ase1[02-9ac-hj-np-z]+$/i.test(v.trim())) {\n    try { return aseToHex(v.trim()); } catch {}\n  }\n  return v;\n}\nfunction normalizeContractArgs(args) { return (args || []).map(normalizeContractArg); }`;
if (!signerSource.includes(publicAddressLine)) throw new Error('signer publicAddress anchor not found');
signerSource = signerSource.replace(publicAddressLine, normalizer);
signerSource = signerSource.replace("args: p.args || [], value: valueForSdk(p.value)", "args: normalizeContractArgs(p.args), value: valueForSdk(p.value)");
signerSource = signerSource.replace("client.viewCall(p.to, p.method, p.args || [])", "client.viewCall(p.to, p.method, normalizeContractArgs(p.args))");
await writeFile(signerBuildPath, signerSource, 'utf8');

try {
  await build({ ...common, entryPoints: [signerBuildPath], outfile: resolve(out, 'signer.bundle.js') });
} finally {
  await rm(signerBuildPath, { force: true });
}
await build({ ...common, entryPoints: ['src/app.js'], outfile: resolve(out, 'app.bundle.js') });
await copyFile('signer.html', resolve(out, 'signer.html'));
await copyFile('index.html', resolve(out, 'index.html'));
await copyFile('aurora.css', resolve(out, 'aurora.css'));
const indexPath = resolve(out, 'index.html');
let html = await readFile(indexPath, 'utf8');
html = html.replace(/ASENDEX WALLET MOBILE\s+\d+\.\d+\.\d+-beta/g, `ASENDEX WALLET MOBILE ${VERSION}`);
if (!html.includes('aurora.css')) html = html.replace('</head>', '<link rel="stylesheet" href="aurora.css"></head>');
await writeFile(indexPath, html, 'utf8');
console.log(`ASENDEX Wallet Mobile ${VERSION} Aurora Premium assets built · ase1 token balance normalization enabled`);
