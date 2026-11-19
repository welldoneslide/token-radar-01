// Check 1: dossier.json in <out-dir> is byte-identical to a fresh buildDossier() rebuild.
// Check 2: the dashboard's farmSteps (extracted from dashboard/app.js) produce exactly the
// farm_steps board.json carries, for every row. Usage: node scripts/regen-check.ts <out-dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const outDir = process.argv[2];
if (!outDir) { console.error('usage: node scripts/regen-check.ts <out-dir>'); process.exit(2); }
let failures = 0;

// --- 1. dossier rebuild ---
// buildDossier returns bytes (a Uint8Array), not a string: compare as bytes.
const rebuilt = buildDossier(outDir, { text_max_bytes: 65536, screenshots: { max: 4, max_bytes: 524288 }, dashboard: { max_files: 400, max_bytes: 4194304 } });
const existing = readFileSync(join(outDir, 'dossier.json'));
if (Buffer.from(rebuilt).equals(existing)) console.log('PASS  dossier.json byte-identical to fresh buildDossier() rebuild');
else { console.log(`FAIL  dossier.json differs from rebuild (existing ${existing.length} bytes, rebuilt ${rebuilt.length} bytes)`); failures++; }

// --- 2. farm plan parity between dashboard/app.js and board.json ---
const appJs = readFileSync('dashboard/app.js', 'utf8');
const fns = ['chainOf', 'capitalFor', 'holdDaysFor', 'actionFor', 'stepText', 'farmSteps'];
let src = '';
for (const name of fns) {
  const start = appJs.indexOf(`function ${name}(`);
  if (start < 0) { console.log(`FAIL  dashboard/app.js has no function ${name}`); failures++; continue; }
  // Function ends at the next "\n  }\n" after its start (top-level functions are indented by two spaces).
  const end = appJs.indexOf('\n  }\n', start);
  if (end < 0) { console.log(`FAIL  cannot extract function ${name} from dashboard/app.js`); failures++; continue; }
  src += appJs.slice(start, end + 5) + '\n';
}
const farmSteps = new Function(`${src}; return farmSteps;`)();
const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8'));
const rows = Array.isArray(board) ? board : board.rows;
let bad = 0;
for (const r of rows) {
  const page = farmSteps(r);
  if (page.length !== r.farm_steps.length || page.some((s: string, i: number) => s !== r.farm_steps[i])) bad++;
}
if (bad === 0) console.log(`PASS  dashboard farmSteps == board.json farm_steps for all ${rows.length} rows`);
else { console.log(`FAIL  dashboard farmSteps differ from board.json on ${bad} rows`); failures++; }

console.log(failures === 0 ? 'REGEN CHECKS PASSED' : `${failures} REGEN CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
