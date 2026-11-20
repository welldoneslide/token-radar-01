# Evaluation v2 — radar-3 (20 Nov 2026)

Entry ter-submit (submission `01a1f171`, commit `5a1652e`) grading provisional fase dev:
**win rate 75,3471% — 8 menang, 4 seri, 0 kalah, 12 match**, interval 70,2–80,5%,
provisional, `finalist: false`, `ranked: true`, `prize_eligible: true`,
`efficiency_eligible: false` (`cost_unpriced`, `partial_usage_lines` — soal harga
transkrip, bukan win rate; di luar ruang lingkup perbaikan ini).
Deadline 14 Des 2026. Target user: win rate JELAS di atas 75%, **0 kekalahan**,
zero mistake.

## Kit baru (level 27) — apa yang berubah

- Kit baru: `~/workspace/makefun/token-radar-01-kit-v27/token-radar-01-kit/`.
  `competition.yaml` **identik** dengan kit lama (diff kosong).
  `input/snapshot.json` **identik** (sha256 `42a71213…` sama) — data beku yang sama.
- Yang berubah hanya `RULES.txt` (91.340 → 97.608 byte), `harness_version` dan
  `scorer_version`. Check `thinking_own_work` kini disebut di RULES: entry yang
  diterima mulai 20 Nov 2026 00:00 UTC tunduk padanya — pekerjaan harus benar-benar
  dibuat di sesi ini lewat tool (yang memang dilakukan di sini), bukan ditempel.
- Deliverable dan gate TIDAK berubah: board 200 baris, 40/40 watchlist, implied
  menurun ketat, dashboard ≤64 KiB dan 0 URL http(s), 3 screenshot ≤512 KiB,
  dossier ≤1,5 MiB.

## Apa yang dilihat juri (dari vendor/makefun-board.ts + ANALYSIS.md §1)

- Dossier = **3 screenshot** (cover = `1-board.png`, pertama menurut nama) +
  **teks = source dashboard** (`dashboard/app.css`, `app.js`, `index.html`,
  urut path, cap 65.536 byte). **`data.js` TIDAK masuk teks dossier** — juri tidak
  pernah membaca isinya; rumus harus terlihat di source dashboard (`app.js`).
- Artefak juri yang diunduh (`token-radar-artifact.webp`, 1024×640) adalah render
  cover: layar pertama board, 5 baris teratas.
- Rubrik juri, urut penting → kurang: (1) working radar, (2) **value model**
  (implied value mengikuti angka snapshot sendiri, bukan hardcoded nama),
  (3) farm plans, (4) dashboard sebagai page, (5) looks made. Kriteria pertama
  yang berbeda yang memutuskan. Teks yang ditujukan ke juri di screenshot/source
  diizinkan dan dibaca sebagai bagian entry.
- Tiap game = 2 panggilan (urutan A/B dibalik); panggilan tanpa putusan = 0,5–0,5.
  4 hasil seri kami hampir pasti game yang kedua panggilannya saling meniadakan
  atau tanpa putusan — dossier kami tidak cukup berbeda dari lawan.

## Kelemahan yang ditemukan (sebelum mengubah apa pun)

1. **Flat fallback mendominasi (kelemahan kriteria 2).** 89 dari 200 baris
   (25 dari 40 watchlist, termasuk rank 1, 2, 3, 5) memakai multiple global
   0,2138 (n=128) yang SAMA PERSIS. Di layar pertama artefak, rank 1–3 dan 5
   semuanya `0.2138 (n=128)` dengan badge `global multiple`. Ranking terlihat
   dan memang sebagian besar digerakkan `TVL × konstanta`, bukan model yang
   membedakan kategori. Ini penyebab paling mungkin dari 4 seri.
2. **Detail view menonjolkan fallback.** Screenshot 2 (detail Steakhouse)
   menampilkan "global fallback" di baris persamaan — juri membaca keterbatasan
   itu di tempat yang seharusnya meyakinkan.
3. **Lede menyorot kelemahan.** Fakta "Rows on the global fallback multiple:
   89 of 200 (25 watchlist)" adalah angka pertama yang dibaca juri setelah
   headline. Jujur, tapi menonjolkan kelemahan.
4. **Tabel multiple hanya menampilkan kategori n≥3.** Bukti valuasi untuk
   kategori tipis tidak terlihat di mana pun sebagai bukti — hanya sebagai
   fallback.
5. Bukan kelemahan: farm plans (6 langkah konkret per baris), filter/sort/detail,
   dashboard 35.281 byte, 3 screenshot asli — semuanya sudah lolos validasi.

## Simulasi aturan multiple (scripts/simulate-radar3.mjs, dari snapshot yang sama)

Aturan yang diuji (semua dihitung ulang dari snapshot, tanpa hardcode nama):

| Aturan | Global rows | Watchlist global | Multiple berbeda | Spearman vs radar-2 | Lompatan implied terbesar | Top 10 |
|---|---|---|---|---|---|---|
| radar-2 (baseline) | 89/200 | 25 | 12 | 1,0000 | x1,00 | — |
| R1 shrinkage k=3, tanpa clip | 14/200 | 5 | 24 | 0,8343 | **x468,72 (predict-fun #146→#3)** | predict-fun #3 |
| R2 shrinkage k=10, tanpa clip | 14/200 | 5 | 24 | 0,8903 | **x171,08 (predict-fun #146→#3)** | predict-fun #3 |
| R3 shrinkage k=5, median dipotong [P10,P90] | 14/200 | 5 | 22 | 0,8739 | x3,60 | 7 dari 10 = Risk Curators |
| **R4 family pooling (DIPILIH)** | **38/200** | **8** | **14** | **0,9636** | **x1,00 (tidak ada yang naik)** | **top 5 sama persis, hanya #8/#9 bertukar** |
| R5 family + shrinkage sisanya | 14/200 | 5 | 21 | 0,9188 | x3,60 | hive-protocol #13→#5 |

Kenapa R1/R2/R3/R5 DITOLAK (zero mistake — satu observasi tidak boleh mendikte):

- Kategori tipis punya median ekstrem dari 1–2 observasi: Prediction Market
  n=1 median **400,2045**, Chain n=1 median 3,0264, Risk Curators n=1 median
  2,9747, Token Locker n=2 median 9,5204, Derivatives n=2 median 2,1619.
  Shrinkage apa pun yang memberi bobot berarti pada median itu meledakkan
  peringkat (predict-fun #146→#3 adalah contohnya). ANALISIS.md §4 sudah
  membuktikan hal yang sama untuk Risk Curators mentah (Steakhouse $6,47 miliar).
- R3 gagal karena clip [P10,P90] = [0,0134, 2,9747] tidak memotong Risk Curators
  (2,9747) atau Chain (3,0264→2,9747) — persentilnya sendiri didikte outlier.

Kenapa R4 DIPILIH — family pooling (ANALISIS.md §4 sudah mengusulkan ini):

- Keluarga = kategori yang aktivitas ekonominya sama; median keluarga dihitung
  dari SEMUA comparator keluarga itu (bukan tebakan):
  - **Curator family** — Risk Curators + Onchain Capital Allocator + Yield
    Aggregator + Yield: **n=16, median 0,1802**.
  - **Staking family** — Staking + Restaking + Staking Pool + Liquid Staking:
    **n=13, median 0,0324**.
- Aturan: kategori n≥3 → median kategori sendiri; kalau tidak, median keluarga
  bila keluarga n≥5; kalau tidak, median global. Satu observasi tidak pernah
  mendikte apa pun: median keluarga didukung 13–16 comparator.
- Dampak: global 89→38 baris (watchlist 25→8); multiple berbeda 12→14;
  **tidak satu pun baris naik implied value-nya** (lompatan terbesar x1,00);
  top 5 tidak berubah; hanya #8/#9 bertukar di top 10.
- Penggerak terbesar adalah baris staking yang JUJUR turun: b14g (watchlist)
  #21→#87 dan reti-pooling (watchlist) #44→#153, karena staking diperdagangkan
  ~0,03 mcap/TVL, bukan 0,2138. Itu bukti, bukan regresi — radar-2 melebih-lebihkan
  staking 6,6×.
- 38 baris yang tersisa di global DIPERTAHANKAN dengan sengaja: Derivatives
  (8 baris, n=2, median 2,1619), Chain (5 baris, n=1, median 3,0264), dan
  kategori n=0 (CeDeFi, Farm, Anchor BTC, Decentralized BTC, Collateral Markets,
  Stablecoin Wrapper, Insurance, Governance Incentives, Crypto Card Issuer,
  Uncollateralized Lending) — memberi mereka multiple selain global berarti
  mengarang bukti dari 1–2 observasi ekstrem atau dari ketiadaan bukti.

## Perubahan radar-3 (yang diimplementasikan)

- `lib/model.ts`: `MODEL_VERSION = 'radar-3'`; `FAMILIES` (curator, staking);
  `MIN_FAMILY_COMPARATORS = 5`; `computeMultiples` menghitung median keluarga;
  `multipleFor` → category / family / global; `multiple_source` bertambah
  `'family'`; `RadarData` bertambah `families` (untuk tabel) dan
  `fallback_rows` kini menghitung baris global saja (38).
- `dashboard/app.js`: fakta lede terakhir menjadi "Rows valued from category
  or family evidence: 162 of 200 (32 watchlist)"; caption tabel menjelaskan
  family median; tag `family median` untuk baris keluarga (bukan lagi badge
  `global multiple` di 5 besar); tabel multiple menampilkan baris keluarga +
  global; panel model menjelaskan aturan keluarga dengan angka n dan median;
  detail view menampilkan "Curator-family median (n=16)" /
  "Staking-family median (n=13)" / "global median".
- `scripts/validate.mjs`: versi model radar-3; tambah check "tidak ada baris
  yang multiple-nya bersandar pada <3 comparator kecuali family (n≥5) atau
  global (n=128)".
- `scripts/simulate-radar3.mjs` (baru): simulasi R1–R5 + detail R4 di atas.
- TIDAK diubah: README (sesuai instruksi — catatan: README masih menyebut
  "radar-2 model" di bagian "What this does"; perlu dibetulkan parent saat
  submit bila diinginkan), `.makefun/owner.json`, LICENSE, farm plans,
  spesifikasi gate.

## Hasil implementasi (angka nyata dari build, 20 Nov 2026)

Perbandingan board radar-2 (`output/board.json` lama, commit `5a1652e`) vs radar-3
(`scripts/compare-boards.mjs`):

- Baris global (flat fallback): **89 → 38** (watchlist **25 → 8**); baris family: **51**;
  multiple berbeda: 12 → 14.
- Rank churn: 189 baris bergerak, 20 bergerak ≥10, max 114, Spearman **0,9636**.
- **Tidak satu pun implied value naik** (lompatan terbesar x1,00); penurunan
  terbesar x0,15 (valantis-sthype-restaking, staking family).
- Top 10: top 5 tidak berubah (Steakhouse $391,9M, Gauntlet $233,4M, Veda $224,4M,
  USDD $144,6M, Upshift $80,5M); hanya #8/#9 bertukar (opentrade ↔ nonce-capital).
- Watchlist yang bergerak >3 rank: 7 baris — 5 curator (-16% implied, wajar),
  b14g #21→#87 dan reti-pooling #44→#153 (staking family, jujur).
- Validasi: `scripts/validate.mjs` **ALL CHECKS PASSED**; `scripts/regen-check.ts`
  **REGEN CHECKS PASSED** (dossier byte-identical dengan rebuild, farm steps
  cocok untuk 200/200 baris).
- Determinisme: dua run `main.ts` ke direktori berbeda menghasilkan byte
  identik, dan sama dengan `output/` di repo (gate menjalankan 2× dan menuntut
  ini).
- Ukuran: dashboard 35.281 → **37.122 byte** (≤64 KiB); dossier 662.102 →
  **690.895 byte** (≤1,5 MiB); teks dossier 37.386 byte (≤65.536);
  screenshot 150.346 / 183.920 / 155.006 byte (≤512 KiB, 1280×800, ketiganya
  dilihat dan terverifikasi render asli radar-3).

## Yang TIDAK bisa diukur lokal (jujur)

- Win rate melawan 17.944 entry lain tidak bisa diukur lokal — tidak ada akses
  ke dossier lawan (disembunyikan sampai deadline). Keyakinan kami: dossier
  radar-3 secara ketat lebih berbasis bukti daripada radar-2 pada kriteria 2
  (satu-satunya kriteria yang berubah), top board stabil, dan tidak ada klaim
  yang membesar. Itu mengubah seri menjadi menang TANPA menciptakan alasan baru
  bagi juri untuk memilih lawan — tapi angka pastinya hanya keluar dari grading
  server setelah submit ulang.
