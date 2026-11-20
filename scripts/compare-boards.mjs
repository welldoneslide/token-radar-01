// Compare two board.json files (old vs new) and print rank churn, the largest
// implied-value change and the watchlist moves. No writes, no network.
// Usage: node scripts/compare-boards.mjs <old-board.json> <new-board.json> <snapshot.json>
import { readFileSync } from 'node:fs';

const oldB = JSON.parse(readFileSync(process.argv[2], 'utf8')).rows;
const newB = JSON.parse(readFileSync(process.argv[3], 'utf8')).rows;
const snap = JSON.parse(readFileSync(process.argv[4], 'utf8'));
const wl = new Set(snap.watchlist);
const oldRank = new Map(oldB.map((r) => [r.slug, r.rank]));
const oldImpl = new Map(oldB.map((r) => [r.slug, r.implied_value_usd]));

let moved = 0, moved10 = 0, maxMove = 0, sumSq = 0, maxUp = 0, maxUpSlug = '', maxDown = 1, maxDownSlug = '';
for (const r of newB) {
  const d = Math.abs(r.rank - oldRank.get(r.slug));
  if (d > 0) moved++;
  if (d >= 10) moved10++;
  maxMove = Math.max(maxMove, d);
  sumSq += d * d;
  const ratio = r.implied_value_usd / oldImpl.get(r.slug);
  if (ratio > maxUp) { maxUp = ratio; maxUpSlug = r.slug; }
  if (ratio < maxDown) { maxDown = ratio; maxDownSlug = r.slug; }
}
const n = newB.length;
console.log(`rows moved: ${moved} | moved >=10: ${moved10} | max move: ${maxMove} | Spearman: ${(1 - (6 * sumSq) / (n * (n * n - 1))).toFixed(4)}`);
console.log(`largest implied increase vs old: x${maxUp.toFixed(2)} (${maxUpSlug}) | largest decrease: x${maxDown.toFixed(2)} (${maxDownSlug})`);
console.log(`family rows: ${newB.filter((r) => r.model.multiple_source === 'family').length} | global rows: ${newB.filter((r) => r.model.multiple_source === 'global').length} | watchlist global: ${newB.filter((r) => r.model.multiple_source === 'global' && wl.has(r.slug)).length}`);
console.log('--- top 10 new ---');
for (const r of newB.slice(0, 10)) {
  console.log(`  ${String(r.rank).padStart(2)} ${r.slug.padEnd(24)} ${(r.category ?? '').padEnd(26)} mult=${r.model.multiple} src=${r.model.multiple_source} n=${r.model.multiple_n} impl=$${(r.implied_value_usd / 1e6).toFixed(1)}M (was #${oldRank.get(r.slug)})`);
}
console.log('--- watchlist rows with rank change >3 ---');
for (const r of newB.filter((r) => wl.has(r.slug))) {
  const d = r.rank - oldRank.get(r.slug);
  if (Math.abs(d) > 3) {
    console.log(`  ${r.slug.padEnd(24)} ${(r.category ?? '').padEnd(26)} #${oldRank.get(r.slug)} -> #${r.rank} impl $${(oldImpl.get(r.slug) / 1e6).toFixed(1)}M -> $${(r.implied_value_usd / 1e6).toFixed(1)}M`);
  }
}
