// Build USER_GUIDE.html from USER_GUIDE.md: a single self-contained page
// (images embedded as data URIs) that opens by double-click, offline, and
// from inside the extension. Rendered with GitHub's Markdown API (via the
// gh CLI) so it looks the same as the guide on GitHub.
//
// Usage: node scripts/build-guide.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const markdown = readFileSync(join(root, 'USER_GUIDE.md'), 'utf8');
// The guide is versioned by minor release (x.y); patch releases don't change it.
const version = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).version.split('.').slice(0, 2).join('.');

const body = execFileSync('gh', ['api', 'markdown', '--input', '-'], {
  input: JSON.stringify({ text: markdown, mode: 'markdown', context: 'sidmsmith/device-frame-extension' }),
  encoding: 'utf8',
});

const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.gif': 'image/gif' };
const inlined = body.replace(/src="(docs\/[^"]+)"/g, (_, path) => {
  const data = readFileSync(join(root, path)).toString('base64');
  return `src="data:${MIME[extname(path).toLowerCase()]};base64,${data}"`;
});
const missing = inlined.match(/src="(?!data:|https?:)[^"]+"/g);
if (missing) throw new Error(`Images not inlined: ${missing.join(', ')}`);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Device Frame – User Guide</title>
<style>
  :root { color-scheme: light dark; --fg: #1f2328; --muted: #59636e; --bg: #ffffff; --line: #d1d9e0; --code: #f6f8fa; --link: #0969da; }
  @media (prefers-color-scheme: dark) {
    :root { --fg: #e6edf3; --muted: #9198a1; --bg: #0d1117; --line: #3d444d; --code: #151b23; --link: #4493f8; }
  }
  body { margin: 0; background: var(--bg); color: var(--fg);
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; }
  main { max-width: 880px; margin: 0 auto; padding: 32px 24px 64px; }
  h1, h2, h3 { line-height: 1.25; margin: 24px 0 16px; font-weight: 600; }
  h1 { font-size: 2em; padding-bottom: .3em; border-bottom: 1px solid var(--line); }
  h2 { font-size: 1.5em; padding-bottom: .3em; border-bottom: 1px solid var(--line); }
  p, ul, ol, table { margin: 0 0 16px; }
  li + li { margin-top: .25em; }
  a { color: var(--link); text-decoration: none; }
  a:hover { text-decoration: underline; }
  a.anchor { display: none; }
  hr { height: 2px; border: 0; background: var(--line); margin: 24px 0; }
  code { font: 85% ui-monospace, SFMono-Regular, Consolas, monospace; background: var(--code); padding: .2em .4em; border-radius: 6px; }
  table { border-collapse: collapse; display: block; overflow: auto; }
  th, td { border: 1px solid var(--line); padding: 6px 13px; vertical-align: middle; }
  th { font-weight: 600; }
  tr:nth-child(2n) { background: var(--code); }
  img { vertical-align: middle; }
  @media (prefers-color-scheme: dark) { img[src^="data:image/png"] { border-radius: 6px; } }
  .version { color: var(--muted); font-size: 14px; margin-top: -8px; }
</style>
</head>
<body>
<main>
${inlined.replace(/(<\/h1>)/, `$1\n<p class="version">Guide for version ${version}</p>`)}
</main>
</body>
</html>
`;

writeFileSync(join(root, 'USER_GUIDE.html'), html);
console.log(`USER_GUIDE.html written (${Math.round(html.length / 1024)} KB, version ${version})`);
