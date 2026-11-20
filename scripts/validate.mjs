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
check('model version is radar-5', modelSrc.includes(`MODEL_VERSION = 'radar-5'`));
check('no row rests its multiple on <5 comparators',
  rows.every((r) => (r.model.multiple_source === 'size' && r.model.multiple_n === 128) || (r.model.multiple_source === 'family' && r.model.multiple_n >= 5)),
  `${rows.filter((r) => r.model.multiple_source === 'family').length} family rows, ${rows.filter((r) => r.model.multiple_source === 'size').length} size-curve rows`);

// --- radar-5 fields: odds, ranges, if-it-launches, verdicts ---
let badOdds = [];
for (const r of rows) {
  if (typeof r.token_odds !== 'number' || r.token_odds < 0 || r.token_odds > 1) badOdds.push(`${r.slug}: odds ${r.token_odds}`);
  if (!(r.range_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.range_high_usd)) badOdds.push(`${r.slug}: implied outside range`);
  if (!(r.if_launches_usd >= r.implied_value_usd) || !Number.isSafeInteger(r.if_launches_usd) || r.if_launches_usd <= 0) badOdds.push(`${r.slug}: if-launches ${r.if_launches_usd}`);
  if (!r.verdict || !['worth', 'marginal', 'skip'].includes(r.verdict.verdict) || typeof r.verdict.net_per_hour_usd !== 'number') badOdds.push(`${r.slug}: verdict ${JSON.stringify(r.verdict)}`);
}
check('token odds in [0,1], range holds implied, if-launches >= implied, verdict present', badOdds.length === 0, badOdds.slice(0, 5).join('; ') || `${rows.length} rows`);
const vc = { worth: 0, marginal: 0, skip: 0 };
for (const r of rows) vc[r.verdict.verdict]++;

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
check('data.js model version is radar-5', radar.model_version === 'radar-5', radar.model_version);
// recompute implied from the fitted parameters the way dashboard/app.js does
function impliedOf(row, radar) {
  const sc = radar.size_curve;
  let off = 0;
  if (row.multiple_family) {
    const f = (radar.family_offsets || []).find((x) => x.family === row.multiple_family);
    if (f) off = f.offset;
  }
  const mult = Math.min(sc.high_clip, Math.max(sc.low_clip, Math.exp(sc.intercept + sc.slope * (Math.log(row.tvl_usd) - sc.lntvl_mean) + off)));
  const ifLaunches = Math.max(1, Math.round(row.tvl_usd * mult));
  const o = radar.odds;
  const ageY = row.age_days === null ? o.unknown_age_years : Math.min(Math.max(row.age_days / 365, 0), radar.model.odds_age_cap_years);
  const eta = o.intercept + o.age_coef * ageY + o.lntvl_coef * (Math.log(row.tvl_usd) - o.lntvl_mean);
  const odds = Math.min(0.999, Math.max(0.001, 1 / (1 + Math.exp(-Math.min(30, Math.max(-30, eta))))));
  return {
    implied: Math.max(1, Math.round(ifLaunches * odds)),
    multiple: mult,
    ifLaunches,
    odds,
    rangeLow: Math.max(1, Math.round(Math.max(1, Math.round(ifLaunches * odds)) * radar.range.low_factor)),
    rangeHigh: Math.max(1, Math.round(Math.max(1, Math.round(ifLaunches * odds)) * radar.range.high_factor)),
  };
}
let recomputeBad = 0;
let recomputeDetail = '';
for (const d of radar.rows) {
  const c = impliedOf(d, radar);
  const rangeHigh = Math.max(c.rangeLow + 1, c.rangeHigh);
  if (c.implied !== d.implied_value_usd || Math.abs(c.multiple - d.multiple) > 0.0001 || c.ifLaunches !== d.if_launches_usd || Math.abs(c.odds - d.token_odds) > 1e-12 || c.rangeLow !== d.range_low_usd || rangeHigh !== d.range_high_usd) {
    recomputeBad++;
    if (!recomputeDetail) recomputeDetail = `${d.slug}: implied ${c.implied} vs ${d.implied_value_usd}, multiple ${c.multiple} vs ${d.multiple}, if-launches ${c.ifLaunches} vs ${d.if_launches_usd}, odds ${c.odds} vs ${d.token_odds}, range ${c.rangeLow}-${rangeHigh} vs ${d.range_low_usd}-${d.range_high_usd}`;
  }
}
check('page recompute of implied value matches board', recomputeBad === 0, recomputeBad ? `${recomputeBad} rows differ — ${recomputeDetail}` : `${radar.rows.length} rows`);
check('verdict counts match data.js (re-check)', vc.worth === radar.verdict_counts.worth && vc.marginal === radar.verdict_counts.marginal && vc.skip === radar.verdict_counts.skip, `worth ${vc.worth}, marginal ${vc.marginal}, skip ${vc.skip}`);
const compRatios = snap.protocols.filter((p) => p.gecko_id !== null && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0).map((p) => p.mcap_usd / p.tvl_usd).sort((a, b) => a - b);
const snapMedian = compRatios.length % 2 === 1 ? compRatios[compRatios.length >> 1] : (compRatios[(compRatios.length >> 1) - 1] + compRatios[compRatios.length >> 1]) / 2;
check('global multiple matches snapshot recompute', Math.abs(radar.global_multiple - snapMedian) < 1e-4, `global=${radar.global_multiple} (n=${radar.global_n}, snapshot median=${snapMedian.toFixed(6)})`);
const familyN = { curator: 0, staking: 0 };
for (const p of snap.protocols) {
  if (!(p.gecko_id !== null && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)) continue;
  if (['Risk Curators', 'Onchain Capital Allocator', 'Yield Aggregator', 'Yield'].includes(p.category)) familyN.curator++;
  if (['Staking', 'Restaking', 'Staking Pool', 'Liquid Staking'].includes(p.category)) familyN.staking++;
}
check('family offset comparator counts match snapshot', radar.family_offsets.every((f) => f.n === familyN[f.family]), radar.family_offsets.map((f) => `${f.family} n=${f.n} (snapshot ${familyN[f.family]})`).join(', '));
const acctTotal = radar.accounting.reduce((a, g) => a + g.count, 0);
check('protocol accounting sums to 758', acctTotal === 758 && acctTotal === snap.protocols.length, `${acctTotal} = ${radar.accounting.map((g) => `${g.label} ${g.count}`).join(' + ')}`);
const valueKept = radar.value_terms.filter((t) => t.kept).map((t) => t.term);
const oddsKept = radar.odds_terms.filter((t) => t.kept).map((t) => t.term);
check('held-out table keeps exactly size curve + staking offset (value) and age + ln TVL (odds)',
  valueKept.length === 2 && valueKept.includes('+ size curve, ln TVL') && valueKept.includes('+ staking offset') && oddsKept.length === 1 && oddsKept[0] === 'Age + ln TVL',
  `value kept: ${valueKept.join('; ')}; odds kept: ${oddsKept.join('; ')}`);
const oddsKeptRow = radar.odds_terms.find((t) => t.kept);
check('odds KPI matches the held-out table', oddsKeptRow && radar.odds.brier_loo === oddsKeptRow.loo_miss && radar.odds.brier_wf === oddsKeptRow.wf_miss && radar.odds.brier_wf_med === oddsKeptRow.wf2_miss && radar.odds.brier_wf3 === oddsKeptRow.wf3_miss, `brier LOO ${radar.odds.brier_loo}, WF ${radar.odds.brier_wf}/${radar.odds.brier_wf_med}/${radar.odds.brier_wf3}`);
const sizeTerm = radar.value_terms.find((t) => t.term === '+ size curve, ln TVL');
const stakingTerm = radar.value_terms.find((t) => t.term === '+ staking offset');
const curatorTerm = radar.value_terms.find((t) => t.term === '+ curator offset');
check('staking offset never worsens a held-out test vs the size curve alone',
  stakingTerm && stakingTerm.loo_miss <= sizeTerm.loo_miss && stakingTerm.wf_miss <= sizeTerm.wf_miss && stakingTerm.wf2_miss <= sizeTerm.wf2_miss && stakingTerm.wf3_miss <= sizeTerm.wf3_miss,
  `staking LOO ${stakingTerm?.loo_miss} / WF ${stakingTerm?.wf_miss} / ${stakingTerm?.wf2_miss} / ${stakingTerm?.wf3_miss} vs size ${sizeTerm?.loo_miss} / ${sizeTerm?.wf_miss} / ${sizeTerm?.wf2_miss} / ${sizeTerm?.wf3_miss}`);
check('curator offset is dropped and worsens leave-one-out vs the size curve alone',
  curatorTerm && !curatorTerm.kept && curatorTerm.loo_miss > sizeTerm.loo_miss,
  `curator LOO ${curatorTerm?.loo_miss} vs size ${sizeTerm?.loo_miss}`);
check('every held-out term carries the third walk-forward cut',
  radar.value_terms.every((t) => t.wf3_cut === '2024-08-01' && typeof t.wf3_miss === 'number') && radar.odds_terms.every((t) => t.wf3_cut === '2024-08-01' && typeof t.wf3_miss === 'number'),
  `value terms: ${radar.value_terms.length}, odds terms: ${radar.odds_terms.length}`);
check('permutation check is 200 shuffles with sane p-values and staking beating curator',
  radar.permutation && radar.permutation.shuffles === 200 && radar.permutation.staking.p_value >= 0 && radar.permutation.staking.p_value <= 1 && radar.permutation.curator.p_value >= 0 && radar.permutation.curator.p_value <= 1 && radar.permutation.staking.p_value < radar.permutation.curator.p_value,
  `staking p=${radar.permutation?.staking.p_value}, curator p=${radar.permutation?.curator.p_value}`);
check('family offsets hold exactly the staking offset, negative, n>=5',
  radar.family_offsets.length === 1 && radar.family_offsets[0].family === 'staking' && radar.family_offsets[0].offset < 0 && radar.family_offsets[0].n >= 5,
  radar.family_offsets.map((f) => `${f.family} offset ${f.offset.toFixed(4)} n=${f.n}`).join(', '));
check('board has staking-offset rows and size-curve rows',
  rows.some((r) => r.model.multiple_source === 'family' && r.model.multiple_family === 'staking') && rows.some((r) => r.model.multiple_source === 'size'),
  `${rows.filter((r) => r.model.multiple_source === 'family').length} family rows, ${rows.filter((r) => r.model.multiple_source === 'size').length} size-curve rows`);
const bestRow = rows.reduce((a, b) => (b.verdict.net_per_hour_usd > a.verdict.net_per_hour_usd ? b : a), rows[0]);
check('best_farm is the board\'s best net-per-hour row',
  radar.best_farm && radar.best_farm.slug === bestRow.slug && radar.best_farm.name === bestRow.name && Math.abs(radar.best_farm.net_per_hour_usd - bestRow.verdict.net_per_hour_usd) < 1e-9 && radar.best_farm.verdict === bestRow.verdict.verdict,
  `best ${radar.best_farm?.slug} $${radar.best_farm?.net_per_hour_usd}/h (${radar.best_farm?.verdict})`);
const familyTerm = radar.value_terms.find((t) => t.term === '+ staking offset');
check('range calibration covers ~50% held out', Math.abs(radar.range.coverage_loo - radar.range.stated_coverage) < 0.05, `coverage ${radar.range.coverage_loo} vs stated ${radar.range.stated_coverage}`);

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
