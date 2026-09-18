import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const out = resolve('../app/src/main/assets');
await mkdir(out, { recursive: true });
await build({
  entryPoints: ['src/signer.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome100'],
  outfile: resolve(out, 'signer.bundle.js'),
  minify: true,
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' }
});
await copyFile('signer.html', resolve(out, 'signer.html'));
await copyFile('index.html', resolve(out, 'index.html'));
console.log('web assets built');
