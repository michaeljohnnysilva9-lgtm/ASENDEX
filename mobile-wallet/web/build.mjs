import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('../app/src/main/assets');
await mkdir(out, { recursive: true });
const common = { bundle: true, format: 'iife', target: ['chrome100'], minify: true, sourcemap: false, define: { 'process.env.NODE_ENV': '"production"' } };
await build({ ...common, entryPoints: ['src/signer.js'], outfile: resolve(out, 'signer.bundle.js') });
await build({ ...common, entryPoints: ['src/app.js'], outfile: resolve(out, 'app.bundle.js') });
await copyFile('signer.html', resolve(out, 'signer.html'));
await copyFile('index.html', resolve(out, 'index.html'));
console.log('ASENDEX Wallet Mobile web assets built');