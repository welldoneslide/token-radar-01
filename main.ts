// token-radar-01 entrypoint (Node 22, standard library only).
//
// What this file does, in order:
//   1. Load the sealed snapshot (default /input/snapshot.json, or --input <file|dir>).
//   2. Score every protocol with the radar-4 model in lib/model.ts and rank the board.
//   3. Refuse to write anything if the board breaks the gate's own rules.
//   4. Write board.json and data.js, copy dashboard/ and screenshots/ into the output
//      directory, then write dossier.json last with the vendored make.fun library.
//      The dossier goes last because the scorer rebuilds it from the finished output
//      directory and compares the bytes.
//
// The dashboard is a static page with no framework and no network calls: its three
// files read the data.js this program writes from the same board the judge scores.
// The model lives in lib/model.ts, not here; this file is only the driver that wires
// the snapshot, the model, the dashboard and the dossier together.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

// Directory of this file: dashboard/ and screenshots/ are copied from beside it.
const root = fileURLToPath(new URL('.', import.meta.url));

// Caps taken from the scorer's reference gate: the text cap shapes the dossier
// bytes, the screenshot cap refuses oversize images instead.
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_LIMIT = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

// Write a message to stderr and stop with the given exit code.
function fail(message: string, code: number): never {
  process.stderr.write(message);
  process.exit(code);
}

// Value of a --name <value> (or --name=<value>) argument, or the fallback.
function option(name: string, fallback: string): string {
  const flag = `--${name}`;
  const at = process.argv.indexOf(flag);
  if (at >= 0 && at + 1 < process.argv.length) {
    const value = process.argv[at + 1];
    if (value !== undefined) return value;
  }
  const joined = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (joined === undefined) return fallback;
  return joined.slice(flag.length + 1);
}

// Copy a directory's regular files into `to`, skipping dotfiles, and report the names.
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

// --- 1. Find and load the snapshot. ---
const inputArg = option('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  fail(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`, 2);
}
const outDir = option('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// --- 2. Score the snapshot and refuse a board the gate would reject. ---
const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  fail(`token radar: the model wrote a board the gate refuses: ${issue}\n`, 1);
}

// --- 3. Write the board and the dashboard's data, then copy the static assets. ---
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

copyDir(join(root, 'dashboard'), join(outDir, 'dashboard'));
const shots = copyDir(join(root, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3) {
  fail(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`, 1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    fail(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`, 1);
  }
}

// --- 4. The dossier is written last: the scorer rebuilds it from this /output. ---
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: TEXT_MAX_BYTES,
    screenshots: SCREENSHOT_LIMIT,
    dashboard: { max_files: 400, max_bytes: 4_194_304 },
  }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(outDir, 'board.json')}, ${join(outDir, 'data.js')}, ${join(outDir, 'dashboard')} (3 files), ${join(outDir, 'screenshots')} (${shots.length} images) and ${join(outDir, 'dossier.json')}\n`,
);
