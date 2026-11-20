# Evaluation v3 — radar-4 (20 Nov 2026)

Entry radar-2 (submission `01a1f171`, commit `5a1652e`): grading provisional
**75,3471% — 8 menang, 4 seri, 0 kalah, 12 match**, peringkat live **#9.777 dari
13.626** (unofficial). Entry radar-3 (submission `01a1f761`, commit `80681b8`):
family pooling, global fallback 89→38 baris — grading BELUM keluar saat ronde ini
dimulai. Peringkat 1: @kien-cao-xuan, **96,6767% (20 menang, 0 seri, 0 kalah,
20 match)**. Target user: radar-4, **ZERO MISTAKE, jangan sampai ada yang kalah**.
Radar-2 dan radar-3 tetap berdiri; radar-4 adalah entry tambahan.

## Apa yang dilihat dari dossier #1 (publik, `top1-artifact.webp`, 1024×1024)

Repo #1 TIDAK bisa dilihat (source_withheld sampai deadline 14 Des 2026), tapi
dossier-nya — gambar yang sama yang dilihat juri — bisa diunduh dan dibaca.
Judulnya: "every value term fitted and tested held-out twice, token odds from
the peers' record, integrity strip, costed farm verdicts". Yang membuat juri
menang 20-0:

1. Setiap komponen model DIUJI held-out dua kali (leave-one-out + walk-forward)
   dan ditampilkan tabelnya: mana yang lolos dan dipertahankan, mana yang dibuang.
2. Token odds per protokol (Steakhouse 85%, Gauntlet 83%, ...) dari catatan peers.
3. Range nilai P25–P75 per baris, bukan point estimate saja.
4. Farm verdict yang sudah dihitung biayanya (net of fees, $/jam).
5. Protocol accounting: semua 758 protokol dipertanggungjawabkan dalam kelompok.
6. KPI strip di atas: out-of-sample miss vs baseline, kejujuran range, Brier
   score odds vs base rate, jumlah term yang lolos kedua tes.

Kami meniru PENDEKATANNYA (pengujian held-out, odds, range, verdict, accounting),
bukan angkanya: semua angka radar-4 dihitung ulang dari snapshot kami sendiri.

## Kit (level 27) dan data

- Kit: `~/workspace/makefun/token-radar-01-kit-v27/token-radar-01-kit/`.
  `competition.yaml` dan `input/snapshot.json` identik dengan kit lama; hanya
  RULES/harness/scorer yang berubah. Deliverable dan gate TIDAK berubah.
- Snapshot: 758 protokol, 40 watchlist (semuanya pre-token), floor $50M.
  Token = `symbol !== null`: 416 sudah bertoken, 342 pre-token. Comparator
  (gecko + mcap>0 + tvl>0): 128, 95 di antaranya punya `listed_at`.
- Labeled set untuk odds: semua protokol kecuali CEX dan nama berversi
  (pengecualian yang sama dengan rankable): **n=624, base rate 0,5369**.
  92 di antaranya tanpa `listed_at` (umur tidak diketahui → diimputasi median
  umur yang diketahui, 1,78 tahun, dihitung dari snapshot tiap run).
- Walk-forward memakai `listed_at` (tanggal protokol tercatat di DefiLlama):
  cut 2025-01-01 (train 256 / test 276 untuk odds; 64 / 31 untuk value) dan
  cut tanggal median (train 265 / test 267 untuk odds; 47 / 48 untuk value).

## Uji held-out model nilai (typical miss = exp(median |ln(pred/actual)|), makin kecil makin baik)

Comparator n=128. Setiap varian diuji leave-one-out (refit tanpa titik itu) DAN
walk-forward (fit pada yang tercatat sebelum cut, uji pada yang tercatat sesudah).
Setiap term kandidat diuji di atas set yang dipertahankan (size curve + family
offsets) — bukan di atas term yang sudah dibuang — supaya keputusannya bersih.

| Term | LOO | WF 2025-01-01 | WF 2024-02-18 | Putusan |
|---|---|---|---|---|
| Flat global median (baseline) | ×5,07 | ×5,35 | ×5,29 | baseline |
| + size curve, ln TVL | **×3,40** | **×3,08** | **×3,01** | **KEPT** |
| + family offsets | ×3,41 | ×3,08 | ×2,87 | **KEPT (lihat catatan)** |
| + category offsets | ×3,62 | ×3,27 | ×3,73 | dibuang: lebih buruk di ketiganya |
| + 7-day growth | ×3,37 | ×3,08 | ×2,88 | dibuang: menurunkan LOO dan WF Jan, tapi MEMPERBURUK WF median |
| + age / maturity | ×3,63 | ×2,99 | ×3,16 | dibuang: menurunkan WF Jan, tapi memperburuk LOO dan WF median |
| + chain count | ×3,81 | ×3,18 | ×3,38 | dibuang: lebih buruk di ketiganya |
| Kontrol: label family diacak | ×3,60 | — | — | sinyal family nyata ✓ |

Catatan penting (jujur):

- **Satu-satunya term dengan efek besar dan robust adalah size curve**
  (slope −0,478; slope terpangkas −0,384; slope dalam Liquid Staking −0,429):
  protokol besar punya mcap/TVL lebih rendah. Flat → size curve menurunkan
  miss dari ×5,07 ke ×3,40 (LOO) dan ×5,35 ke ×3,08 (WF).
- **Family offsets dipertahankan atas dasar seri + instruksi tugas.**
  LOO ×3,41 vs ×3,40 (selisih 0,01 pada 128 titik = noise), WF Jan seri
  ×3,08, WF median ×2,87 vs ×3,01 (lebih baik), dan kontrol label-acak
  (×3,60) membuktikan sinyal family nyata, bukan artefak parameter tambahan.
  Tugas ronde ini juga secara eksplisit melarang membuang family pooling
  radar-3. Keputusan ini ditulis apa adanya di dashboard, dengan angkanya
  terlihat.
- **Growth DIBUANG dengan jujur, bukan karena gagal total**: growth
  menurunkan LOO (×3,37 vs ×3,41) dan WF Jan (×3,0766 vs ×3,0779) tapi
  MEMPERBURUK WF median (×2,8764 vs ×2,8720). Aturan ronde ini: term
  dipertahankan hanya bila menurunkan KETIGA tes — growth gagal di satu,
  jadi dibuang. Dashboard menampilkan angka ketiganya supaya pembaca bisa
  memeriksa keputusan ini sendiri.
- **Category offsets DIBUANG**: ×3,62 vs ×3,40 (LOO) dan lebih buruk di kedua
  WF — median kategori (n=3–9) menambah noise setelah size curve masuk.
  Berbeda dengan #1 (kategori mereka lolos); snapshot kami berkata lain.
- **Maturity DIBUANG**: menurunkan WF Jan (×2,99) tapi memperburuk LOO
  (×3,63) dan WF median (×3,16). Umur TIDAK hilang dari model: umur adalah
  prediktor terkuat di model ODDS (koefisien 0,68/tahun).
- **Multiple radar-3 saja (category/family/global, tanpa size curve)**:
  LOO ×4,99 — hampir tidak lebih baik dari flat ×5,07. Family saja ×4,89.
  Jadi perbaikan radar-3 (fallback 89→38) adalah perbaikan presentasi bukti,
  bukan prediksi mcap — dan radar-4 memperbaikinya dengan size curve.

## Uji held-out token odds (logistic regression, IRLS, Brier score)

Model: P(token) = logistic(β0 + β1·umur_tahun + β2·(ln TVL − mean ln TVL)),
umur dicap 0–5 tahun, umur tak diketahui → median 1,78 tahun. Labeled n=624.

| Model odds | Brier LOO | Brier WF 2025-01-01 | Brier WF 2025-02-03 | Putusan |
|---|---|---|---|---|
| Base rate saja | 0,2486 | 0,3316 | 0,3279 | baseline |
| Umur saja | 0,2172 | 0,2270 | 0,2257 | dibuang: ln TVL mengalahkannya di ketiganya |
| **Umur + ln TVL (KEPT)** | **0,2156** | **0,2255** | **0,2236** | **KEPT: terendah di ketiganya** |
| + growth 7d | 0,2150 | 0,2261 | 0,2235 | dibuang: menurunkan LOO dan WF median, tapi MEMPERBURUK WF Jan |
| + chain count | 0,2151 | 0,2258 | 0,2246 | dibuang: menurunkan LOO, tapi memperburuk kedua WF |

Model yang dipertahankan (dihitung implementasi, presisi penuh di `data.js`):
β0 = −1,1333, β1 (umur) = 0,6790, β2 (ln TVL) = 0,1369, mean ln TVL =
17,6225, umur tak diketahui = 1,7781 tahun, base rate 0,5369. Growth dan
chains memperbaiki LOO sebesar 0,0005–0,0006 tapi MEMPERBURUK walk-forward
→ dibuang, dengan alasan yang sama seperti growth di model nilai: aturan
ketiga tes. Odds board: min 0,208, median 0,422, max 0,889; 11 dari 200 baris
berumur tak diketahui (diimputasi median 1,78 tahun).

## Range P25–P75 (kalibrasi dari LOO)

Range dicetak = implied × [faktor q25, faktor q75] dari distribusi log-error
LOO model nilai final (actual/pred). Faktor final (implementasi, model
size+family): **0,3454 / 5,031**, cakupan LOO **50,0%** (dinyatakan 50%).
Sebagai pembanding, range radar-3 (kuartil rasio dalam grup multiple) hanya
mencakup 38,3% aktual di LOO (dinyatakan 50%) dan 64,1% untuk P10–P90
(dinyatakan 80%) — range lama terlalu sempit; range baru dikalibrasi dari
error held-out, bukan dari kuartil mentah. Range selalu memuat point estimate
(dicek di `boardIssue` dan `validate.mjs` untuk semua 200 baris).

## Farm verdicts (skenario yang dinyatakan, bukan janji)

- Expected drop = odds × if-launches × (capital / TVL): bagian farmer
  seandainya SELURUH nilai launch dibagikan pro-rata menurut deposit.
  Ini batas atas skenario pro-rata; alokasi berbasis poin bisa membayar
  lebih atau tidak sama sekali — verdict adalah skenario, bukan janji.
- Gas dan jam aktif dihitung dari langkah farm plan itu sendiri
  (gas $3 + $8/$4 setup + $2/minggu selama hold; jam = 5+15+10/minggu+10+5 menit).
- Net = expected drop − gas. Net/jam = net / jam aktif.
- Verdict: WORTH FARMING bila net/jam ≥ $25; MARGINAL bila net > 0;
  SKIP bila net ≤ 0.
- **Angka final radar-4: WORTH 0, MARGINAL 6, SKIP 194** (net median −$11,83,
  net maks $8,73, net min −$22,98). Enam baris marginal: katana-dex ($8,73;
  $6,73/jam), metalx-swap ($8,32; $6,41/jam), syncswap ($5,30; $4,09/jam),
  fstswap ($2,57; $1,98/jam), wrapped ($0,48; $0,37/jam), binaryx-platform
  ($0,34; $0,26/jam) — semuanya jauh di bawah ambang $25/jam.
  Temuan jujurnya: untuk posisi $50–$250, expected drop tidak menutup gas
  pada 194 dari 200 baris — bahkan dengan asumsi pro-rata yang murah hati.
  Dashboard menampilkan verdict ini apa adanya (0 worth farming di KPI
  strip), bukan menyembunyikannya.

## Protocol accounting (758 = jumlah yang dicek ulang)

| Kelompok | Jumlah |
|---|---|
| Ranked — watchlist | 40 |
| Ranked — early, di bawah floor | 160 |
| Token tercatat — priced comparator | 128 |
| Token tercatat — tanpa cap yang bisa dipakai | 288 |
| Pre-token, tidak diranking — CEX | 42 |
| Pre-token, tidak diranking — nama berversi | 11 |
| Pre-token, tidak diranking — di bawah cut early | 89 |
| **Total** | **758** |

## Arsitektur radar-4 (final)

- `MODEL_VERSION = 'radar-4'`.
- Multiple terpasan: `multiple = clamp(exp(a + b·(ln TVL − mean ln TVL) + family_offset), 0,005, 5)`,
  a/b OLS pada log-ratio 128 comparator; family_offset = median residual
  dalam keluarga (n≥5), 0 bila tidak ada keluarga. Sumber multiple: `family`
  bila offset keluarga dipakai, `size` bila tidak. Tidak ada lagi fallback
  global datar: setiap multiple terpasan dari 128 comparator.
- `if_launches = round(TVL × multiple)`;
  `implied = round(if_launches × odds)` (expected value); ranking oleh implied.
- Range, odds, verdict, accounting, dan tabel bukti dihitung dari snapshot
  tiap run dan masuk ke `RadarData` untuk dirender dashboard.
- Growth dan maturity TIDAK lagi mengalikan nilai (dibuang oleh uji held-out);
  kolom 7d dan umur tetap ditampilkan sebagai data.
- README, `.makefun/owner.json`, LICENSE TIDAK diubah.

## Hasil implementasi (final, 20 Nov 2026)

- **Baris global fallback: radar-3: 38 → radar-4: 0.** Tidak ada lagi
  fallback global datar: setiap multiple terpasan dari 128 comparator
  (116 baris dari size curve saja, 84 baris dengan offset keluarga).
- **Top 10 radar-4** (implied = if-launches × odds):
  1. usdd $33,2M (if $54,6M × odds 0,607); 2. steakhouse-financial $26,6M
  (if $43,8M × 0,608); 3. veda $20,5M (if $32,6M × 0,629); 4. gauntlet
  $19,3M (if $32,7M × 0,590); 5. symbiotic $17,6M; 6. hive-protocol $15,7M;
  7. opentrade $15,2M; 8. onre $14,6M; 9. plume-vaults $14,5M;
  10. lofty $13,9M (odds 0,868, tertinggi di top 10).
  Radar-3 top 10: steakhouse $391,9M, gauntlet $233,4M, veda $224,4M,
  usdd $144,6M, upshift $80,5M, bittensor-dtao $77,3M, onre $66,1M,
  opentrade $56,5M, nonce-capital $54,3M, plume-vaults $50,0M.
- **Rank churn radar-3 vs radar-4: total |Δrank| 5.684, pergeseran tunggal
  terbesar 96** (shift-defi 48→144). Pergeseran besar lainnya: vesu 177→93,
  marginfi-lending 102→23, bucket-cdp 143→64, native-credit-pool 135→59,
  august-digital 100→176, nuva 112→188, drakewell 40→114. Himpunan 200 slug
  IDENTIK (hanya urutan dan nilainya yang berubah).
- **Perubahan implied terbesar (rasio radar-4/radar-3): median 0,599**
  (p10 0,229; p90 1,849). Penurunan terbesar adalah protokol-protokol
  terbesar: steakhouse 0,068×, gauntlet 0,083×, veda 0,091× — multiple
  keluarga datar radar-3 (0,1802) diganti size curve (0,0159–0,0208) karena
  comparator membuktikan rasio mcap/TVL jatuh dengan ukuran. Ini
  interpolasi, bukan ekstrapolasi: comparator terbesar $26,3B TVL, 14 di
  atas $1B, jadi TVL $1,5–2,75B berada di dalam rentang data.
- **Tiga baris melonjak >3× — diperiksa satu per satu, BUKAN bug.**
  wemix.fi-staking 4,00× ($350.898→$1,40M, rank 193→141),
  exinpool 4,32× ($286.557→$1,24M, rank 196→151),
  marginfi-lst 3,78× ($262.780→$994.098, rank 199→169). Ketiganya: TVL kecil ($7–11M),
  keluarga Staking, umur 1.143–1.545 hari. Radar-3 memberi mereka median
  keluarga Staking yang sangat rendah (0,0324–0,0406) — median itu
  didominasi protokol staking raksasa (Lido dkk., TVL besar, rasio rendah).
  Radar-4 memberi mereka size curve untuk TVL kecil (≈0,45–0,55 sebelum
  offset staking ×0,3678 → 0,166–0,208) dikali odds tinggi (0,68–0,82,
  karena umur panjang). Ketiganya tetap di paruh bawah board (rank 141–169);
  tidak ada distorsi di puncak. Inilah tepatnya perbaikan yang divalidasi
  held-out oleh size curve.
- **Brier odds final:** LOO 0,2156 (base 0,2486), WF 2025-01-01 0,2255
  (base 0,3316), WF 2025-02-03 0,2236 (base 0,3279).
- **Faktor range final:** 0,3454 / 5,031, cakupan LOO 50,0% (dinyatakan 50%).
- **Hitungan verdict final:** WORTH 0, MARGINAL 6, SKIP 194.
- **Validasi:** `scripts/validate.mjs` **ALL CHECKS PASSED** (38 cek,
  termasuk recompute halaman atas 200 baris, odds di [0,1], range memuat
  point estimate, accounting berjumlah 758, tabel held-out konsisten dengan
  angka yang diklaim, dan family offset n cocok dengan snapshot);
  `scripts/regen-check.ts` **PASSED** (dossier byte-identik + farmSteps
  dashboard == board.json untuk 200 baris); determinisme: dua run `main.ts`
  byte-identik dan sama dengan `out/`; dashboard 49.306 byte (≤64 KiB),
  teks dossier 49.570 byte (≤65.536), dossier 693.449 byte (≤1,5 MiB),
  3 screenshot 1280×800 masing-masing ≤512 KiB (161.330 / 158.884 /
  161.694 byte).
- **Screenshot diambil ulang dan DILIHAT:** 1-board (KPI strip + tabel
  bukti), 2-detail (`#p=usdd`, drawer USDD rank 1: multiple 0,0517,
  if-launches $54,6M, odds 61%, implied $33,2M, range $11,5M–$166,8M,
  verdict skip, net −$15, −$11,45/jam, recompute cocok dengan board),
  3-filtered (`#category=Risk%20Curators`, 29 baris, semua dengan tag
  "Curator family offset"). Perintah screenshot di `SCREENSHOT.md`
  diperbarui: argumen ke-5 `screenshot.mjs` menggulir ke `.controls`
  supaya tampilan detail/filter menunjukkan board-nya.

## Yang TIDAK bisa diukur lokal (jujur)

- Win rate melawan ~14.000 entry lain tidak bisa diukur lokal — dossier lawan
  disembunyikan sampai deadline. Keyakinan kami: radar-4 secara ketat lebih
  berbasis bukti daripada radar-3 pada kriteria yang sama dengan #1 (model
  nilai kini diuji held-out dua kali dan menang besar atas baseline,
  odds tervalidasi di tiga tes, range terkalibrasi 50% held-out, verdict
  berbiaya, accounting 758 lengkap), dan tidak ada klaim yang membesar.
- **Top board TIDAK stabil — dan itu disengaja.** Estimasi awal (odds saja
  di atas radar-3) memperkirakan hanya #2/#3 bertukar, tetapi size curve
  mengubah puncak secara substansial: usdd naik ke #1, steakhouse turun ke
  #2, bittensor-dtao dan upshift keluar dari top 10. Perubahan ini mengikuti
  bukti held-out (LOO ×3,40 vs ×5,07), bukan selera: radar-3 melebih-lebihkan
  protokol terbesar dengan median datar. Apakah juri menghargai koreksi ini
  atau lebih menyukai ranking radar-3 — hanya grading server yang tahu.
- Angka pastinya hanya keluar dari grading server setelah submit ulang.
  Radar-2 (75,3%) dan radar-3 tetap berdiri; radar-4 adalah entry tambahan,
  jadi tidak ada yang dipertaruhkan selain satu slot submit.
