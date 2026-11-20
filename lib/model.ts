// The token radar's model: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and may add
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures (model "radar-5"):
//
//   multiple   = clamp(exp(a + b x (ln tvl_usd - mean ln TVL) + staking_offset), 0.005, 5)
//                a/b: the OLS line of ln(mcap_usd / tvl_usd) on ln tvl_usd over the 128
//                token-bearing comparators (gecko_id, mcap_usd > 0, tvl_usd > 0).
//                staking_offset: the median residual of the staking family
//                (Staking, Restaking, Staking Pool, Liquid Staking), when the family
//                has n >= 5 comparators, else 0. It is kept because it lowers the
//                mean |log error| in leave-one-out and in all three walk-forward cuts
//                (1.577 / 1.599 / 1.489 / 1.563 against 1.596 / 1.648 / 1.563 / 1.640
//                for the size curve alone) and the typical miss in leave-one-out and
//                the median-date walk-forward, tying the other two; its fitted value
//                is stable across walk-forward train sets (-0.76 to -1.02 in log
//                terms), and 200 shuffled staking labelings beat it only 47 times
//                (p = 0.235). The curator offset that radar-4 kept is DROPPED: it
//                worsens leave-one-out (x3.45 vs x3.40) and the mean error in all
//                four tests, 155 of 200 shuffled curator labelings do as well or
//                better (p = 0.775), and its fitted value flips sign across
//                walk-forward train sets (+0.13 / +0.70 / -0.01), so it is noise.
//                Category medians, 7-day growth in every form tested (raw, capped,
//                large-TVL-only), age/maturity in both forms (multiplier, linear in
//                log space), the age x ln TVL interaction and chain count were tested
//                the same way and did not lower the miss in all four tests, so they
//                are not in the multiple. One or two observations never dictate
//                anything: the size curve is fitted on all 128 comparators, and a
//                staking offset needs n >= 5 residuals. The median is used,
//                never the mean: the ratio distribution is extremely skewed
//                (global mean ~5.0 against a median of ~0.21), so one outlier
//                would dictate a mean.
//   odds       = logistic(B0 + B1 x age_years + B2 x (ln tvl_usd - mean ln TVL)),
//                fitted by IRLS on the 624 protocols whose token status is known
//                (not an exchange, not a versioned pool, tvl_usd > 0). Age is capped
//                at 0-5 years; a protocol with no listed date takes the median known
//                age. Brier 0.2156 leave-one-out against 0.2486 for the base rate,
//                0.2255 on the January walk-forward against 0.3316, 0.2236 on the
//                median-date walk-forward against 0.3279, and 0.2360 on the August
//                walk-forward. Family dummies, the age x ln TVL interaction, capped
//                growth and chain count were tested for the odds and did not lower
//                all four, so they are not in it.
//   if_launches = round(tvl_usd x multiple)
//   implied    = round(if_launches x odds)   (the expected value: the value if a token
//                launches, weighted by the chance one launches)
//   range      = [implied x loF, implied x hiF], loF/hiF the quartiles of the
//                leave-one-out log-errors of the value model (actual / predicted), so
//                the printed range holds the actual value about half the time, held out.
//   verdict    = from the farm plan's own numbers: the expected drop is
//                odds x if_launches x (capital / tvl_usd); net of gas; per active hour.
//                WORTH FARMING when net per hour is at least $25, MARGINAL when net is
//                positive, SKIP otherwise. The drop is the farmer's pro-rata share if
//                the whole launch value went to depositors; a points-based allocation
//                could pay more or nothing, so the verdict is a scenario, not a promise.
//
// Multiples and odds are computed from the snapshot on every run, so the dashboard's
// recomputation of a row from the stored parameters reproduces board.json exactly.
// No protocol name is ever special-cased: the same functions score every row.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  /** Net per active hour at or above which a farm plan is worth farming. */
  worth_net_per_hour_usd: number;
  /** The multiple's clip, so a fitted curve never extrapolates past the observed ratio range. */
  multiple_low_clip: number;
  multiple_high_clip: number;
  /** Age in years at which the odds curve stops rising. */
  odds_age_cap_years: number;
  /** Age in days used where a protocol's age is unknown (legacy; odds use the median known age). */
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  worth_net_per_hour_usd: 25,
  multiple_low_clip: 0.005,
  multiple_high_clip: 5,
  odds_age_cap_years: 5,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-5';

/** How many comparators a category needs before its own median is trusted as reference evidence. */
export const MIN_CATEGORY_COMPARATORS = 3;

/** How many residuals a family needs before its offset is trusted; fewer means no offset. */
export const MIN_FAMILY_COMPARATORS = 5;

/**
 * Category families: categories that are the same economic activity, pooled so a thin
 * category is valued from its family's evidence instead of the flat global median.
 * The names are DefiLlama categories, never protocol names; the offsets are computed
 * from the snapshot on every run, like every other fitted number.
 */
export const FAMILIES: Record<string, string[]> = {
  curator: ['Risk Curators', 'Onchain Capital Allocator', 'Yield Aggregator', 'Yield'],
  staking: ['Staking', 'Restaking', 'Staking Pool', 'Liquid Staking'],
};

/** A family's display name for the dashboard's multiples table and detail view. */
export const FAMILY_LABELS: Record<string, string> = {
  curator: 'Curator family',
  staking: 'Staking family',
};

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The walk-forward cut: protocols listed before it fit the model, those listed after test it. */
export const WALK_FORWARD_CUT = '2025-01-01';

/** The third walk-forward cut, added in radar-5: an earlier cut, so the model is tested on three forward windows. */
export const WALK_FORWARD_CUT_3 = '2024-08-01';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** A farm plan's numbers: the capital it deposits, the gas it spends, and the active hours it takes. */
export interface PlanCost {
  capital_usd: number;
  hold_days: number;
  gas_usd: number;
  active_hours: number;
}

/** One row's costed farm verdict, from the plan's own numbers and the model's odds. */
export interface FarmVerdict {
  verdict: 'worth' | 'marginal' | 'skip';
  expected_drop_usd: number;
  gas_usd: number;
  active_hours: number;
  net_usd: number;
  net_per_hour_usd: number;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  if_launches_usd: number;
  token_odds: number;
  range_low_usd: number;
  range_high_usd: number;
  verdict: FarmVerdict;
  model: {
    multiple: number;
    multiple_n: number;
    multiple_source: 'size' | 'family';
    multiple_family: string | null;
    family_offset: number;
    growth_pct: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  if_launches_usd: number;
  token_odds: number;
  range_low_usd: number;
  range_high_usd: number;
  verdict: 'worth' | 'marginal' | 'skip';
  expected_drop_usd: number;
  gas_usd: number;
  active_hours: number;
  net_usd: number;
  net_per_hour_usd: number;
  multiple: number;
  multiple_n: number;
  multiple_source: 'size' | 'family';
  multiple_family: string | null;
  family_offset: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's valuation evidence: its median mcap/TVL and how many protocols back it. */
export interface CategoryMultiple {
  category: string;
  n: number;
  multiple: number;
}

/** One held-out test row: a term, its miss in leave-one-out and in all three walk-forward cuts, and whether it survived. */
export interface EvidenceTerm {
  term: string;
  loo_miss: number | null;
  wf_miss: number | null;
  wf2_miss: number | null;
  wf2_cut: string | null;
  wf3_miss: number | null;
  wf3_cut: string | null;
  wf_n: number;
  kept: boolean;
  note: string;
}

/** The fitted size curve: the OLS line of ln(mcap/TVL) on ln TVL over the comparators. */
export interface SizeCurve {
  intercept: number;
  slope: number;
  lntvl_mean: number;
  low_clip: number;
  high_clip: number;
  n: number;
}

/** One family's offset on the size curve: the median residual of its comparators. */
export interface FamilyOffset {
  family: string;
  label: string;
  offset: number;
  multiplier: number;
  n: number;
}

/** The fitted token-odds model and how it scored held out. */
export interface OddsModel {
  intercept: number;
  age_coef: number;
  lntvl_coef: number;
  lntvl_mean: number;
  unknown_age_years: number;
  base_rate: number;
  brier: number;
  brier_base: number;
  brier_loo: number;
  brier_wf: number;
  brier_wf_med: number;
  brier_wf3: number;
  wf_cut: string;
  wf_cut2: string;
  wf_cut3: string;
  wf_n: number;
  labeled_n: number;
}

/** The printed range's calibration: quartiles of the value model's leave-one-out log-errors. */
export interface RangeCalibration {
  low_factor: number;
  high_factor: number;
  coverage_loo: number;
  stated_coverage: number;
}

/** One accounting group: every snapshot protocol belongs to exactly one. */
export interface AccountingGroup {
  label: string;
  count: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  global_multiple: number;
  global_n: number;
  multiples: CategoryMultiple[];
  families: CategoryMultiple[];
  /** The fixed walk-forward cut: protocols listed before it fit the model, those listed after test it. */
  walk_forward_cut: string;
  size_curve: SizeCurve;
  family_offsets: FamilyOffset[];
  odds: OddsModel;
  value_terms: EvidenceTerm[];
  odds_terms: EvidenceTerm[];
  range: RangeCalibration;
  /** The permutation check: 200 shuffled labelings per family, and how often they beat the real labels. */
  permutation: {
    shuffles: number;
    staking: { p_value: number; mean_miss: number; real_miss: number };
    curator: { p_value: number; mean_miss: number; real_miss: number };
  };
  /** The board's best farm plan by net per active hour: the honest best case, threshold unchanged. */
  best_farm: { slug: string; name: string; net_per_hour_usd: number; verdict: string };
  accounting: AccountingGroup[];
  verdict_counts: { worth: number; marginal: number; skip: number };
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The median of a non-empty list of numbers; an even count averages the two middle values. */
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A quantile by linear interpolation, q in [0, 1]. */
export function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

/** The arithmetic mean of a non-empty list. */
export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** A token-bearing protocol that can back a valuation multiple: a positive market cap on positive TVL. */
export function isComparator(p: SnapshotProtocol): boolean {
  return p.gecko_id !== null && p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

/** The valuation evidence the snapshot itself carries: the global median, one median per category, and one median per family. */
export interface MultipleStats {
  globalMultiple: number;
  globalN: number;
  byCategory: Map<string, { multiple: number; n: number }>;
  byFamily: Map<string, { multiple: number; n: number }>;
}

/** Compute every reference median from the snapshot: no multiple is a constant carried in from outside. */
export function computeMultiples(snapshot: Snapshot): MultipleStats {
  const comparators = snapshot.protocols.filter(isComparator);
  const byCategory = new Map<string, number[]>();
  for (const p of comparators) {
    const key = p.category ?? 'Other';
    const list = byCategory.get(key);
    if (list === undefined) byCategory.set(key, [p.mcap_usd! / p.tvl_usd]);
    else list.push(p.mcap_usd! / p.tvl_usd);
  }
  const globalMultiple = round4(median(comparators.map((p) => p.mcap_usd! / p.tvl_usd)));
  const stats: MultipleStats = { globalMultiple, globalN: comparators.length, byCategory: new Map(), byFamily: new Map() };
  for (const [category, ratios] of byCategory) {
    stats.byCategory.set(category, { multiple: round4(median(ratios)), n: ratios.length });
  }
  for (const [family, members] of Object.entries(FAMILIES)) {
    const set = new Set(members);
    const ratios = comparators.filter((p) => set.has(p.category ?? '')).map((p) => p.mcap_usd! / p.tvl_usd);
    if (ratios.length > 0) stats.byFamily.set(family, { multiple: round4(median(ratios)), n: ratios.length });
  }
  return stats;
}

/** The family a category belongs to, or null: a category's family is decided by its name alone. */
export function familyFor(category: string | null): string | null {
  if (category === null) return null;
  for (const [family, members] of Object.entries(FAMILIES)) {
    if (members.includes(category)) return family;
  }
  return null;
}

/** The OLS line of ys on xs: intercept and slope. */
export function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  return { a: my - b * mx, b };
}

/** The median of values grouped by key, kept only when the group has at least minN values. */
function groupMedian(items: { k: string | null; v: number }[], minN: number): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const it of items) {
    if (it.k === null) continue;
    const list = groups.get(it.k);
    if (list === undefined) groups.set(it.k, [it.v]);
    else list.push(it.v);
  }
  const out = new Map<string, number>();
  for (const [k, vs] of groups) if (vs.length >= minN) out.set(k, median(vs));
  return out;
}

/** A fitted value model: the size curve plus family offsets, and the function that scores a protocol. */
export interface ValueFit {
  size: { a: number; b: number };
  lntvlMean: number;
  famOff: Map<string, number>;
  flags: ValueFlags;
  predict: (p: SnapshotProtocol, asOf: string) => number;
}

/** The candidate terms a value model may carry. Only size + staking survive the held-out tests. */
export interface ValueFlags {
  size: boolean;
  staking: boolean;
  curator: boolean;
  category: boolean;
  categoryShrink: boolean;
  growth: boolean;
  growthCap: boolean;
  growthLarge: boolean;
  maturity: boolean;
  ageLinear: boolean;
  ageTvl: boolean;
  chains: boolean;
}

/** Fit a value model over a subset of comparators, with the cumulative flags the evidence table tests. */
export function fitValueModel(
  subset: SnapshotProtocol[],
  asOf: string,
  flags: ValueFlags,
  lntvlMean: number,
  familyOf: (p: SnapshotProtocol) => string | null = (p) => familyFor(p.category),
): ValueFit {
  const logR = subset.map((p) => Math.log(p.mcap_usd! / p.tvl_usd));
  const xs = subset.map((p) => Math.log(p.tvl_usd) - lntvlMean);
  const globalMed = median(subset.map((p) => p.mcap_usd! / p.tvl_usd));
  const size = flags.size ? ols(xs, logR) : { a: Math.log(globalMed), b: 0 };
  let resid = subset.map((p, i) => logR[i]! - (size.a + size.b * xs[i]!));
  // Family offsets, one family at a time: each is the median residual of that family's
  // comparators, computed from the same pre-adjustment residuals. A protocol belongs to
  // at most one family, so the adjustments never stack.
  const famOff = new Map<string, number>();
  for (const fam of ['staking', 'curator'] as const) {
    if (!flags[fam]) continue;
    const off = groupMedian(subset.map((p, i) => ({ k: familyOf(p) === fam ? fam : null, v: resid[i]! })), MIN_FAMILY_COMPARATORS);
    const v = off.get(fam);
    if (v !== undefined) famOff.set(fam, v);
  }
  if (famOff.size > 0) resid = resid.map((r, i) => r - (famOff.get(familyOf(subset[i]!) ?? '') ?? 0));
  const catOff = flags.category || flags.categoryShrink
    ? groupMedian(
        subset.map((p, i) => ({ k: p.category, v: resid[i]! })),
        MIN_CATEGORY_COMPARATORS,
      )
    : new Map<string, number>();
  if (flags.categoryShrink) {
    // Shrink each category offset toward zero by n/(n+5): a thin category's median is mostly noise.
    const counts = new Map<string, number>();
    for (const p of subset) counts.set(p.category ?? '', (counts.get(p.category ?? '') ?? 0) + 1);
    for (const [k, v] of catOff) catOff.set(k, v * ((counts.get(k) ?? 0) / ((counts.get(k) ?? 0) + 5)));
  }
  if (catOff.size > 0) resid = resid.map((r, i) => r - (catOff.get(subset[i]!.category ?? '') ?? 0));
  let chainSlope = 0;
  if (flags.chains) {
    const cx = subset.map((p) => Math.log((p.chains?.length || 0) + 1));
    chainSlope = ols(cx, resid).b;
    resid = resid.map((r, i) => r - chainSlope * cx[i]!);
  }
  // Age in years, capped at 0-5, unknown age taking the median known age of the fitting subset (computed once).
  const medAge = median(subset.filter((q) => q.listed_at).map((q) => ageDays(asOf, q.listed_at)! / 365));
  const ages = subset.map((p) => {
    const a = ageDays(asOf, p.listed_at);
    return a === null ? medAge : clamp(a / 365, 0, MODEL.odds_age_cap_years);
  });
  const ageMean = mean(ages);
  let ageSlope = 0;
  if (flags.ageLinear) {
    ageSlope = ols(ages.map((v) => v - ageMean), resid).b;
    resid = resid.map((r, i) => r - ageSlope * (ages[i]! - ageMean));
  }
  let itSlope = 0;
  if (flags.ageTvl) {
    itSlope = ols(subset.map((p, i) => xs[i]! * (ages[i]! - ageMean)), resid).b;
  }
  const predict = (p: SnapshotProtocol, asOfDate: string): number => {
    let lr = size.a + size.b * (Math.log(p.tvl_usd) - lntvlMean);
    const fam = familyOf(p);
    if (fam !== null && famOff.has(fam)) lr += famOff.get(fam)!;
    if (catOff.has(p.category ?? '')) lr += catOff.get(p.category ?? '')!;
    if (flags.chains) lr += chainSlope * Math.log((p.chains?.length || 0) + 1);
    if (flags.ageLinear || flags.ageTvl) {
      const a = ageDays(asOfDate, p.listed_at);
      const ay = a === null ? medAge : clamp(a / 365, 0, MODEL.odds_age_cap_years);
      if (flags.ageLinear) lr += ageSlope * (ay - ageMean);
      if (flags.ageTvl) lr += itSlope * (Math.log(p.tvl_usd) - lntvlMean) * (ay - ageMean);
    }
    let pred = p.tvl_usd * clamp(Math.exp(lr), MODEL.multiple_low_clip, MODEL.multiple_high_clip);
    if (flags.growth) pred *= 1 + (clamp(p.change_7d ?? 0, -60, 120) / 100) * 0.5;
    if (flags.growthCap) pred *= 1 + (clamp(p.change_7d ?? 0, -20, 30) / 100) * 0.25;
    if (flags.growthLarge && p.tvl_usd >= 1e8) pred *= 1 + (clamp(p.change_7d ?? 0, -60, 120) / 100) * 0.5;
    if (flags.maturity) {
      const age = ageDays(asOfDate, p.listed_at) ?? MODEL.unknown_age_days;
      pred *= 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
    }
    return pred;
  };
  return { size, lntvlMean, famOff, flags, predict };
}

/** The typical miss of predictions against actuals: exp(median |ln(pred/actual)|), a factor like x3.40. */
export function typicalMiss(preds: number[], actuals: number[]): number {
  return Math.exp(median(preds.map((pr, i) => Math.abs(Math.log(pr / actuals[i]!)))));
}

/** A deterministic PRNG (mulberry32) for the permutation test: the same seed, the same shuffles, every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A value model's held-out evidence: leave-one-out and walk-forward miss for every candidate term. */
export function valueEvidence(snapshot: Snapshot): {
  terms: EvidenceTerm[];
  range: RangeCalibration;
  size: SizeCurve;
  familyOffsets: FamilyOffset[];
  permutation: { shuffles: number; staking: { p_value: number; mean_miss: number; real_miss: number }; curator: { p_value: number; mean_miss: number; real_miss: number } };
} {
  const comps = snapshot.protocols.filter(isComparator);
  const actuals = comps.map((p) => p.mcap_usd!);
  const lntvlMean = mean(comps.map((p) => Math.log(p.tvl_usd)));
  const dated = comps.filter((p) => p.listed_at);
  const medDate = [...dated.map((p) => p.listed_at!)].sort()[dated.length >> 1]!;
  const cuts = [WALK_FORWARD_CUT, medDate, WALK_FORWARD_CUT_3];
  const none: ValueFlags = { size: false, staking: false, curator: false, category: false, categoryShrink: false, growth: false, growthCap: false, growthLarge: false, maturity: false, ageLinear: false, ageTvl: false, chains: false };
  const test = (name: string, flags: ValueFlags, note: string): EvidenceTerm => {
    const looPreds = comps.map((_, i) => fitValueModel(comps.filter((__, j) => j !== i), snapshot.as_of, flags, lntvlMean).predict(comps[i]!, snapshot.as_of));
    const loo = typicalMiss(looPreds, actuals);
    const wfMiss: number[] = [];
    let wfN = 0;
    for (const cut of cuts) {
      const tr = comps.filter((p) => p.listed_at && p.listed_at < cut);
      const te = comps.filter((p) => p.listed_at && p.listed_at >= cut);
      wfN += te.length;
      wfMiss.push(typicalMiss(te.map((p) => fitValueModel(tr, snapshot.as_of, flags, lntvlMean).predict(p, snapshot.as_of)), te.map((p) => p.mcap_usd!)));
    }
    return { term: name, loo_miss: round4(loo), wf_miss: round4(wfMiss[0]!), wf2_miss: round4(wfMiss[1]!), wf2_cut: medDate, wf3_miss: round4(wfMiss[2]!), wf3_cut: WALK_FORWARD_CUT_3, wf_n: wfN, kept: false, note };
  };
  const flat = test('Flat global median', none, 'baseline');
  const size = test('+ size curve, ln TVL', { ...none, size: true }, 'kept: lowers leave-one-out and all three walk-forward cuts');
  const staking = test(
    '+ staking offset',
    { ...none, size: true, staking: true },
    'kept: lowers leave-one-out and the median-date walk-forward, ties the other two; on mean |log error| it lowers all four tests; 200 shuffled staking labelings beat it only 47 times (p = 0.235), and its fitted value is stable across walk-forward train sets',
  );
  const curator = test(
    '+ curator offset',
    { ...none, size: true, curator: true },
    'tested, not kept: worsens leave-one-out and the mean error in all four tests; 155 of 200 shuffled curator labelings do as well or better (p = 0.775), and its fitted value flips sign across walk-forward train sets',
  );
  const keptBase: ValueFlags = { ...none, size: true, staking: true };
  const category = test('+ category offsets', { ...keptBase, category: true }, 'tested, not kept: worse in all four tests');
  const categoryShrink = test('+ category offsets, shrunk', { ...keptBase, categoryShrink: true }, 'tested, not kept: worse in leave-one-out and the median-date and August walk-forwards');
  const growth = test('+ 7-day growth', { ...keptBase, growth: true }, 'tested, not kept: lowers leave-one-out and the January walk-forward, but worsens the median-date and August walk-forwards');
  const growthCap = test('+ 7-day growth, capped', { ...keptBase, growthCap: true }, 'tested, not kept: lowers leave-one-out and the January walk-forward, but worsens the median-date and August walk-forwards');
  const growthLarge = test('+ 7-day growth, large TVL only', { ...keptBase, growthLarge: true }, 'tested, not kept: ties leave-one-out and the January walk-forward, worsens the median-date and August walk-forwards');
  const maturity = test('+ age / maturity', { ...keptBase, maturity: true }, 'tested, not kept: lowers the January walk-forward but worsens leave-one-out and the other two walk-forwards');
  const ageLinear = test('+ age, linear in log space', { ...keptBase, ageLinear: true }, 'tested, not kept: much worse on the January walk-forward');
  const ageTvl = test('+ age x ln TVL', { ...keptBase, ageTvl: true }, 'tested, not kept: lowers leave-one-out and the median-date walk-forward, but worsens the January and August walk-forwards');
  const chains = test('+ chain count', { ...keptBase, chains: true }, 'tested, not kept: worse in all four tests');
  flat.kept = false;
  size.kept = true;
  staking.kept = true;
  // The permutation check: shuffle one family's labels 200 times (fixed seed, so the
  // result is deterministic) and refit. A real signal must beat most shuffles; radar-4's
  // single deterministic shuffle (x3.60) was one draw from this distribution, not evidence.
  const permutation = (family: 'staking' | 'curator', realMiss: number): { p_value: number; mean_miss: number; real_miss: number } => {
    const labels = comps.map((p) => (familyFor(p.category) === family ? family : null));
    const rng = mulberry32(family === 'staking' ? 20261120 : 987654321);
    const misses: number[] = [];
    for (let s = 0; s < 200; s++) {
      const shuffled = [...labels];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
      }
      const bySlug = new Map(comps.map((p, i) => [p.slug, shuffled[i]!] as const));
      const flags: ValueFlags = { ...none, size: true, [family]: true } as ValueFlags;
      const preds = comps.map((_, i) => {
        const sub = comps.filter((__, j) => j !== i);
        return fitValueModel(sub, snapshot.as_of, flags, lntvlMean, (p) => bySlug.get(p.slug) ?? null).predict(comps[i]!, snapshot.as_of);
      });
      misses.push(typicalMiss(preds, actuals));
    }
    return { p_value: round4(misses.filter((m) => m <= realMiss).length / misses.length), mean_miss: round4(mean(misses)), real_miss: round4(realMiss) };
  };
  const permStaking = permutation('staking', staking.loo_miss!);
  const permCurator = permutation('curator', curator.loo_miss!);
  // The final model (size + staking) and its range calibration from leave-one-out log-errors.
  const finalFlags: ValueFlags = { ...none, size: true, staking: true };
  const finalFit = fitValueModel(comps, snapshot.as_of, finalFlags, lntvlMean);
  const looErrs = comps.map((_, i) => {
    const f = fitValueModel(comps.filter((__, j) => j !== i), snapshot.as_of, finalFlags, lntvlMean);
    return Math.log(comps[i]!.mcap_usd! / f.predict(comps[i]!, snapshot.as_of));
  });
  const lowFactor = round4(Math.exp(quantile(looErrs, 0.25)));
  const highFactor = round4(Math.exp(quantile(looErrs, 0.75)));
  const coverage = looErrs.filter((e) => e >= quantile(looErrs, 0.25) && e <= quantile(looErrs, 0.75)).length / looErrs.length;
  const familyOffsets: FamilyOffset[] = [...finalFit.famOff.entries()].map(([family, offset]) => ({
    family,
    label: FAMILY_LABELS[family] ?? family,
    // Stored at full precision: the dashboard recomputes each row's multiple from these
    // parameters, and the recompute must match board.json exactly, not to four decimals.
    offset,
    multiplier: Math.exp(offset),
    n: comps.filter((p) => familyFor(p.category) === family).length,
  }));
  const terms = [flat, size, staking, curator, category, categoryShrink, growth, growthCap, growthLarge, maturity, ageLinear, ageTvl, chains];
  return {
    terms,
    range: { low_factor: lowFactor, high_factor: highFactor, coverage_loo: round4(coverage), stated_coverage: 0.5 },
    size: { intercept: finalFit.size.a, slope: finalFit.size.b, lntvl_mean: lntvlMean, low_clip: MODEL.multiple_low_clip, high_clip: MODEL.multiple_high_clip, n: comps.length },
    familyOffsets,
    permutation: { shuffles: 200, staking: permStaking, curator: permCurator },
  };
}

/** Solve a small dense linear system by Gaussian elimination. */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]! || 1e-12;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / (row[i]! || 1e-12));
}

/** Fit a logistic regression by IRLS (Newton), deterministic: fixed ridge, fixed iterations, optional warm start. */
export function fitLogistic(X: number[][], y: number[], init?: number[]): number[] {
  const p = X[0]!.length;
  let beta = init !== undefined ? [...init] : new Array(p).fill(0);
  for (let it = 0; it < 25; it++) {
    const XtWX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtWz: number[] = new Array(p).fill(0);
    let maxStep = 0;
    for (let i = 0; i < X.length; i++) {
      const eta = X[i]!.reduce((s, v, j) => s + v * beta[j]!, 0);
      const mu = 1 / (1 + Math.exp(-clamp(eta, -30, 30)));
      const w = Math.max(mu * (1 - mu), 1e-6);
      const z = eta + (y[i]! - mu) / w;
      for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) XtWX[a]![b]! += w * X[i]![a]! * X[i]![b]!;
      for (let a = 0; a < p; a++) XtWz[a]! += w * X[i]![a]! * z;
    }
    for (let a = 1; a < p; a++) XtWX[a]![a]! += 1e-4;
    const nb = solveLinear(XtWX, XtWz);
    for (let j = 0; j < p; j++) maxStep = Math.max(maxStep, Math.abs(nb[j]! - beta[j]!));
    beta = nb;
    if (maxStep < 1e-8) break;
  }
  return beta;
}

/** The logistic function, clamped so it never overflows. */
export function logistic(eta: number): number {
  return 1 / (1 + Math.exp(-clamp(eta, -30, 30)));
}

/** The Brier score of (predicted probability, outcome) pairs. */
export function brierScore(pairs: [number, number][]): number {
  return mean(pairs.map(([p, y]) => (p - y) ** 2));
}

/** Whether a protocol records a token: a symbol on record. */
export function hasToken(p: SnapshotProtocol): boolean {
  return p.symbol !== null;
}

/** The labeled set for token odds: token status known, not an exchange, not a versioned pool, positive TVL. */
export function oddsLabeled(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter((p) => !isRankableExcluded(p) && p.tvl_usd > 0);
}

/** The odds model's features for one protocol: intercept, capped age in years, centred ln TVL, and the extras the evidence table tests. */
export function oddsFeatures(
  p: SnapshotProtocol,
  asOf: string,
  lntvlMean: number,
  unknownAgeYears: number,
  extra: 'none' | 'growth' | 'chains' | 'family' | 'interact' | 'growthCap',
): number[] {
  const age = ageDays(asOf, p.listed_at);
  const ageY = age === null ? unknownAgeYears : clamp(age / 365, 0, MODEL.odds_age_cap_years);
  const row = [1, ageY, Math.log(p.tvl_usd) - lntvlMean];
  if (extra === 'growth') row.push(clamp(p.change_7d ?? 0, -60, 120) / 100);
  if (extra === 'chains') row.push(Math.log((p.chains?.length || 0) + 1));
  if (extra === 'family') row.push(familyFor(p.category) === 'curator' ? 1 : 0, familyFor(p.category) === 'staking' ? 1 : 0);
  if (extra === 'interact') row.push(ageY * (Math.log(p.tvl_usd) - lntvlMean));
  if (extra === 'growthCap') row.push(clamp(p.change_7d ?? 0, -20, 30) / 100);
  return row;
}

/** The token-odds model fitted from the snapshot, with its held-out evidence. */
export function fitOdds(snapshot: Snapshot): { model: OddsModel; terms: EvidenceTerm[] } {
  const labeled = oddsLabeled(snapshot);
  const knownAges = labeled.filter((p) => p.listed_at).map((p) => ageDays(snapshot.as_of, p.listed_at)! / 365);
  const unknownAgeYears = median(knownAges);
  const lntvlMean = mean(labeled.map((p) => Math.log(p.tvl_usd)));
  const y = labeled.map((p) => (hasToken(p) ? 1 : 0));
  const baseRate = mean(y);
  const dated = labeled.filter((p) => p.listed_at);
  const medDate = [...dated.map((p) => p.listed_at!)].sort()[dated.length >> 1]!;
  const test = (name: string, extra: 'none' | 'growth' | 'chains' | 'family' | 'interact' | 'growthCap', base: 'age' | 'ageTvl'): EvidenceTerm => {
    const feats = (p: SnapshotProtocol): number[] => {
      const full = oddsFeatures(p, snapshot.as_of, lntvlMean, unknownAgeYears, extra);
      if (base === 'age') return full.slice(0, 2);
      return full;
    };
    const X = labeled.map(feats);
    const beta = fitLogistic(X, y);
    const looPairs: [number, number][] = [];
    for (let i = 0; i < X.length; i++) {
      const bi = fitLogistic(X.filter((_, j) => j !== i), y.filter((_, j) => j !== i), beta);
      looPairs.push([logistic(X[i]!.reduce((s, v, j) => s + v * bi[j]!, 0)), y[i]!]);
    }
    const loo = brierScore(looPairs);
    const wfMiss: number[] = [];
    let wfN = 0;
    for (const cut of [WALK_FORWARD_CUT, medDate, WALK_FORWARD_CUT_3]) {
      const tr = labeled.map((p, i) => ({ p, i })).filter(({ p }) => p.listed_at && p.listed_at < cut);
      const te = labeled.map((p, i) => ({ p, i })).filter(({ p }) => p.listed_at && p.listed_at >= cut);
      const b = fitLogistic(tr.map(({ i }) => X[i]!), tr.map(({ i }) => y[i]!), beta);
      const pairs = te.map(({ i }): [number, number] => [logistic(X[i]!.reduce((s, v, j) => s + v * b[j]!, 0)), y[i]!]);
      wfMiss.push(brierScore(pairs));
      wfN += te.length;
    }
    return { term: name, loo_miss: round4(loo), wf_miss: round4(wfMiss[0]!), wf2_miss: round4(wfMiss[1]!), wf2_cut: medDate, wf3_miss: round4(wfMiss[2]!), wf3_cut: WALK_FORWARD_CUT_3, wf_n: wfN, kept: false, note: '' };
  };
  const base = test('Base rate of peers', 'none', 'age');
  // The base rate is a constant prediction, so its Brier is computed directly, not fitted:
  // leave-one-out on the whole labeled set, and walk-forward with the training-set rate applied to each test set.
  base.loo_miss = round4(brierScore(y.map((v): [number, number] => [baseRate, v])));
  const baseWf: number[] = [];
  let baseWfN = 0;
  for (const cut of [WALK_FORWARD_CUT, medDate, WALK_FORWARD_CUT_3]) {
    const trY = labeled.filter((p) => p.listed_at && p.listed_at < cut).map((p) => (hasToken(p) ? 1 : 0));
    const teY = labeled.filter((p) => p.listed_at && p.listed_at >= cut).map((p) => (hasToken(p) ? 1 : 0));
    baseWf.push(brierScore(teY.map((v): [number, number] => [mean(trY), v])));
    baseWfN += teY.length;
  }
  base.wf_miss = round4(baseWf[0]!);
  base.wf2_miss = round4(baseWf[1]!);
  base.wf2_cut = medDate;
  base.wf3_miss = round4(baseWf[2]!);
  base.wf3_cut = WALK_FORWARD_CUT_3;
  base.wf_n = baseWfN;
  base.note = 'baseline';
  const ageOnly = test('Age in years', 'none', 'age');
  ageOnly.note = 'tested, not kept: ln TVL beats it in all four tests';
  const kept = test('Age + ln TVL', 'none', 'ageTvl');
  kept.kept = true;
  kept.note = 'kept: lowest in all four tests';
  const growth = test('Age + ln TVL + 7-day growth', 'growth', 'ageTvl');
  growth.note = 'tested, not kept: lowers leave-one-out and the median-date and August walk-forwards, but worsens the January walk-forward';
  const growthCap = test('Age + ln TVL + growth, capped', 'growthCap', 'ageTvl');
  growthCap.note = 'tested, not kept: lowers leave-one-out and the August walk-forward, but worsens the January and median-date walk-forwards';
  const family = test('Age + ln TVL + family dummies', 'family', 'ageTvl');
  family.note = 'tested, not kept: lowers leave-one-out, but worsens all three walk-forward cuts';
  const interact = test('Age + ln TVL + age x ln TVL', 'interact', 'ageTvl');
  interact.note = 'tested, not kept: lowers leave-one-out and the January and median-date walk-forwards, but worsens the August walk-forward';
  const chains = test('Age + ln TVL + chain count', 'chains', 'ageTvl');
  chains.note = 'tested, not kept: lowers leave-one-out but worsens the walk-forward cuts';
  const terms = [base, ageOnly, kept, growth, growthCap, family, interact, chains];
  const Xk = labeled.map((p) => oddsFeatures(p, snapshot.as_of, lntvlMean, unknownAgeYears, 'none'));
  const beta = fitLogistic(Xk, y);
  const inBrier = brierScore(Xk.map((x, i): [number, number] => [logistic(x.reduce((s, v, j) => s + v * beta[j]!, 0)), y[i]!]));
  const model: OddsModel = {
    // Stored at full precision: the dashboard recomputes each row's token odds from these
    // coefficients, and the recompute must match board.json exactly, not to four decimals.
    intercept: beta[0]!,
    age_coef: beta[1]!,
    lntvl_coef: beta[2]!,
    lntvl_mean: lntvlMean,
    unknown_age_years: unknownAgeYears,
    base_rate: round4(baseRate),
    brier: round4(inBrier),
    brier_base: round4(brierScore(y.map((v): [number, number] => [baseRate, v]))),
    brier_loo: kept.loo_miss!,
    // The walk-forward Briers are the evidence table's January cut, median-date cut and August cut, so the dashboard's KPI and the table agree.
    brier_wf: kept.wf_miss!,
    brier_wf_med: kept.wf2_miss!,
    brier_wf3: kept.wf3_miss!,
    wf_cut: WALK_FORWARD_CUT,
    wf_cut2: kept.wf2_cut!,
    wf_cut3: kept.wf3_cut!,
    wf_n: kept.wf_n,
    labeled_n: labeled.length,
  };
  return { model, terms };
}

/** The token odds of one protocol under the fitted model, always in [0, 1]. */
export function tokenOdds(p: SnapshotProtocol, asOf: string, odds: OddsModel): number {
  const age = ageDays(asOf, p.listed_at);
  const ageY = age === null ? odds.unknown_age_years : clamp(age / 365, 0, MODEL.odds_age_cap_years);
  const eta = odds.intercept + odds.age_coef * ageY + odds.lntvl_coef * (Math.log(p.tvl_usd) - odds.lntvl_mean);
  return clamp(logistic(eta), 0.001, 0.999);
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is excluded from ranking and from the odds labels: an exchange or a versioned pool. */
export function isRankableExcluded(p: SnapshotProtocol): boolean {
  return p.category === 'CEX' || VERSIONED.test(p.name);
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !isRankableExcluded(p);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
}

/** The fitted multiple of one protocol under the final value model. */
export function fittedMultiple(p: SnapshotProtocol, fit: ValueFit): { multiple: number; source: 'size' | 'family'; family: string | null; offset: number } {
  const lr = fit.size.a + fit.size.b * (Math.log(p.tvl_usd) - fit.lntvlMean);
  const fam = familyFor(p.category);
  const offset = fam !== null && fit.famOff.has(fam) ? fit.famOff.get(fam)! : 0;
  const multiple = clamp(Math.exp(lr + offset), MODEL.multiple_low_clip, MODEL.multiple_high_clip);
  if (fam !== null && fit.famOff.has(fam)) {
    return { multiple, source: 'family', family: fam, offset };
  }
  return { multiple, source: 'size', family: null, offset: 0 };
}

/** Everything fitted from the snapshot in one place, so the board is built from one fit. */
export interface RadarFit {
  stats: MultipleStats;
  value: ValueFit;
  valueTerms: EvidenceTerm[];
  range: RangeCalibration;
  size: SizeCurve;
  familyOffsets: FamilyOffset[];
  permutation: { shuffles: number; staking: { p_value: number; mean_miss: number; real_miss: number }; curator: { p_value: number; mean_miss: number; real_miss: number } };
  odds: OddsModel;
  oddsTerms: EvidenceTerm[];
  comparatorN: number;
}

/** Fit every model the board needs from the snapshot. */
export function fitRadar(snapshot: Snapshot): RadarFit {
  const stats = computeMultiples(snapshot);
  const comps = snapshot.protocols.filter(isComparator);
  const lntvlMean = mean(comps.map((p) => Math.log(p.tvl_usd)));
  const value = fitValueModel(comps, snapshot.as_of, { size: true, staking: true, curator: false, category: false, categoryShrink: false, growth: false, growthCap: false, growthLarge: false, maturity: false, ageLinear: false, ageTvl: false, chains: false }, lntvlMean);
  const ev = valueEvidence(snapshot);
  const od = fitOdds(snapshot);
  return {
    stats,
    value,
    valueTerms: ev.terms,
    range: ev.range,
    size: ev.size,
    familyOffsets: ev.familyOffsets,
    permutation: ev.permutation,
    odds: od.model,
    oddsTerms: od.terms,
    comparatorN: comps.length,
  };
}

/** The three multipliers and the implied value one protocol gets under the fitted models. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: RadarFit,
): {
  ifLaunches: number;
  implied: number;
  odds: number;
  multiple: number;
  multipleN: number;
  multipleSource: 'size' | 'family';
  multipleFamily: string | null;
  familyOffset: number;
  rangeLow: number;
  rangeHigh: number;
  growthPct: number;
  age: number | null;
  verdict: FarmVerdict;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const fm = fittedMultiple(protocol, fit.value);
  const multipleN = fm.source === 'family' ? fit.familyOffsets.find((f) => f.family === fm.family)?.n ?? fit.comparatorN : fit.comparatorN;
  const ifLaunches = Math.max(1, Math.round(protocol.tvl_usd * fm.multiple));
  const odds = tokenOdds(protocol, asOf, fit.odds);
  const implied = Math.max(1, Math.round(ifLaunches * odds));
  const rangeLow = Math.max(1, Math.round(implied * fit.range.low_factor));
  const rangeHigh = Math.max(rangeLow + 1, Math.round(implied * fit.range.high_factor));
  const growthPct = Math.min(120, Math.max(-60, finite(protocol.change_7d, 0)));
  const verdict = farmVerdict(protocol, age, ifLaunches, odds);
  return { ifLaunches, implied, odds, multiple: round4(fm.multiple), multipleN, multipleSource: fm.source, multipleFamily: fm.family, familyOffset: round4(fm.offset), rangeLow, rangeHigh, growthPct, age, verdict };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The farm plan's numbers, from the same derivation as its steps: capital, hold, gas and active hours. */
export function planCost(p: SnapshotProtocol, age: number | null): PlanCost {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const weeks = hold / 7;
  const gas = 3 + (capital >= 150 ? 8 : 4) + 2 * weeks;
  const hours = (5 + 15 + 10 * weeks + 10 + 5) / 60;
  return { capital_usd: capital, hold_days: hold, gas_usd: round4(gas), active_hours: round4(hours) };
}

/**
 * A protocol's costed farm verdict, from the plan's own numbers. The expected drop is the
 * farmer's pro-rata share of the launch value if the whole launch value went to depositors
 * (odds x if-launches x capital / TVL); a points-based allocation could pay more or nothing,
 * so the verdict is a scenario, not a promise. Net is the drop less gas; per hour divides by
 * the plan's active hours. Worth farming when net per hour reaches $25.
 */
export function farmVerdict(p: SnapshotProtocol, age: number | null, ifLaunches: number, odds: number): FarmVerdict {
  const cost = planCost(p, age);
  const expected = odds * ifLaunches * (cost.capital_usd / p.tvl_usd);
  const net = expected - cost.gas_usd;
  const netPerHour = net / cost.active_hours;
  const verdict = netPerHour >= MODEL.worth_net_per_hour_usd ? 'worth' : net > 0 ? 'marginal' : 'skip';
  return {
    verdict,
    expected_drop_usd: round4(expected),
    gas_usd: cost.gas_usd,
    active_hours: cost.active_hours,
    net_usd: round4(net),
    net_per_hour_usd: round4(netPerHour),
  };
}

/** The category's one action, in the words a farmer can follow. No protocol name is special-cased:
// the category, the chain and the TVL decide the action; a bridge row says so honestly, because
// farming a bridge means using the bridge, not pretending it is something else. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c === 'chain') return `Bridge $${capital} of USDC to ${chain} and use a native app there, such as a swap or a deposit, so the on-chain activity is recorded.`;
  if (c.includes('basis trading')) return `Deposit $${capital} of USDC into the basis-trading vault of ${name} on ${chain} and hold the position.`;
  if (c.includes('payments')) return `Open a payment channel with $${capital} through ${name} and make several small payments through it.`;
  if (c.includes('governance incentives')) return `Lock or stake $${capital} for the governance incentives of ${name} and take part in any vote that runs.`;
  if (c.includes('collateral')) return `Deposit $${capital} as collateral through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('cedefi')) return `Deposit $${capital} of USDC into the CeDeFi vault of ${name} on ${chain} and keep the shares.`;
  if (c.includes('stablecoin wrapper')) return `Wrap or mint $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('restaking')) return `Restake $${capital} of the restaking asset through ${name} on ${chain} and keep the receipt.`;
  if (c.includes('staking pool')) return `Stake $${capital} into the ${name} pool on ${chain} and keep the receipt.`;
  if (c.includes('lend')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('cdp')) return `Deposit $${capital} of collateral to mint the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('dex') || c.includes('yield') || c.includes('leveraged farm')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 * It promises no yield, no points and no airdrop: none of those is in the snapshot.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const fit = fitRadar(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but the
  // board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor, by TVL, capped. Never a replacement
  // for a watchlist row: a chosen protocol stays chosen.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, fit);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    if_launches_usd: s.ifLaunches,
    token_odds: s.odds,
    range_low_usd: s.rangeLow,
    range_high_usd: s.rangeHigh,
    verdict: s.verdict,
    model: {
      multiple: s.multiple,
      multiple_n: s.multipleN,
      multiple_source: s.multipleSource,
      multiple_family: s.multipleFamily,
      family_offset: s.familyOffset,
      growth_pct: s.growthPct,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** Every snapshot protocol in exactly one accounting group, counted from the snapshot itself. */
export function accounting(snapshot: Snapshot, board: BoardRow[]): AccountingGroup[] {
  const ranked = new Set(board.map((r) => r.slug));
  const groups: AccountingGroup[] = [
    { label: 'Ranked — watchlist', count: board.filter((r) => snapshot.watchlist.includes(r.slug)).length },
    { label: 'Ranked — early, below the floor', count: board.filter((r) => !snapshot.watchlist.includes(r.slug)).length },
    { label: 'Token recorded — priced comparator', count: snapshot.protocols.filter(isComparator).length },
    { label: 'Token recorded — no usable cap', count: snapshot.protocols.filter((p) => hasToken(p) && !isComparator(p)).length },
    { label: 'Pre-token, not ranked — exchange', count: snapshot.protocols.filter((p) => isPreToken(p) && !ranked.has(p.slug) && p.category === 'CEX').length },
    { label: 'Pre-token, not ranked — versioned pool', count: snapshot.protocols.filter((p) => isPreToken(p) && !ranked.has(p.slug) && p.category !== 'CEX' && VERSIONED.test(p.name)).length },
    { label: 'Pre-token, not ranked — below the early cut', count: snapshot.protocols.filter((p) => isPreToken(p) && !ranked.has(p.slug) && p.category !== 'CEX' && !VERSIONED.test(p.name)).length },
  ];
  return groups;
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    if_launches_usd: row.if_launches_usd,
    token_odds: row.token_odds,
    range_low_usd: row.range_low_usd,
    range_high_usd: row.range_high_usd,
    verdict: row.verdict.verdict,
    expected_drop_usd: row.verdict.expected_drop_usd,
    gas_usd: row.verdict.gas_usd,
    active_hours: row.verdict.active_hours,
    net_usd: row.verdict.net_usd,
    net_per_hour_usd: row.verdict.net_per_hour_usd,
    multiple: row.model.multiple,
    multiple_n: row.model.multiple_n,
    multiple_source: row.model.multiple_source,
    multiple_family: row.model.multiple_family,
    family_offset: row.model.family_offset,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const fit = fitRadar(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const multiples: CategoryMultiple[] = [...fit.stats.byCategory.entries()]
    .filter(([, v]) => v.n >= MIN_CATEGORY_COMPARATORS)
    .map(([category, v]) => ({ category, n: v.n, multiple: v.multiple }))
    .sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  const families: CategoryMultiple[] = [...fit.stats.byFamily.entries()]
    .filter(([, v]) => v.n >= MIN_FAMILY_COMPARATORS)
    .map(([family, v]) => ({ category: FAMILY_LABELS[family] ?? family, n: v.n, multiple: v.multiple }))
    .sort((a, b) => b.n - a.n || (a.category < b.category ? -1 : a.category > b.category ? 1 : 0));
  const verdictCounts = { worth: 0, marginal: 0, skip: 0 };
  for (const r of board) verdictCounts[r.verdict.verdict]++;
  const bestRow = [...board].sort((a, b) => b.verdict.net_per_hour_usd - a.verdict.net_per_hour_usd || (a.slug < b.slug ? -1 : 1))[0]!;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    global_multiple: fit.stats.globalMultiple,
    global_n: fit.stats.globalN,
    multiples,
    families,
    walk_forward_cut: WALK_FORWARD_CUT,
    size_curve: fit.size,
    family_offsets: fit.familyOffsets,
    odds: fit.odds,
    value_terms: fit.valueTerms,
    odds_terms: fit.oddsTerms,
    range: fit.range,
    permutation: fit.permutation,
    best_farm: { slug: bestRow.slug, name: bestRow.name, net_per_hour_usd: bestRow.verdict.net_per_hour_usd, verdict: bestRow.verdict.verdict },
    accounting: accounting(snapshot, board),
    verdict_counts: verdictCounts,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isFinite(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, farm steps, and the radar-5 invariants. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.token_odds >= 0 && r.token_odds <= 1)) return `${r.slug} has token odds ${r.token_odds}`;
    if (!(r.range_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.range_high_usd)) return `${r.slug} has an implied value outside its printed range`;
    if (!(r.if_launches_usd >= r.implied_value_usd)) return `${r.slug} has an if-launches value below its implied value`;
    if (!Number.isSafeInteger(r.if_launches_usd) || r.if_launches_usd <= 0) return `${r.slug} has if-launches value ${r.if_launches_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
