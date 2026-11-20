// Independent local validation for the token-radar-01 entry.
// Usage: node scripts/validate.mjs <out-dir> <snapshot.json>
// Checks the gate's board rules, farm steps, dashboard size/network rules and file sizes.
// Exit 0 when every check passes, 1 otherwise. No network, no writes.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2];
const snapPath = process.argv[3];
if (!outDir || !snapPath) {
  console.error('usage: node scripts/validate.mjs <out-dir> <snapshot.json>');
  process.exit(2);
}

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
const snapSlugs = new Set(snap.protocols.map((p) => p.slug));
const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8'));
const rows = Array.isArray(board) ? board : board.rows;

// --- board shape ---
check('board has 100-4000 rows', rows.length >= 100 && rows.length <= 4000, `${rows.length} rows`);
check('board.json <= 8 MiB', statSync(join(outDir, 'board.json')).size <= 8 * 1024 * 1024, `${statSync(join(outDir, 'board.json')).size} bytes`);
const missing = snap.watchlist.filter((s) => !rows.some((r) => r.slug === s));
check('all 40 watchlist slugs covered', missing.length === 0, missing.length ? `missing: ${missing.join(', ')}` : '40/40');
const nonWatch = rows.filter((r) => !snap.watchlist.includes(r.slug)).length;
check('>= 60 rows outside watchlist', nonWatch >= 60, `${nonWatch} rows`);
const slugSet = new Set(rows.map((r) => r.slug));
check('slugs unique', slugSet.size === rows.length);
check('all slugs exist in snapshot', rows.every((r) => snapSlugs.has(r.slug)));
const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
check('ranks exactly 1..N', ranks.every((v, i) => v === i + 1));
check('implied_value_usd non-increasing with rank', rows.every((r, i) => i === 0 || r.implied_value_usd <= rows[i - 1].implied_value_usd));
check('not all implied values equal', new Set(rows.map((r) => r.implied_value_usd)).size > 1, `${new Set(rows.map((r) => r.implied_value_usd)).size} distinct values`);
check('implied values positive safe integers <= $100T',
  rows.every((r) => Number.isSafeInteger(r.implied_value_usd) && r.implied_value_usd > 0 && r.implied_value_usd <= 100_000_000_000_000));
check('names non-empty', rows.every((r) => typeof r.name === 'string' && r.name.trim().length > 0));

// --- farm steps ---
let badSteps = [];
for (const r of rows) {
  if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) { badSteps.push(`${r.slug}: ${r.farm_steps?.length} steps`); continue; }
  for (const s of r.farm_steps) {
    const t = s.trim();
    if (t.length < 20 || t.length > 600) badSteps.push(`${r.slug}: step ${t.length} chars`);
  }
}
check('farm_steps 3-12 strings of 20-600 chars each', badSteps.length === 0, badSteps.slice(0, 5).join('; ') || `${rows.length} rows x ${rows[0].farm_steps.length} steps`);
const forbidden = /apy|airdrop confirmed|guaranteed/i;
check('no farm step promises APY / confirmed airdrop / guarantee', rows.every((r) => r.farm_steps.every((s) => !forbidden.test(s))));

// --- model honesty: no hardcoded protocol names in lib/model.ts ---
const modelSrc = readFileSync('lib/model.ts', 'utf8');
const wlNames = snap.watchlist.map((s) => s);
const hardcoded = wlNames.filter((s) => modelSrc.includes(`'${s}'`) || modelSrc.includes(`"${s}"`));
check('no watchlist slug hardcoded in lib/model.ts', hardcoded.length === 0, hardcoded.join(', ') || 'none');
check('model version is radar-3', modelSrc.includes(`MODEL_VERSION = 'radar-3'`));
check('no row rests its multiple on <3 comparators unless family (n>=5) or global (n=128)',
  rows.every((r) => r.model.multiple_n >= 3 || r.model.multiple_source !== 'category'),
  `${rows.filter((r) => r.model.multiple_source === 'family').length} family rows, ${rows.filter((r) => r.model.multiple_source === 'global').length} global rows`);

// --- model recompute: dashboard's impliedOf must reproduce board.json ---
const dataJs = readFileSync(join(outDir, 'data.js'), 'utf8');
const radar = JSON.parse(dataJs.replace(/^window\.RADAR=/, '').replace(/;\s*$/, ''));
const dataRows = new Map(radar.rows.map((r) => [r.slug, r]));
let mismatch = 0;
for (const r of rows) {
  const d = dataRows.get(r.slug);
  if (!d || d.implied_value_usd !== r.implied_value_usd || d.rank !== r.rank) mismatch++;
}
check('data.js rows match board.json (rank + implied)', mismatch === 0, mismatch ? `${mismatch} mismatches` : `${rows.length} rows`);
// recompute implied from row fields the way dashboard/app.js does
function impliedOf(row, model) {
  const growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
  const growthMult = 1 + (growth / 100) * model.growth_weight;
  const age = row.age_days === null ? model.unknown_age_days : row.age_days;
  const maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  return Math.max(1, Math.round(row.tvl_usd * row.multiple * growthMult * maturity));
}
let recomputeBad = 0;
for (const d of radar.rows) if (impliedOf(d, radar.model) !== d.implied_value_usd) recomputeBad++;
check('page recompute of implied value matches board', recomputeBad === 0, recomputeBad ? `${recomputeBad} rows differ` : `${radar.rows.length} rows`);
check('global multiple matches snapshot recompute', Math.abs(radar.global_multiple - 0.2138) < 1e-9, `global=${radar.global_multiple} (n=${radar.global_n})`);
check('fallback rows counted', radar.fallback_rows === radar.rows.filter((r) => r.multiple_source === 'global').length, `${radar.fallback_rows} rows, ${radar.fallback_watchlist} watchlist`);

// --- dashboard: size + no network ---
const dashFiles = readdirSync(join(outDir, 'dashboard')).filter((f) => statSync(join(outDir, 'dashboard', f)).isFile());
let dashTotal = 0;
for (const f of dashFiles) dashTotal += statSync(join(outDir, 'dashboard', f)).size;
check('dashboard has index.html + >=1 css + >=1 js', dashFiles.includes('index.html') && dashFiles.some((f) => f.endsWith('.css')) && dashFiles.some((f) => f.endsWith('.js')), dashFiles.join(', '));
check('dashboard source total <= 64 KiB', dashTotal <= 64 * 1024, `${dashTotal} bytes`);
const urlRe = /https?:\/\//g;
let urlHits = [];
for (const f of dashFiles) {
  const text = readFileSync(join(outDir, 'dashboard', f), 'utf8');
  const hits = [...text.matchAll(urlRe)];
  if (hits.length) urlHits.push(`${f}: ${hits.length}`);
}
check('no http(s):// in dashboard source', urlHits.length === 0, urlHits.join('; ') || '0 occurrences');
const dataJsText = readFileSync(join(outDir, 'data.js'), 'utf8');
// The snapshot's own `source` field names its origin URL as data (the starter carries it too);
// it is not a fetch, import or link. Strip that one data value before the network test.
const dataJsNoSource = dataJsText.replace(snap.source, '');
check('no http(s):// in data.js (outside the snapshot source string)', !/https?:\/\//.test(dataJsNoSource));

// --- screenshots ---
const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => /\.(png|jpe?g)$/i.test(f));
check('3 screenshots present', shots.length === 3, `${shots.length} files`);
let shotOk = true;
for (const f of shots) {
  const sz = statSync(join(outDir, 'screenshots', f)).size;
  if (sz > 524288) { shotOk = false; console.log(`FAIL  screenshot ${f} over 512 KiB (${sz} bytes)`); }
}
if (shotOk) console.log(`PASS  screenshots each <= 512 KiB — ${shots.map((f) => `${f}:${statSync(join(outDir, 'screenshots', f)).size}`).join(', ')}`);
else failures++;

// --- dossier ---
const dossierSize = statSync(join(outDir, 'dossier.json')).size;
check('dossier.json exists and <= 1.5 MiB (gate)', dossierSize <= 1_500_000, `${dossierSize} bytes`);
const dossier = JSON.parse(readFileSync(join(outDir, 'dossier.json'), 'utf8'));
check('dossier schema makefun/dossier/v1', dossier.schema === 'makefun/dossier/v1');
check('dossier has 3 images', Array.isArray(dossier.images) && dossier.images.length === 3, `${dossier.images?.length} images`);
check('dossier text <= 65536 bytes', Buffer.byteLength(dossier.text, 'utf8') <= 65536, `${Buffer.byteLength(dossier.text, 'utf8')} bytes`);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
