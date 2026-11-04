// Copies the Gacha Machine toy's web page into public/gacha/ so sarxina.com/gacha/ serves it as is.
// The toy's own folder stays the source: change it there, then run `node scripts/copy-gacha.mjs`.
// It also writes public/gacha/callback/ (where Twitch sends logins back) and public/gatcha/ (the other spelling).
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2] || resolve(root, '../Random VTuber Toys/GachaMachine/web');
const out = join(root, 'public/gacha');

rmSync(out, { recursive: true, force: true });
// data/blocklist.json is for the tools that build the pool; the page doesn't read it
cpSync(src, out, { recursive: true, filter: (p) => p !== join(src, 'data', 'blocklist.json') });

// The callback page is the same page one folder down, pointed back at /gacha/ for its files.
const page = readFileSync(join(out, 'index.html'), 'utf8');
mkdirSync(join(out, 'callback'), { recursive: true });
writeFileSync(join(out, 'callback/index.html'), page.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n  <base href="/gacha/" />'));

mkdirSync(join(root, 'public/gatcha'), { recursive: true });
writeFileSync(join(root, 'public/gatcha/index.html'), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sarxina Chat Gacha</title>
  <link rel="canonical" href="https://sarxina.com/gacha/" />
  <meta http-equiv="refresh" content="0; url=/gacha/" />
  <script>location.replace('/gacha/' + location.search + location.hash);</script>
</head>
<body><a href="/gacha/">sarxina.com/gacha</a></body>
</html>
`);
console.log(`copied ${src} -> ${out}`);
