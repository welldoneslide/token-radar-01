# token-radar-01 — Build Notes (radar-2)

Status: **build selesai & tervalidasi lokal, 19 Nov 2026**. Belum submit, belum ada repo GitHub.
Yang belum selesai: **3 screenshot final** (teknisi lain), **regenerasi dossier.json setelah
screenshot final ada**, dan **`makefun check` resmi** (butuh transkrip + repo).

## 1. Yang diubah dari starter

Starter disalin utuh sebagai basis (`main.ts`, `lib/`, `vendor/`, `dashboard/`), lalu diubah:

| File | Perubahan |
|---|---|
| `lib/model.ts` | Model `radar-1` → **`radar-2`**: multiple per kategori = median mcap/TVL protokol bertoken sejenis (n ≥ 3), fallback median global. `MODEL.base_multiple` (0,25 datar) dihapus. `computeMultiples()` menghitung semua multiple dari snapshot tiap run. `BoardRow.model` / `RadarRow` membawa `multiple`, `multiple_n`, `multiple_source`. `RadarData` membawa `global_multiple`, `global_n`, tabel `multiples`, `fallback_rows`, `fallback_watchlist`. Aksi farm baru per kategori (lihat §4). |
| `dashboard/app.js` | `impliedOf()` memakai multiple per baris (bukan `base_multiple`); kolom **Multiple (n)** di tabel board (bisa di-sort); badge **"global multiple"** di baris fallback; detail view menampilkan baris **Multiple (n)** + keterangan fallback; halaman model menampilkan **tabel multiple per kategori + n pembanding** dan paragraf kejujuran model; `actionFor()` diselaraskan dengan `lib/model.ts` (dicek byte-per-baris, lihat §6). |
| `dashboard/app.css` | Tambah `.tag.fallback` dan `.multiples` (tabel multiple). Palet & layout starter dipertahankan. |
| `dashboard/index.html` | Tidak diubah. |
| `main.ts`, `vendor/makefun-board.ts` | **Tidak diubah.** Vendor sha256 `9ca51b6e…` cocok dengan `kit.json` (byte-identik dengan kit). |
| `scripts/validate.mjs` | Script cek independen (gate board, farm steps, ukuran, no-network, dossier). |
| `scripts/regen-check.ts` | Cek dossier = rebuild `buildDossier()` byte-identik + paritas farm plan dashboard vs board.json. |
| `scripts/smoke-dom.mjs` | Smoke test render dashboard dengan stub DOM (tanpa browser): tabel 200 baris, tabel multiple, detail view, filter kategori. |
| `output/` | Artefak run validasi (board.json, data.js, dashboard/, screenshots placeholder, dossier.json **provisional** — lihat §7). |

Snapshot **tidak** dicopy ke repo: `main.ts` membaca `--input <kit>/input/snapshot.json`
secara lokal; di grading, snapshot di-mount di `/input` (default `main.ts`). Tidak ada angka
di luar snapshot yang di-hardcode; tidak ada nama protokol yang di-hardcode di `lib/model.ts`
(dicek otomatis di `scripts/validate.mjs`).

## 2. Rumus radar-2 (yang benar-benar dipakai)

```
multiple(kategori) = median(mcap_usd / tvl_usd) atas protokol bertoken kategori sama
                     (mcap_usd > 0, tvl_usd > 0, gecko_id tercatat), bila n >= 3;
                     bila tidak, median global (n=128) = 0,2138
growth     = clamp(change_7d, -60, 120)
growthMult = 1 + (growth / 100) * 0,5
maturity   = 0,6 + min(age_days, 1095) / 1095 * 0,4   (age null -> 365 hari)
implied    = max(1, round(tvl_usd * multiple * growthMult * maturity))
```

Multiple dibulatkan ke 4 desimal **sebelum** dipakai, supaya recompute di `app.js` dari
`row.multiple` menghasilkan angka yang persis sama dengan `board.json` (terbukti 200/200 baris).

### Multiple yang terhitung dari snapshot (19 Nov 2026, diverifikasi 2 cara: Node + Python)

| Kategori | n | Multiple | Kategori | n | Multiple |
|---|---:|---:|---|---:|---:|
| Lending | 15 | 0,1324 | Bridge | 6 | 0,5567 |
| Dexs | 11 | 0,3424 | Cross Chain Bridge | 4 | 1,2205 |
| Liquid Staking | 9 | 0,0406 | Yield Aggregator | 4 | 0,1510 |
| Yield | 9 | 0,1914 | Indexes | 3 | 0,1477 |
| CEX | 9 | 0,0748 | CDP | 3 | 0,1687 |
| RWA | 9 | 0,2748 | Privacy | 3 | 0,9691 |
| Canonical Bridge | 8 | 0,7464 | **Global fallback** | **128** | **0,2138** |
| Basis Trading | 7 | 0,6544 | | | |

### Koreksi terhadap ANALYSIS.md (penting, bukan karangan)

ANALYSIS.md menulis median global **0,2049 (n=129)** dan Yield **0,180 (n=10)**. Kedua angka
itu **tidak bisa direproduksi** dari `snapshot.json` (sha256 `42a71213…`): dua implementasi
independen (Node dan Python `statistics.median`) dengan semua varian filter yang masuk akal
(mcap>0/tvl>0 ± syarat gecko, mcap≠null, mcap≥0) menghasilkan **median global 0,2138 (n=128)**
dan **Yield 0,1914 (n=9)**. Tidak ada varian yang menghasilkan n=129 atau 0,2049.
Keputusan build: **metode dipertahankan persis** (median, ambang n ≥ 3, fallback global),
tetapi angkanya dihitung ulang dari data tiap run — itulah yang dilakukan `computeMultiples()`.
Akibatnya implied value sedikit lebih tinggi dari contoh di ANALYSIS.md (mis. steakhouse
$464,9 jt vs $445,6 jt di ANALYSIS) karena multiple globalnya 0,2138, bukan 0,2049.
Klaim ANALYSIS "24 dari 40 watchlist pakai fallback" juga tidak konsisten dengan tabelnya
sendiri di §4 yang berjumlah **25** — hasil hitung build ini **25 dari 40**, cocok dengan tabel.

## 3. Board (200 baris)

- **40 watchlist + 160 early** (pre-token di bawah floor $50 jt, TVL menurun), total **200 baris**.
- Rank 1–62 ditempati watchlist; implied watchlist $7,2 jt – $464,9 jt.
- **22 baris early** mengalahkan implied watchlist terbawah — early rows bukan pengisi.
- 10 besar: steakhouse-financial $464,9 jt · gauntlet $276,9 jt · veda $266,2 jt ·
  usdd $144,6 jt · upshift $95,5 jt · bittensor-dtao $77,3 jt · onre $66,1 jt ·
  nonce-capital $64,4 jt · opentrade $56,5 jt · plume-vaults $50,0 jt.
- Urutan 10 besar sama dengan ANALYSIS.md; tidak ada bridge di 20 besar (bridge di bawah
  floor TVL-nya kecil, meski multiple bridge tinggi — model yang berbicara).
- Fallback global dipakai **89 dari 200 baris** (25 dari 40 watchlist), semuanya ditandai
  di board ("global multiple") dan di detail view.

## 4. Farm plan

- 6 langkah per baris (20–600 karakter, dicek otomatis), selalu memuat biaya + waktu.
- Aksi utama baru per kategori (selain yang sudah ada di starter): **Chain** (bridge + pakai
  aplikasi native), **Basis Trading** (vault basis-trading), **Payments** (buka payment
  channel), **Governance Incentives** (lock/stake + voting), **Collateral Markets**
  (deposit sebagai collateral), **CeDeFi** (vault CeDeFi), **Stablecoin Wrapper**
  (wrap/mint stable asset), **Restaking** (restake), **Staking Pool** (stake ke pool),
  **CDP** (deposit collateral untuk mint stable asset). Risk Curators / Onchain Capital
  Allocator tetap memakai cabang vault starter.
- Larangan yang dipatuhi: tanpa APY, tanpa "airdrop confirmed", tanpa "dijamin" (dicek
  otomatis). Modal kerja dari TVL starter ($50/$100/$150/$250); gas disebut kisaran kasar.

## 5. Dashboard

- Arsitektur starter dipertahankan: `index.html` + `app.css` + `app.js` + `data.js` (di samping
  dashboard/), tanpa network, hash-state untuk search/filter/detail.
- Tambahan: tabel multiple per kategori + n (halaman model), kolom "Multiple (n)" + sort di
  tabel board, badge fallback di baris, baris "Multiple (n)" di detail view, fakta fallback
  di lede ("89 of 200 (25 watchlist)"), paragraf kejujuran model (median vs mean, TVL satu-satunya
  proksi ukuran, implied value = klaim model bukan prediksi).
- **Total source dashboard: 35.281 byte ≤ 64 KiB** (index.html 448 + app.css 8.554 + app.js 26.279).
  `data.js` 77.911 byte — ditulis di samping `dashboard/`, tidak masuk teks dossier
  (sesuai starter; ANALYSIS.md §8.3 mencatat status cap-nya belum terbukti).
- **Nol `http(s)://`** di source dashboard (dicek grep otomatis). Satu-satunya URL yang muncul
  adalah string `source` snapshot di `data.js` (data, bukan fetch/import/link) — dikecualikan
  secara eksplisit di script validasi.

## 6. Hasil validasi lokal (semua dijalankan, 19 Nov 2026)

Perintah (dari root repo, snapshot di kit):

```
MAKEFUN_OUTPUT_DIR=output-a node main.ts --input <kit>/input/snapshot.json
MAKEFUN_OUTPUT_DIR=output-b node main.ts --input <kit>/input/snapshot.json
diff -r output-a output-b
node scripts/validate.mjs output-a <kit>/input/snapshot.json
node scripts/regen-check.ts output-a
node scripts/smoke-dom.mjs output-a
node scripts/smoke-dom.mjs output-a '#p=steakhouse-financial'
node scripts/smoke-dom.mjs output-a '#p=usdd'
node scripts/smoke-dom.mjs output-a '#category=RWA'
```

| Cek | Hasil |
|---|---|
| `main.ts` 2 run | **LOLOS** — keduanya exit 0, 200 baris (160 early, 24 live) |
| Determinisme `diff -r output-a output-b` | **LOLOS** — byte-identik seluruh output (board.json, data.js, dashboard/, screenshots/, dossier.json) |
| `scripts/validate.mjs` (30 cek) | **LOLOS SEMUA** — 200 baris; 40/40 watchlist; 160 di luar watchlist; rank 1..200 unik; implied menurun, 200 nilai berbeda; farm_steps 6/baris, 20–600 karakter; tanpa janji APY/airdrop; tanpa slug hardcoded; dashboard 35.281 byte; 0 URL; screenshot 3 file ≤ 512 KiB; dossier 710.806 byte ≤ 1,5 MiB; teks dossier 35.545 byte ≤ 65.536 |
| `scripts/regen-check.ts` | **LOLOS** — dossier.json byte-identik dengan rebuild `buildDossier()`; farmSteps `app.js` == `board.json` untuk 200/200 baris |
| `scripts/smoke-dom.mjs` (4 skenario) | **LOLOS SEMUA** — tabel render 200 baris; tabel multiple 15 baris (14 kategori + global); detail steakhouse (fallback) menampilkan "0.2138 (n=128) — global fallback"; detail usdd menampilkan "0.1687 (n=3) — CDP median"; filter `#category=RWA` menampilkan 15 baris |
| `node --check dashboard/app.js` | **LOLOS** (sintaks OK) |
| Vendor byte-identik | **LOLOS** — sha256 `9ca51b6e…` = `kit.json` |
| board.json | 283.748 byte ≤ 8 MiB |

Catatan cek dossier: `buildDossier()` mengembalikan **Uint8Array (byte)**, bukan string —
perbandingan awal yang membandingkan string sempat tampak berbeda 4 byte; setelah
dibandingkan sebagai byte, hasilnya identik (juga dibuktikan `cmp` file).

## 7. Screenshot & dossier — PROVISIONAL

- `screenshots/` di repo saat ini **KOSONG** (hanya `.gitkeep`). Screenshot contoh starter
  **tidak** dipakai sebagai final.
- Validasi di atas memakai screenshot starter sebagai **placeholder sementara** supaya
  `main.ts` dan `buildDossier` bisa jalan end-to-end; placeholder sudah dihapus dari repo.
- `output/` berisi artefak run validasi itu: 3 screenshot placeholder + `dossier.json`
  yang dibuat darinya (710.806 byte). **Dossier ini PROVISIONAL dan wajib dibuat ulang**
  setelah 3 screenshot final masuk (`node main.ts` ulang → dossier baru).
- Perilaku `main.ts` dengan screenshot kosong sudah diuji: exit 1 dengan pesan
  "screenshots/ holds 0 images", tapi `board.json` (200 baris), `data.js`, dan
  `dashboard/` tetap tertulis; `dossier.json` tidak tertulis.

## 8. Yang belum selesai

1. **3 screenshot final** (board, detail view, filtered view) — ≤ 512 KiB tiap file,
   sisi panjang ≤ 1440 px, sisi pendek ≥ 800 px, target 300–350 KiB (teknisi lain).
2. **Regenerasi dossier.json** setelah screenshot final ada: jalankan ulang `main.ts`
   ke `output/`, lalu `node scripts/validate.mjs output …` + `node scripts/regen-check.ts output`.
3. **`makefun check` resmi** dari direktori kit (butuh repo + `transcripts.tar.gz`) — belum
   bisa dijalankan (belum ada bundle transkrip).
4. Submit / repo GitHub — di luar tugas ini (akses GitHub user belum diberikan).
