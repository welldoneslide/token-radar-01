// Headless smoke test for dashboard/app.js: runs the page's IIFE against a minimal DOM stub
// (no browser available in this VM) and asserts the board, multiples table and detail view render.
// Usage: node scripts/smoke-dom.mjs <out-dir> [#hash]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2];
const hash = process.argv[3] || '';
if (!outDir) { console.error('usage: node scripts/smoke-dom.mjs <out-dir> [#hash]'); process.exit(2); }

const radar = JSON.parse(readFileSync(join(outDir, 'data.js'), 'utf8').replace(/^window\.RADAR=/, '').replace(/;\s*$/, ''));
const appJs = readFileSync('dashboard/app.js', 'utf8');

function makeEl(tag) {
  const el = {
    tag, children: [], attrs: {}, style: {}, className: '', textContent: '', open: false, isConnected: false,
    setAttribute(k, v) { this.attrs[k] = v; },
    getAttribute(k) { return this.attrs[k]; },
    addEventListener() {},
    appendChild(c) { c.isConnected = true; this.children.push(c); return c; },
    showModal() { this.open = true; },
    close() { this.open = false; },
  };
  return el;
}
const appEl = makeEl('main');
const documentStub = {
  getElementById: () => appEl,
  createElement: (tag) => makeEl(tag),
  createTextNode: (s) => ({ text: String(s), isConnected: false }),
};
const windowStub = {
  RADAR: radar,
  location: { hash, pathname: '/index.html', search: '' },
  history: { replaceState() {} },
  addEventListener() {},
};

new Function('window', 'document', appJs)(windowStub, documentStub);

function walk(node, out) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.textContent === 'string' && node.textContent) out.push(node.textContent);
  if (typeof node.text === 'string' && node.text) out.push(node.text);
  if (Array.isArray(node.children)) node.children.forEach((c) => walk(c, out));
}
function findAll(node, pred, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (pred(node)) out.push(node);
  if (Array.isArray(node.children)) node.children.forEach((c) => findAll(c, pred, out));
  return out;
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const texts = [];
walk(appEl, texts);
const joined = texts.join(' | ');

// Board table: one tbody row per shown protocol.
const tbodies = findAll(appEl, (n) => n.tag === 'tbody');
const boardRows = tbodies.length ? tbodies[0].children.length : 0;
const expectedRows = hash.includes('category=')
  ? radar.rows.filter((r) => r.category === decodeURIComponent(hash.split('category=')[1].split('&')[0])).length
  : radar.rows.length;
check('board table renders expected rows', boardRows === expectedRows, `${boardRows} rows (expected ${expectedRows})`);

// Multiples table: 14 category rows + 1 global row.
const multiples = findAll(appEl, (n) => n.className && n.className.includes('multiples'));
const multRows = multiples.length ? findAll(multiples[0], (n) => n.tag === 'tbody')[0].children.length : 0;
check('multiples table renders 14 categories + global', multRows === radar.multiples.length + 1, `${multRows} rows`);

// Fallback honesty: the page names the global multiple and its counts.
check('page states global multiple value', joined.includes(radar.global_multiple.toFixed(4)), `global=${radar.global_multiple}`);
check('page states fallback counts', joined.includes(String(radar.fallback_rows)) && joined.includes(String(radar.fallback_watchlist)));

// Detail view via hash: dialog should open and show the Multiple (n) row.
const dialogs = findAll(appEl, (n) => n.tag === 'dialog');
if (hash.includes('p=')) {
  const slug = decodeURIComponent(hash.split('p=')[1].split('&')[0]);
  const row = radar.rows.find((r) => r.slug === slug);
  const dtexts = [];
  dialogs.forEach((d) => walk(d, dtexts));
  const djoined = dtexts.join(' | ');
  check(`detail view opens for ${slug}`, dialogs.length > 0 && dialogs[0].open, `dialog open=${dialogs[0]?.open}`);
  check('detail shows Multiple (n)', djoined.includes('Multiple (n)') && djoined.includes(`${row.multiple.toFixed(4)} (n=${row.multiple_n})`),
    `${row.multiple.toFixed(4)} (n=${row.multiple_n}), source=${row.multiple_source}`);
  if (row.multiple_source === 'global') check('detail marks global fallback', djoined.includes('global fallback'));
} else {
  check('no detail dialog open without hash', dialogs.length === 0 || !dialogs[0].open);
}

console.log(failures === 0 ? 'SMOKE TEST PASSED' : `${failures} SMOKE CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
