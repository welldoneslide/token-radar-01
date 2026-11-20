// Simulation for the radar-3 multiple rule. Reads the sealed snapshot, prints the
// evidence (comparator counts and medians per category, ratio percentiles), then
// scores the radar-2 board under each candidate rule and compares the rankings.
// No writes, no network. Usage: node scripts/simulate-radar3.mjs <snapshot.json>
import { readFileSync } from 'node:fs';
import { ageDays, buildBoard, computeMultiples, isComparator, isRankable, median, MODEL, parseSnapshot } from '../lib/model.ts';

const snap = parseSnapshot(readFileSync(process.argv[2], 'utf8'));
const stats = computeMultiples(snap);
const ratios = snap.protocols.filter(isComparator).map((p) => p.mcap_usd / p.tvl_usd).sort((a, b) => a - b);
const pct = (q) => ratios[Math.min(ratios.length - 1, Math.floor(q * ratios.length))];

console.log(`global multiple ${stats.globalMultiple} (n=${stats.globalN})`);
console.log('ratio percentiles p5 p10 p25 p50 p75 p90 p95:', [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95].map((q) => pct(q).toFixed(4)).join(' '));
console.log('--- categories: comparators (n) and median ---');
for (const [c, v] of [...stats.byCategory.entries()].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`${c.padEnd(30)} n=${String(v.n).padStart(3)} median=${v.multiple.toFixed(4)}`);
}

const base = buildBoard(snap);
const baseRank = new Map(base.map((r) => [r.slug, r.rank]));
const baseImpl = new Map(base.map((r) => [r.slug, r.implied_value_usd]));

// A board scored with an alternate multiple rule. The rule returns the multiple,
// its evidence count and its source label for one category.
function boardWith(rule) {
  const scored = base.map((r) => {
    const p = snap.protocols.find((x) => x.slug === r.slug);
    const { multiple, n, source } = rule(p.category, stats);
    const age = ageDays(snap.as_of, p.listed_at);
    const growthPct = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, p.change_7d ?? 0));
    const growthMult = 1 + (growthPct / 100) * MODEL.growth_weight;
    const ageForModel = age ?? MODEL.unknown_age_days;
    const maturityMult = MODEL.maturity_floor + (Math.min(Math.max(ageForModel, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
    const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growthMult * maturityMult));
    return { slug: r.slug, name: r.name, category: r.category, multiple, n, source, implied };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  scored.forEach((s, i) => { s.rank = i + 1; });
  return scored;
}

function report(name, board) {
  const rankOf = new Map(board.map((r) => [r.slug, r.rank]));
  let moved = 0, moved10 = 0, maxMove = 0;
  let maxRatio = 0, maxRatioSlug = '';
  let sumSq = 0;
  for (const r of board) {
    const d = Math.abs(r.rank - baseRank.get(r.slug));
    if (d > 0) moved++;
    if (d >= 10) moved10++;
    maxMove = Math.max(maxMove, d);
    const ratio = r.implied / baseImpl.get(r.slug);
    if (ratio > maxRatio) { maxRatio = ratio; maxRatioSlug = r.slug; }
    sumSq += d * d;
  }
  const n = board.length;
  const spearman = 1 - (6 * sumSq) / (n * (n * n - 1));
  const globalRows = board.filter((r) => r.source === 'global').length;
  const wl = new Set(snap.watchlist);
  const wlGlobal = board.filter((r) => r.source === 'global' && wl.has(r.slug)).length;
  const distinctMult = new Set(board.map((r) => r.multiple)).size;
  console.log(`\n== ${name} ==`);
  console.log(`global-source rows: ${globalRows}/200 (${wlGlobal} watchlist) | distinct multiples: ${distinctMult}`);
  console.log(`rank churn vs radar-2: ${moved} rows moved, ${moved10} moved >=10, max move ${maxMove}, Spearman ${spearman.toFixed(4)}`);
  console.log(`largest implied-value jump vs radar-2: x${maxRatio.toFixed(2)} (${maxRatioSlug})`);
  console.log('top 10:');
  for (const r of board.slice(0, 10)) {
    console.log(`  ${String(r.rank).padStart(2)} ${r.slug.padEnd(28)} ${String(r.category).padEnd(26)} mult=${r.multiple.toFixed(4)} src=${r.source} n=${r.n} impl=$${(r.implied / 1e6).toFixed(1)}M (was #${baseRank.get(r.slug)})`);
  }
}

const G = stats.globalMultiple;
const catMed = (c) => stats.byCategory.get(c ?? 'Other');

report('radar-2 (baseline)', base.map((r) => ({ ...r, multiple: r.model.multiple, n: r.model.multiple_n, source: r.model.multiple_source, implied: r.implied_value_usd })));

// R1: shrinkage k=3, no clip.
report('R1 shrinkage k=3, no clip', boardWith((c) => {
  const e = catMed(c);
  if (!e) return { multiple: G, n: stats.globalN, source: 'global' };
  const w = e.n / (e.n + 3);
  return { multiple: Math.round((w * e.multiple + (1 - w) * G) * 1e4) / 1e4, n: e.n, source: 'blended' };
}));

// R2: shrinkage k=10, no clip.
report('R2 shrinkage k=10, no clip', boardWith((c) => {
  const e = catMed(c);
  if (!e) return { multiple: G, n: stats.globalN, source: 'global' };
  const w = e.n / (e.n + 10);
  return { multiple: Math.round((w * e.multiple + (1 - w) * G) * 1e4) / 1e4, n: e.n, source: 'blended' };
}));

// R3: shrinkage k=5, category median winsorized to [P10, P90] of comparator ratios.
const lo = pct(0.1), hi = pct(0.9);
console.log(`\nwinsor clip for R3: [${lo.toFixed(4)}, ${hi.toFixed(4)}]`);
report('R3 shrinkage k=5, median clipped to [P10,P90]', boardWith((c) => {
  const e = catMed(c);
  if (!e) return { multiple: G, n: stats.globalN, source: 'global' };
  const clipped = Math.min(hi, Math.max(lo, e.multiple));
  const w = e.n / (e.n + 5);
  return { multiple: Math.round((w * clipped + (1 - w) * G) * 1e4) / 1e4, n: e.n, source: 'blended' };
}));

// R4: family pooling. Families group categories that are the same economic activity;
// a family's median is the median of all its comparators. Own median when n>=3,
// else family median when the family has n>=5, else global.
const FAMILIES = {
  curator: ['Risk Curators', 'Onchain Capital Allocator', 'Yield Aggregator', 'Yield'],
  staking: ['Staking', 'Restaking', 'Staking Pool', 'Liquid Staking'],
  bridge: ['Bridge', 'Cross Chain', 'Bridge Aggregator'],
};
function familyOf(c) {
  for (const [name, members] of Object.entries(FAMILIES)) if (members.includes(c ?? '')) return name;
  return null;
}
function familyStats(name) {
  const members = new Set(FAMILIES[name]);
  const rs = snap.protocols.filter((p) => isComparator(p) && members.has(p.category ?? '')).map((p) => p.mcap_usd / p.tvl_usd);
  return rs.length ? { multiple: Math.round(median(rs) * 1e4) / 1e4, n: rs.length } : null;
}
for (const name of Object.keys(FAMILIES)) console.log(`family ${name}:`, familyStats(name));
report('R4 family pooling (own n>=3, else family n>=5, else global)', boardWith((c) => {
  const e = catMed(c);
  if (e && e.n >= 3) return { multiple: e.multiple, n: e.n, source: 'category' };
  const f = familyOf(c);
  if (f) {
    const fs = familyStats(f);
    if (fs && fs.n >= 5) return { multiple: fs.multiple, n: fs.n, source: 'family' };
  }
  return { multiple: G, n: stats.globalN, source: 'global' };
}));

// R5: family pooling + shrinkage for the categories left on global with 1-2 comparators.
report('R5 family pooling + shrinkage k=5 clipped for the rest', boardWith((c) => {
  const e = catMed(c);
  if (e && e.n >= 3) return { multiple: e.multiple, n: e.n, source: 'category' };
  const f = familyOf(c);
  if (f) {
    const fs = familyStats(f);
    if (fs && fs.n >= 5) return { multiple: fs.multiple, n: fs.n, source: 'family' };
  }
  if (e && e.n >= 1) {
    const clipped = Math.min(hi, Math.max(lo, e.multiple));
    const w = e.n / (e.n + 5);
    return { multiple: Math.round((w * clipped + (1 - w) * G) * 1e4) / 1e4, n: e.n, source: 'blended' };
  }
  return { multiple: G, n: stats.globalN, source: 'global' };
}));

// --- R4 detail: who is still on the global multiple, who moved a lot, watchlist moves ---
const r4 = boardWith((c) => {
  const e = catMed(c);
  if (e && e.n >= 3) return { multiple: e.multiple, n: e.n, source: 'category' };
  const f = familyOf(c);
  if (f) {
    const fs = familyStats(f);
    if (fs && fs.n >= 5) return { multiple: fs.multiple, n: fs.n, source: 'family' };
  }
  return { multiple: G, n: stats.globalN, source: 'global' };
});
console.log('\n== R4 detail: remaining global-source rows by category ==');
const gby = new Map();
for (const r of r4.filter((r) => r.source === 'global')) gby.set(r.category, (gby.get(r.category) ?? 0) + 1);
for (const [c, n] of [...gby.entries()].sort((a, b) => b[1] - a[1])) {
  const comp = catMed(c);
  console.log(`  ${(c ?? 'null').padEnd(28)} ${n} rows (comparators n=${comp ? comp.n : 0}${comp ? ', median=' + comp.multiple.toFixed(4) : ''})`);
}
console.log('== R4 detail: rows that moved >=10 ranks ==');
for (const r of r4) {
  const d = r.rank - baseRank.get(r.slug);
  if (Math.abs(d) >= 10) console.log(`  ${r.slug.padEnd(28)} ${(r.category ?? '').padEnd(26)} #${baseRank.get(r.slug)} -> #${r.rank} (${d > 0 ? '+' : ''}${d}) src=${r.source} mult=${r.multiple}`);
}
console.log('== R4 detail: watchlist rows whose rank changed ==');
const wl = new Set(snap.watchlist);
for (const r of r4.filter((r) => wl.has(r.slug))) {
  const d = r.rank - baseRank.get(r.slug);
  if (d !== 0) console.log(`  ${r.slug.padEnd(28)} ${(r.category ?? '').padEnd(26)} #${baseRank.get(r.slug)} -> #${r.rank} (${d > 0 ? '+' : ''}${d}) src=${r.source} mult=${r.multiple} impl=$${(r.implied / 1e6).toFixed(1)}M (was $${(baseImpl.get(r.slug) / 1e6).toFixed(1)}M)`);
}
