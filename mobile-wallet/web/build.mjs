import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VERSION = '0.3.2-beta';
const out = resolve('../app/src/main/assets');
await mkdir(out, { recursive: true });
const common = { bundle: true, format: 'iife', target: ['chrome100'], minify: true, sourcemap: false, define: { 'process.env.NODE_ENV': '"production"' } };
await build({ ...common, entryPoints: ['src/signer.js'], outfile: resolve(out, 'signer.bundle.js') });
await build({ ...common, entryPoints: ['src/app.js'], outfile: resolve(out, 'app.bundle.js') });
await copyFile('signer.html', resolve(out, 'signer.html'));
await copyFile('index.html', resolve(out, 'index.html'));
await copyFile('aurora.css', resolve(out, 'aurora.css'));
const indexPath = resolve(out, 'index.html');
let html = await readFile(indexPath, 'utf8');
html = html.replace(/ASENDEX WALLET MOBILE\s+\d+\.\d+\.\d+-beta/g, `ASENDEX WALLET MOBILE ${VERSION}`);
if (!html.includes('aurora.css')) html = html.replace('</head>', '<link rel="stylesheet" href="aurora.css"></head>');
await writeFile(indexPath, html, 'utf8');
console.log(`ASENDEX Wallet Mobile ${VERSION} Aurora Premium assets built`);