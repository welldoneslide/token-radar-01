# token-radar-01 — Build Report (final, lokal)

> Status: **build selesai & tervalidasi lokal, 19 Nov 2026 ~00:15 WIB.**
> **JANGAN submit dari laporan ini** — submit butuh akses GitHub user (belum diberikan)
> + `makefun check` resmi + bundle transkrip (lihat §6 Blokir).
> Tidak ada submit, tidak ada repo GitHub dibuat, keypair tidak disentuh/dibaca.

## 1. Ringkasan

- Kompetisi: `token-radar-01` — "Build the best token launch radar", hadiah $1.325
  (1st $1.000, 2–5 @ $50, 6–10 @ $25), deadline **14 Des 2026 10:00 UTC / 17:00 WIB**.
- Repo kerja: `~/workspace/makefun/token-radar-01/`
  (kit: `~/workspace/makefun/token-radar-01-kit/token-radar-01-kit/`).
- Model: **radar-2** — implied value = TVL × multiple kategori (median mcap/TVL
  protokol bertoken sejenis, n≥3, fallback median global) × growth (clamp) × maturity.
  Semua angka dihitung ulang tiap run dari `input/snapshot.json`; tidak ada nama
  protokol yang di-hardcode, tidak ada angka luar snapshot.
- Board: **200 baris** (40 watchlist + 160 early), rank 1 steakhouse-financial
  $464.917.576 → rank 200 marginfi-lst $262.780.

## 2. Riwayat commit

| Commit | Isi |
|---|---|
| `5bb4f30` | init repo skeleton + LICENSE MIT |
| `db6ce81` | ANALYSIS.md — analisis kit + snapshot, metode radar-2 |
| `c3aea5a` | Implementasi radar-2 (lib/model.ts, dashboard) |
| `1efae49` | Build lengkap + script validasi + BUILD-NOTES + output provisional |
| `27a12ca` | Tooling screenshot (Playwright + Chrome for Testing) + proof |
| (berikutnya) | 3 screenshot final + dossier final + laporan ini |

## 3. File deliverable (di repo)

- `main.ts` (starter, tidak diubah), `lib/model.ts` (radar-2),
  `vendor/makefun-board.ts` (kit, byte-identik — sha256 `9ca51b6e…`),
  `dashboard/index.html` + `app.css` + `app.js` (35.281 byte total, ≤64 KiB, 0 `http(s)://`),
  `screenshots/1-board.png`, `2-detail.png`, `3-filtered.png` (1280×800, 141–175 KiB, ≤512 KiB),
  `output/` (artefak run lokal: board.json 278 KiB, data.js, dashboard/, screenshots/, dossier.json 662.102 byte ≤1,5 MiB),
  `scripts/validate.mjs`, `regen-check.ts`, `smoke-dom.mjs`, `screenshot.mjs`,
  `ANALYSIS.md`, `BUILD-NOTES.md`, `SCREENSHOT.md`, `screenshot-proof.png`.

## 4. Verifikasi — semua dijalankan ulang oleh koordinator (bukan percaya laporan anak)

| Cek | Hasil |
|---|---|
| Snapshot (rerun Python) | 758 protokol, 40 watchlist, TVL total $465,7 Miliar, watchlist $12,93 Miliar — cocok ANALYSIS |
| Board (rerun Python) | 200 baris, **40/40 watchlist**, rank 1..200 unik, implied menurun, 200 nilai berbeda, farm_steps 6/baris @124–197 karakter |
| `main.ts` 2× (rerun koordinator) | `diff -r` **byte-identik**, 200 baris tiap run |
| `scripts/validate.mjs output <snapshot>` | **29 PASS, 0 FAIL, "ALL CHECKS PASSED"** (builder klaim 30/30 — selisih hitung 1 baris, bukan kegagalan) |
| `scripts/regen-check.ts output` | dossier byte-identik dengan rebuild `buildDossier()`; farmSteps dashboard == board.json 200/200 |
| `scripts/smoke-dom.mjs output` | 200 baris, tabel multiple 15 baris, global=0.2138, fallback counts OK |
| Screenshot final (dilihat langsung) | 1-board: radar-2, Steakhouse $464.9M, 0.2138 (n=128); 2-detail: drawer Steakhouse + farm plan; 3-filtered: Risk Curators, 29 rows shown — ketiganya render asli dashboard ini, bukan starter |

## 5. Koreksi terhadap ANALYSIS.md (ditemukan builder, dikonfirmasi koordinator)

- Median global ANALYSIS (0,2049, n=129) dan Yield (0,180, n=10) **salah**.
  Hitungan ulang (Python + Node, filter `mcap_usd > 0`): **median global 0,2138 (n=128),
  Yield 0,1914 (n=9)**. Penyebab: 16 protokol punya `mcap_usd ≤ 0` (termasuk -1)
  yang wajib dikecualikan. Metode radar-2 tidak berubah; angka dihitung ulang tiap run.
- Fallback: **25 dari 40** watchlist (89 dari 200 baris), bukan 24 seperti klaim ANALYSIS.
  Semua baris fallback ditandai "global multiple" di dashboard.

## 6. Blocker screenshot — BERES

- `/opt/meta-chromium/chrome` tetap gagal (Hatch WebGL domain policy) — tidak dipakai.
- Berhasil: **Google Chrome for Testing 159.0.8154.6** (Playwright chromium r1255,
  `~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`), Playwright 1.65.1.
  `npx playwright install chromium` sempat timeout 30 dtk saat unduh 199 MB — diatasi
  unduh manual via curl + unzip. Semua shared library sudah ada, tanpa apt.
- Perintah final (lihat `SCREENSHOT.md` + `scripts/screenshot.mjs`):
  `CHROME_PATH=…/chrome node scripts/screenshot.mjs "file://$PWD/output/dashboard/index.html[#hash]" screenshots/N-name.png 1280 800`
- Catatan: `screenshot-proof.png` adalah render **starter** (Steakhouse $543.6M, radar-1) —
  hanya bukti browser jalan. 3 screenshot final di `screenshots/` adalah render
  **radar-2** (Steakhouse $464.9M), diverifikasi visual oleh koordinator.

## 7. Blokir untuk submit (jangan submit sebelum ini beres)

1. **Akses GitHub user BELUM diberikan** (disetujui 19 Nov 06:03 WIB, masih menunggu).
   Rute GitHub tetap yang paling aman; rute source bundle tercantum di deskripsi
   ("or a source bundle") tapi belum terbukti lolos intake.
2. **`makefun check` resmi belum dijalankan** — butuh `--transcripts` (bundle).
   Check lokal (`validate.mjs` dkk) lolos, tapi itu BUKAN check resmi; tidak ada local grade.
3. **Bundle transkrip + usage rows (`--muse-usage`)** belum dibuat. Sesi build ini
   adalah sesi Muse app yang bekerja di repo ini (+ subagent), jadi seharusnya
   bisa di-bundle; belum diuji. Perhatian: untuk rute source bundle, analis mencatat
   `makefun init` + anchor idealnya ada SEBELUM file pertama ditulis — kami tidak
   menjalankannya sebelum init repo. Kalau rute GitHub dipakai, risiko ini kecil;
   verifikasi saat `check` dijalankan.
4. **Kuota submit akun** belum dicek ulang sejak 06:15 WIB (`can_submit: true` saat itu
   untuk token-radar; day cap 3, hard limit 20 left). Cek `makefun status` sebelum submit.
5. Satu exec teknisi screenshot tercatat `userConfirmationRequired: timed_out`
   (event 2700) tapi exit 0 dan hasilnya terverifikasi — tidak berdampak yang terlihat.

## 8. Klaim kualitas — jujur

- Yang terbukti: board valid penuh, dashboard render asli + konsisten dengan board,
  dossier byte-identik, deterministik, semua cek lokal lolos.
- Yang TIDAK bisa diklaim: peringkat / win rate vs 17.944 submission. Juri adalah
  AI pairwise (superbot) atas dossier; tidak ada cara menguji skor juri secara lokal.
  Starter apa adanya = anchor 2-plain (strength 0,593 vs r3 3,253). Radar-2 memperbaiki
  model (multiple per kategori + transparansi fallback + farm plan per kategori) di atas
  starter, tapi seberapa jauh itu menaikkan win rate tidak terukur dari sini.
- Risiko sisa: 25/40 watchlist pakai fallback global (kategori tanpa pembanding cukup) —
  jujur ditampilkan, tapi juri bisa menilai model kategori lemah; 6 dari 10 early
  teratas adalah bridge (multiple bridge tinggi) — dibiarkan model berbicara, tidak
  disembunyikan.
