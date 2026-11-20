# Evaluation v4 — radar-5 (20 Nov 2026)

Entry radar-2 (submission `01a1f171`, commit `5a1652e`): grading provisional
**75,3471% — 8 menang, 4 seri, 0 kalah, 12 match**, peringkat live **#9.777 dari
13.626** (unofficial). Entry radar-3 (submission `01a1f761`, commit `80681b8`):
grading belum keluar. Entry radar-4 (commit `16991c5` + cover fix `89b8ffe`):
BELUM di-submit — user menahan submit dan minta diperbaiki sampai
benar-benar terbaik. Peringkat 1: @kien-cao-xuan, **96,6767% (20 menang,
0 seri, 0 kalah, 20 match)**. Target user: perbaiki kelemahan radar-4.
Radar-2 dan radar-3 tetap berdiri; radar-5 adalah entry tambahan.

Ronde ini menambah satu walk-forward cut ketiga (**2024-08-01**) ke semua uji,
jadi aturannya sekarang empat tes: leave-one-out + tiga walk-forward. Setiap
term dipertahankan hanya bila tidak pernah memperburuk satu pun dari keempat
tes. Kit level 27, snapshot tidak berubah.

## 1. Family offsets — diuji ulang, lalu dipecah: staking dipertahankan, curator dibuang

Radar-4 mempertahankan kedua offset keluarga atas dasar seri (LOO ×3,41 vs
×3,40) dan satu kontrol shuffle deterministik (×3,60). Ronde ini menguji
ulang dengan 200 shuffle per keluarga + cut ketiga:

| Uji | Staking | Curator |
|---|---|---|
| LOO (typical miss) | **×3,3937** (size saja ×3,3987) | ×3,4525 (lebih buruk) |
| WF 2025-01-01 | ×3,0779 (seri) | ×3,0779 (seri) |
| WF 2024-02-18 | **×2,8720** (size saja ×3,0087) | ×3,0087 (tidak membantu) |
| WF 2024-08-01 | ×2,8793 (seri) | ×2,8793 (seri) |
| Mean \|log error\|, 4 tes | **1,5768 / 1,5991 / 1,4889 / 1,5633** vs size saja 1,5959 / 1,6482 / 1,5633 / 1,6399 — turun di keempatnya | 1,6153 / 1,6566 / 1,6188 / 1,6394 — lebih buruk di keempatnya |
| Permutasi 200 shuffle | p = **0,235** (47/200 mengalahkan), rata-rata shuffle ×3,4545 | p = **0,775** (155/200 mengalahkan), rata-rata shuffle ×3,4594 |
| Offset di train WF | stabil: −0,76 / −0,92 / −1,02 (full −1,00) | tidak stabil: +0,13 / +0,70 / −0,01 (full −0,72) — tanda berubah |

Keputusan: **staking dipertahankan, curator dibuang.** Alasan staking
dipertahankan meski p = 0,235 (tidak signifikan pada 0,05): ia tidak pernah
memperburuk satu pun tes pada dua metrik, offset-nya stabil di semua train
set, dan metrik median kasar (hanya 6–9 dari 31–48 titik tes yang membawa
offset, jadi median sering tidak bergerak). Aturan keep yang dipakai ditulis
apa adanya di dashboard: "only terms that never worsen a held-out test".
Alasan curator dibuang: memperburuk LOO dan mean error di semua tes,
permutasi p = 0,775, offset berubah tanda antar train set.

Kontrol shuffle tunggal radar-4 (×3,60) ternyata satu draw yang beruntung
dari distribusi dengan rata-rata ×3,50 dan simpangan baku 0,19 — 200 shuffle
menggantikannya. Dashboard kini menampilkan angka permutasi kedua keluarga.

Dampak ke board: baris curator kehilangan pengali ×0,4855 → implied naik
tepat ×2,06 (kebalikan pengali lama). Baris family 84 → 23 (staking saja).

## 2. Growth dan maturity — semua formulasi alternatif diuji, tidak ada yang lolos

Diuji di atas size + staking (bukan size + family seperti eksperimen awal;
angka di bawah adalah angka produksi):

| Term | LOO | WF Jan | WF med | WF Aug | Putusan |
|---|---|---|---|---|---|
| + 7-day growth (asli) | ×3,3160 | ×3,0766 | ×2,8764 | ×2,8830 | dibuang: turun LOO+Jan, buruk med+Aug |
| + growth, capped ±20/30% ×0,25 | ×3,3568 | ×3,0773 | ×2,8742 | ×2,8811 | dibuang: turun LOO+Jan, buruk med+Aug |
| + growth, TVL ≥ $100M saja | ×3,3937 | ×3,0779 | ×2,8764 | ×2,8830 | dibuang: seri LOO+Jan, buruk med+Aug |
| + age / maturity (pengali) | ×3,3967 | ×2,9892 | ×2,8840 | ×2,9095 | dibuang: turun Jan saja |
| + age, linear di log space | ×3,3477 | ×4,2509 | ×2,8631 | ×2,8579 | dibuang: Jan meledak ×4,25 |
| + age × ln TVL | ×3,3445 | ×3,1740 | ×2,6039 | ×3,3701 | dibuang: turun LOO+med, buruk Jan+Aug |
| + category offsets | ×3,6232 | ×3,2678 | ×3,4675 | ×3,5031 | dibuang: buruk di keempatnya |
| + category, shrunk n/(n+5) | ×3,5966 | ×3,0779 | ×3,0087 | ×3,1828 | dibuang: buruk LOO+med+Aug |
| + chain count | ×3,7290 | ×3,1674 | ×3,3652 | ×3,8020 | dibuang: buruk di keempatnya |

Tidak ada formulasi yang lolos keempat tes. Growth dan maturity tetap
dibuang, dan dashboard kini menampilkan ke-13 term nilai (dulu 7 + kontrol)
supaya juri melihat semuanya sudah dicoba.

## 3. Odds — prediktor tambahan diuji, tidak ada yang lolos; odds tetap konservatif

Diuji di atas age + ln TVL (Brier LOO 0,2156 / Jan 0,2255 / med 0,2236 /
Aug 0,2360; base rate 0,2486 / 0,3316 / 0,3279 / 0,3947):

| Term | LOO | WF Jan | WF med | WF Aug | Putusan |
|---|---|---|---|---|---|
| + family dummies | 0,2138 | 0,2281 | 0,2247 | 0,2651 | dibuang: buruk di ketiga WF |
| + age × ln TVL | 0,2154 | 0,2243 | 0,2221 | 0,2422 | dibuang: turun 3 tes, buruk Aug |
| + growth, capped | 0,2150 | 0,2275 | 0,2241 | 0,2310 | dibuang: buruk Jan+med |
| + 7-day growth (asli) | 0,2150 | 0,2261 | 0,2235 | 0,2309 | dibuang: buruk Jan saja |
| + chain count | 0,2151 | 0,2258 | 0,2246 | 0,2383 | dibuang: buruk di ketiga WF |

Odds tetap age + ln TVL. Temuan tambahan: koefisien family dummies
NEGATIF (curator −0,49, staking −0,65) — dengan umur dan TVL yang sama,
protokol curator/staking justru LEBIH JARANG bertoken. Odds Steakhouse 61%
di model kami vs 85% di dossier #1 adalah arah yang berlawanan dengan apa
yang didukung snapshot kami; angka #1 tidak dikejar tanpa bukti.

## 4. Range — menyempit karena model membaik

Range dihitung ulang dari LOO error model final (size + staking):
**×0,3267 / ×4,1966, rentang 12,84×** (radar-4: ×0,3454 / ×5,0310,
rentang 14,56×). Cakupan LOO tetap **50,0%** sesuai yang dinyatakan.
Masih lebar — kejujuran soal ketidakpastian, bukan klaim presisi.

## 5. KPI "0 worth farming" — ambang TIDAK diturunkan, best plan ditampilkan

Ambang $25/jam tetap. Kartu KPI kini menampilkan hitungan dan peluang
terbaik berdampingan: **"0 of 200 — 6 marginal · 194 skip — best $6,73/jam —
Katana DEX (bar $25/jam)"**, plus kalimat yang sama di panel model
("threshold is not lowered to manufacture a winner"). Hitungan verdict
tidak berubah (**0 worth, 6 marginal, 194 skip**) — penggandaan baris
curator tidak membalik satu verdict pun, karena expected drop terbesar
tetap kecil dibanding gas pada TVL besar.

## 6. Cover — rank 1–5 kini kelihatan di layar pertama

CSS dipadatkan secara aman (h1 30→26px, padding lede/KPI/controls/tabel
dirapatkan, caption board dipendekkan jadi satu baris; evidence tetap ada
di bawah board). Screenshot 1-board kini menampilkan rank 1–5 penuh:
Steakhouse $54,8M, Veda $42,2M, Gauntlet $39,7M, USDD $33,2M, Upshift
$23,1M. Ketiga screenshot diambil ulang dan DILIHAT: 1-board (KPI +
rank 1–5), 2-detail (`#p=steakhouse-financial`, drawer rank 1: multiple
0,0327 size curve, if-launches $90,1M, odds 61%, implied $54,8M, range
$17,9M–$230,0M, recompute cocok), 3-filtered (`#category=Risk%20Curators`,
29 baris, tanpa tag family curator lagi — benar, karena offset curator
dibuang).

## Board radar-4 → radar-5

- Total |Δrank| **4.036** (radar-3→4: 5.684), max move 55
  (exponent-yield-exchange), Spearman **0,9122**, 199/200 baris bergerak,
  154 bergerak ≥10. Himpunan 200 slug IDENTIK.
- Rasio implied: median **1,000**, p10 1,000, p90 2,060. Kenaikan terbesar
  **×2,06** (sharpbyte-capital, baris curator — tepat 1/0,4855).
  **Tidak ada baris yang turun** (rasio minimum 1,00). Tidak ada lonjakan
  >3×.
- Top 10 baru: 1. steakhouse-financial $54,8M (was #2), 2. veda $42,2M,
  3. gauntlet $39,7M, 4. usdd $33,2M (was #1), 5. upshift $23,1M (was
  #12), 6. symbiotic $17,6M, 7. hive-protocol $15,7M, 8. opentrade $15,2M,
  9. onre $14,6M, 10. plume-vaults $14,5M.

## Bug yang ditemukan dan diperbaiki ronde ini

`fitValueModel` menerima parameter `familyOf` dengan default `familyFor`
— tapi `familyFor` menerima string kategori, sementara pemanggil
memberinya objek protokol, jadi selalu mengembalikan null dan offset
TIDAK PERNAH diterapkan. Node hanya men-strip type tanpa type-check,
jadi tidak ada error. Bug ini tertangkap karena angka output diperiksa
langsung (familyOffsets kosong, term staking identik dengan size-only),
bukan karena validasi: cek-cek `validate.mjs` lolos secara vakum
(`.every` pada array kosong). Diperbaiki dengan adapter
`(p) => familyFor(p.category)`, dan `validate.mjs` diperkuat dengan cek
eksplisit (tepat 1 offset, staking, negatif, n≥5; board punya baris
family). Verifikasi tambahan: `tsc --strict --noEmit` atas `lib/model.ts`,
`main.ts`, `scripts/regen-check.ts` kini lolos dengan 0 error.

## Validasi (semua hijau)

- `scripts/validate.mjs` **ALL CHECKS PASSED — 45 cek** (termasuk 7 cek
  baru radar-5: staking tidak pernah memperburuk tes, curator dibuang dan
  memperburuk LOO, semua term membawa cut WF ketiga, permutasi 200
  shuffle dengan p staking < p curator, tepat 1 offset staking negatif,
  board punya baris family + size, best_farm = baris terbaik).
- `scripts/regen-check.ts` **PASSED** (dossier byte-identik + farmSteps
  dashboard == board.json 200 baris).
- **Determinisme:** dua run `main.ts` ke direktori berbeda byte-identik
  satu sama lain dan sama dengan `output/`.
- **Typecheck:** `tsc --strict --noEmit` 0 error (lib/model.ts, main.ts,
  scripts/regen-check.ts).
- Gate: dashboard 51.696 byte (≤64 KiB), teks dossier 51.960 byte
  (≤65.536), dossier 667.261 byte (≤1,5 MiB), 3 screenshot 1280×800
  (153.903 / 175.347 / 159.860 byte, masing-masing ≤512 KiB).
- README, `.makefun/owner.json`, LICENSE tidak disentuh (diff 0 baris).
- Waktu build naik ~4 detik → ~28 detik (permutasi 2×200 shuffle + 13
  term nilai + 8 term odds + cut ketiga). Perlu diperhatikan kalau grader
  punya batas waktu ketat — tidak diketahui, batas tipikal bermenit-menit.

## Yang TIDAK bisa diukur lokal (jujur) dan kelemahan yang TETAP ada

- Win rate melawan ~14.000 entry lain tidak bisa diukur lokal. Apakah juri
  menghargai penghapusan offset curator (Steakhouse kembali #1) atau lebih
  suka ranking radar-4 — hanya grading server yang tahu.
- **Staking dipertahankan dengan bukti moderat, bukan signifikan:**
  p = 0,235 dan aturan "tidak pernah memperburuk" lebih lemah dari bar
  signifikansi 0,05. Juri yang ketat bisa menganggapnya noise; angkanya
  ditampilkan apa adanya supaya keputusan ini bisa diaudit.
- **Odds tetap konservatif** (Steakhouse 61% vs 85% di #1) — tidak ada
  prediktor tambahan yang lolos keempat tes.
- **Range masih lebar** (12,84×) dan **"0 worth farming" tetap 0** —
  keduanya jujur, tapi bisa kebaca negatif dibanding dossier #1.
- Radar-2 (75,3%) dan radar-3 tetap berdiri; radar-5 adalah entry
  tambahan, jadi tidak ada yang dipertaruhkan selain satu slot submit.
