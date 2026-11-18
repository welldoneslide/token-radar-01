# token-radar-01 — Analysis & Design (riset + desain, bukan build)

> Status: analisis kit + snapshot selesai 19 Nov 2026. **JANGAN submit, JANGAN buat repo GitHub, JANGAN sentuh/baca keypair.** Dokumen ini adalah masukan untuk tahap build. Semua angka di bawah dihitung dari `input/snapshot.json` di kit (sha256 `42a71213…`); tidak ada angka luar yang dikarang.
>
> Kit: `~/workspace/makefun/token-radar-01-kit/token-radar-01-kit/`
> Repo kerja: `~/workspace/makefun/token-radar-01/` (commit awal `5bb4f30`)

---

## 1. Ringkasan kompetisi (dari `competition.yaml` + `RULES.txt`)

- **Bounty:** `token-radar-01` — "Build the best token launch radar". Hadiah total **$1.325** (juara 1 **$1.000**, peringkat 2–5 @ $50, 6–10 @ $25), dibayar USDC di Solana dari escrow yang sudah terdanai saat bounty dibuka.
- **Buka:** 2026-11-14T10:00:00Z · **Deadline:** **2026-12-14T10:00:00Z** (10:00 UTC = 17:00 WIB). Final dimulai 10 menit setelah deadline, maks ~12 jam + review finalis maks 60 menit.
- **Penilaian:** bukan skor numerik absolut — **AI judge (superbot, reasoning effort high)** membandingkan dua dossier sekaligus, memilih yang lebih baik dengan margin 1–5. Peringkat = win rate (fit Bradley-Terry). Setiap game = 2 panggilan (urutan A/B dibalik). Final: screening di peringkat 40 → 3 ronde Swiss → race di batas hadiah → playoff 12 besar → 3 game tambahan antara 2 teratas. Tie-break: head-to-head playoff → `dossier.json` lebih kecil → receipt lebih awal.
- **Peserta:** 17.944 pendaftar tercatat (per riset 19 Nov 2026); 10 tempat berbayar.
- **Deliverable:** repo GitHub publik (atau source bundle) + `main.ts` (Node 22, stdlib saja) di root, `vendor/makefun-board.ts` dari kit, `dashboard/` statis tanpa network, `board.json`, 3 screenshot, `dossier.json`, dan **transkrip sesi agent** yang membangunnya.
- **Runtime grading:** program jalan 2× di container segar tanpa network (1 CPU, 1024 MB, 120 detik/run), **kedua run harus menulis byte yang identik** (deterministik — tidak boleh ada `Date.now()`/random/order tak stabil dalam output).

### Perintah check yang didokumentasikan

Tidak ada **local grade** untuk bounty ini — scorer dan reference data tinggal di server; server yang menilai setiap entry. Yang ada adalah pre-submit check di situs (dijalankan dari direktori kit):

```bash
node cli/makefun.mjs check --kit . --repo <your repository> --transcripts transcripts.tar.gz
```

Check ini memeriksa: LICENSE, entrypoint (`main.ts`), size cap snapshot, dan transcript gate dengan "now" sebagai receipt time. Hal yang hanya bisa dicek situs (repo publik, milik sendiri, dibuat setelah opening, memegang commit, bukan salinan entry lain) tampil sebagai "checked at submission". Exit 1 bila ada yang gagal, lengkap dengan fix-nya.

Perintah lain yang didokumentasikan di `RULES.txt`: `submit` (GitHub `--repo-url … --commit …` atau source bundle `--source …`), `status`, `claim`, `verify-result`, `bundle`, `init`, `secrets`, `market`, `login`/`register`, `delegate`.

### Format `board.json` yang valid

- Objek JSON UTF-8 dengan kunci `rows` (bare array juga dibaca), **100–4.000 baris**, maks **8 MiB**, extra keys diizinkan.
- Setiap baris wajib: `slug` (1–128 karakter, tanpa whitespace, unik, harus ada di snapshot), `name` (string non-empty), `rank` (bilangan bulat positif), `implied_value_usd` (bilangan bulat positif, maks 100.000.000.000.000 = $100T), `farm_steps` (array **3–12 string, masing-masing 20–600 karakter** setelah trim).
- Rank harus tepat **1..N masing-masing sekali**, dan `implied_value_usd` **tidak boleh naik** seiring rank naik (rank 1 = nilai tertinggi). Board dengan ≥2 baris yang semua implied value-nya sama **ditolak** (bukan ranking).
- **Seluruh 40 slug watchlist wajib muncul** di board (`min_watchlist_coverage` = 1). Minimal 60 baris harus di luar watchlist (karena board ≥100 baris).

### Format `dossier.json` yang valid

- Ditulis oleh `buildDossier('/output', { text_max_bytes: 65536 })` dari `vendor/makefun-board.ts` — **scorer menjalankan file yang sama byte-for-byte dan membandingkan byte-for-byte**. Dossier harus sama persis dengan yang dihasilkan ulang dari `dashboard/` + `screenshots/`; kalau tidak, gate `dossier_matches` gagal.
- Skema `makefun/dossier/v1`: `{ schema, cover: 0, text, images: [{ name, media_type, sha256, base64 }] }`, canonical JSON (key terurut, tanpa whitespace). `cover` = screenshot pertama menurut nama.
- `text` = blok `## Dashboard` (jumlah file, total byte, tiap file + ukurannya) lalu `## Source` (tiap file teks: path, ukuran, jumlah baris, isi dalam fenced block, urut path). Maks **65.536 byte UTF-8**: file yang tidak muat dipotong di batas baris lengkap terakhir + baris "[N lines not shown]" + baris cut "[Cut at …]". File yang ekstensinya bukan `.html .css .js .json .mjs .svg .md .txt` hanya disebut namanya, isinya tidak ditampilkan.
- `buildDossier` menolak (DossierError): `screenshots/` kosong, nama screenshot tak valid, screenshot bukan PNG/JPEG utuh, screenshot lewat cap byte/jumlah, file dashboard bukan plain (symlink, dot-directory, nama tak valid), dossier > 4 MiB (di library) — **tapi gate menolak dossier > 1,5 MiB** (lihat §6, ada selisih yang harus diwaspadai).
- **Penting:** `buildDossier` hanya membaca `dir/dashboard/` dan `dir/screenshots/`. File `data.js` yang ditulis starter di `/output/data.js` (di samping `dashboard/`) **tidak masuk ke teks dossier** — juri tidak pernah membaca isinya. Jadi model/rumus harus terlihat di source dashboard (`app.js`), bukan hanya di `data.js`. Starter sudah melakukan ini: `app.js` punya `impliedOf()` yang menghitung ulang tiap baris dan membandingkannya dengan angka di board.

### Constraint dashboard

- `dashboard/` berisi `index.html` + minimal satu `.css` dan satu `.js` (di mana saja di bawahnya), maks **400 file dan 4 MiB total**, nama file hanya huruf/angka/`._-` (1–128 karakter, tidak diawali `.`/`-`), tanpa direktori diawali titik.
- **Tanpa network:** scorer menolak alamat `http://`/`https://` di nilai atribut HTML (termasuk `<a href>`), body `<style>`, import `<script>` inline, file CSS, atau import/require/dynamic-import JS. Teks terlihat dan komentar boleh membawa URL.
- **Jaga source dashboard ≤ 64 KiB total** (supaya teks dossier tidak terpotong; juri membaca source yang terpotong sebagian) dan **tiap screenshot 300–350 KiB** (tiga screenshot di cap 512 KiB akan melampaui dossier).
- Screenshot: **3–4 gambar** (nama diawali `.` dilewati), masing-masing **≤ 512 KiB**, PNG/JPEG utuh, **sisi panjang ≤ 1440 px, sisi pendek ≥ 800 px**. Yang diminta: (1) board, (2) detail view satu protokol, (3) filtered view.

### Cara scoring / juri (rubrik, urutan penting → kurang penting)

1. **Working radar:** board mencakup semua watchlist, memberi peringkat pre-token dengan implied value yang dinyatakan, screenshot dan kode saling cocok; layar tanpa data/kode = nol.
2. **Value model:** implied value mengikuti angka snapshot sendiri (TVL, pertumbuhan 7 hari, sudah berapa lama jalan tanpa token), **bukan dari hardcoded list nama**; board memisahkan protokol yang tokennya sudah diperdagangkan dari yang belum.
3. **Farm plans:** tiap plan memberi langkah konkret beserta biaya dan waktunya, bukan slogan.
4. **Dashboard sebagai page:** bisa di-sort dan di-filter, terbaca sekilas, ada detail view tiap protokol.
5. **Looks made:** palet yang dipilih, spacing konsisten, tipografi terbaca, bukan framework yang ditempel mentah.
- Juri memeriksa kriteria berurutan; kriteria pertama yang berbeda yang memutuskan, kecuali kriteria belakangan berbeda jauh lebih besar. Teks yang ditujukan ke juri (di screenshot/source) diizinkan dan dibaca sebagai bagian entry.
- Empat dashboard house (weak → strong) ikut dinilai di tiap heat sebagai patokan. **Dossier yang byte-identik dengan salah satunya ikut bermain sebagai dashboard itu: berbagi rate dan tidak pernah masuk playoff.** Starter yang diserahkan apa adanya = anchor 2-plain (sudah dikalibrasi: strength 0,593 vs r3 3,253).

### Diskualifikasi

- Mengakses network, probing/escape sandbox, menyerang grader/scorer.
- Transkrip yang difabrikasi, diedit, ditahan, atau dipinjam.
- Menyerahkan karya orang lain, berbagi entry antar peserta, lebih dari satu akun per orang.
- Membuat repo privat, menghapus license, atau rewrite history sehingga commit yang disubmit hilang sebelum verifikasi selesai.
- Mengeksploitasi bug gate scorer/grader (laporkan, jangan dipakai).
- Informasi palsu di payout details (nama legal, negara, form pajak).
- Tambahan dari transcript gate: entry tanpa transkrip yang lolos gate ditolak dan tidak dinilai (lihat §7).

---

## 2. Struktur snapshot (`input/snapshot.json`)

- `as_of`: **2026-11-14** · `source`: `DefiLlama https://api.llama.fi/protocols, fetched 2026-11-14T01:18:33.201Z` · `floor_usd`: **$50.000.000**.
- `protocols`: **758 protokol** (semua dengan TVL ≥ $5.000.000, terurut `slug` menaik, slug unik, nama unik). Tiap protokol tepat 10 field: `slug`, `name`, `category` (tidak pernah null di snapshot ini — 0 null), `chains` (array string, tidak ada yang kosong; maks 176 chain), `tvl_usd` (dolar utuh, dipotong), `change_7d` (persen, null bila tak dilaporkan), `mcap_usd` (null bila tak ada token/mcap), `listed_at` (`YYYY-MM-DD` atau null), `gecko_id`, `symbol` (keduanya null bila tak ada token; placeholder DefiLlama `-` ditulis null).
- `watchlist`: **40 slug** (terurut menaik). Total TVL snapshot **$465,70 miliar**; TVL watchlist **$12,93 miliar (2,8%)**; TVL pre-token **$135,80 miliar (29,2%)**.
- **Pre-token: 342** · **token-bearing: 416** (definisi "pre-token" starter: `mcap_usd`, `gecko_id`, dan `symbol` ketiganya null).
- Watchlist TVL: min **$51.272.081** (firelight) — tepat di atas floor $50jt — maks **$2.753.981.495** (steakhouse-financial).

### Aturan watchlist (terkonfirmasi bisa direproduksi sebagian)

Dari 758 protokol, **132** memenuhi "TVL ≥ floor DAN pre-token". Setelah pengecualian (kategori Bridge/Canonical Bridge/Liquid Staking/Liquid Restaking/Restaked BTC/CEX, nama berakhiran penanda versi, nama mengandung kata `wrapped`/`staked`/`staking`, diawali nama exchange, atau punya `parentProtocol`) tersisa **40**. Ke-40 slug watchlist semuanya ada di himpunan 132 itu. Yang **tidak** bisa diverifikasi dari snapshot: field `parentProtocol` (bukan salah satu dari 10 field) — daftar watchlist harus dibaca apa adanya dari file, bukan dihitung ulang.

**92 protokol pre-token ≥ floor TIDAK masuk watchlist**, mayoritas karena kategori yang dikecualikan (CEX seperti bybit, kucoin, gemini; Liquid Staking seperti binance-staked-eth; Bridge seperti base-bridge, linea-bridge; versi seperti aera-v3) plus beberapa yang lolos saringan nama/kategori tapi punya parent (mis. `ccip`, `ipor-fusion`, `mellow-core`, `loopscale-lending`, `polymarket-international`).

### Distribusi TVL per kategori (12 besar, dari 758)

| Kategori | n | TVL |
|---|---:|---:|
| CEX | 56 | $224,42 B |
| Bridge | 55 | $58,53 B |
| Lending | 75 | $46,41 B |
| Liquid Staking | 78 | $44,30 B |
| Staking Pool | 11 | $11,89 B |
| Dexs | 99 | $11,33 B |
| Canonical Bridge | 32 | $11,27 B |
| Risk Curators | 39 | $9,64 B |
| Onchain Capital Allocator | 29 | $8,62 B |
| Restaking | 6 | $7,90 B |
| Basis Trading | 21 | $7,66 B |
| CDP | 20 | $5,47 B |

### Komposisi watchlist per kategori (40)

Risk Curators **12**, RWA **7**, Onchain Capital Allocator **3**, Basis Trading 2, Lending 2, Chain 2, Yield 2, lalu masing-masing 1: Restaking, Dexs, CeDeFi, Insurance, Payments, Governance Incentives, Staking Pool, Stablecoin Wrapper, Collateral Markets, CDP. **Tidak ada** Dexs besar/Lending besar di watchlist — yang mendominasi justru kurator/vault dan RWA, yaitu kategori yang relatif baru di DefiLlama. Ini penting: multiple kategori (lihat §3) untuk kategori dominan watchlist justru yang paling sedikit pembandingnya.

### Data quirks yang harus ditangani kode (bukan diabaikan)

- **272 protokol punya `gecko_id`/`symbol` tapi `mcap_usd` null** (mis. semua varian aave-v1/v3/v4, aerodrome-*) — mereka mencatat token tapi tanpa market cap. Starter memperlakukan mereka sebagai live (bukan pre-token). Konsisten dengan definisi watchlist (token tercatat ⇔ gecko/symbol tidak null), tapi builder harus sadar: "token-bearing" ≠ "punya mcap".
- **16 protokol punya `mcap_usd` ≤ 0**, termasuk `autofinance` dengan mcap **-1** (data aneh dari sumber) — harus dikecualikan dari statistik rasio (syarat `mcap > 0`).
- **`change_7d`:** n=754, null=4 (`contango-v2`, `estate-protocol`, `kinetiq-elysium-bridge`, `swan-dao`); median **-8,23%** (minggu snapshot TVL pasar turun luas); min -72,71%; max **+4.448,47%** (`shift-defi`) — outlier ekstrem, jadi **clamping wajib**, bukan opsional. Di watchlist: min -28,53%, max +11,23%, median -3,29%, null 0.
- **`listed_at` null: 113 protokol** (15%), termasuk 2 di watchlist: `lightning-network` dan `noble` — butuh fallback umur (starter: 365 hari).
- Umur (listed → as_of): min 2 hari, max 1.851 hari, median 677 hari. Watchlist: min 45 hari (`nonce-capital`), max 1.563 hari (`lofty`), median 511,5 hari.
- Chain terbanyak: Ethereum 424, Arbitrum 188, Binance 178, Base 176, Solana 152. Urutan array `chains` tidak didokumentasikan sebagai bermakna — starter memakai `chains[0]` sebagai "main chain"; itu konvensi yang bisa dipertahankan, bukan fakta.
- **Semua 40 watchlist lolos saringan starter `isRankable`** (bukan CEX, bukan nama berversi).

---

## 3. Daftar 40 watchlist (terkonfirmasi, TVL menurun)

| # | slug | Nama | Kategori | TVL | 7d | Umur |
|---:|---|---|---|---:|---:|---:|
| 1 | steakhouse-financial | Steakhouse Financial | Risk Curators | $2.754,0 M | -2,19% | 543 h |
| 2 | gauntlet | Gauntlet | Risk Curators | $1.577,7 M | +5,65% | 543 h |
| 3 | veda | Veda | Onchain Capital Allocator | $1.563,4 M | -8,29% | 632 h |
| 4 | usdd | USDD | CDP | $1.055,8 M | -2,81% | 611 h |
| 5 | nonce-capital | Nonce Capital | Risk Curators | $513,8 M | -9,74% | 45 h |
| 6 | upshift | Upshift | Onchain Capital Allocator | $499,1 M | +8,31% | 710 h |
| 7 | bittensor-dtao | Bittensor dTAO | Dexs | $376,0 M | -6,56% | 56 h |
| 8 | onre | OnRe | RWA | $308,9 M | +0,11% | 488 h |
| 9 | rockawayx | RockawayX | Risk Curators | $292,5 M | -2,55% | 233 h |
| 10 | symbiotic | Symbiotic | Collateral Markets | $253,9 M | -12,03% | 886 h |
| 11 | opentrade | OpenTrade | RWA | $241,5 M | -1,64% | 708 h |
| 12 | hyperithm | Hyperithm | Risk Curators | $221,6 M | -4,38% | 543 h |
| 13 | lightning-network | Lightning Network | Payments | $217,9 M | -10,14% | tidak diketahui |
| 14 | plume-vaults | Plume Vaults | RWA | $211,5 M | -3,08% | 749 h |
| 15 | k3-capital | K3 Capital | Risk Curators | $207,7 M | -8,90% | 543 h |
| 16 | hive-protocol | Hive Protocol | Chain | $198,8 M | -10,18% | 925 h |
| 17 | r25 | R25 | RWA | $198,2 M | +0,30% | 199 h |
| 18 | b14g | b14g | Restaking | $173,9 M | -28,53% | 694 h |
| 19 | clearstar | Clearstar | Risk Curators | $161,8 M | -10,09% | 543 h |
| 20 | saturn | Saturn | Stablecoin Wrapper | $154,3 M | -0,75% | 219 h |
| 21 | lagoon | Lagoon | Onchain Capital Allocator | $151,3 M | -3,30% | 691 h |
| 22 | curvance | Curvance | Lending | $136,3 M | +0,68% | 352 h |
| 23 | galaxy-curation | Galaxy Curation | Risk Curators | $130,0 M | +11,23% | 177 h |
| 24 | tydro | Tydro | Lending | $111,3 M | -4,89% | 394 h |
| 25 | valos | Valos | RWA | $106,3 M | +0,15% | 113 h |
| 26 | armitage-by-wintermute | Armitage by Wintermute | Risk Curators | $103,5 M | +5,77% | 178 h |
| 27 | lofty | Lofty | RWA | $101,1 M | +0,03% | 1.563 h |
| 28 | doppler-finance | Doppler Finance | CeDeFi | $93,3 M | -14,49% | 638 h |
| 29 | ember | Ember | RWA | $90,0 M | -5,96% | 423 h |
| 30 | keyrock | Keyrock | Risk Curators | $83,1 M | -0,60% | 73 h |
| 31 | noble | Noble | Chain | $83,0 M | -5,23% | tidak diketahui |
| 32 | tori-finance | Tori Finance | Basis Trading | $77,4 M | +4,64% | 143 h |
| 33 | infinifi | infiniFi | Yield | $70,7 M | -3,28% | 535 h |
| 34 | axis | Axis | Basis Trading | $70,1 M | +2,33% | 86 h |
| 35 | reti-pooling | Reti Pooling | Staking Pool | $65,3 M | -10,69% | 659 h |
| 36 | gami-labs | Gami Labs | Risk Curators | $63,1 M | +9,03% | 169 h |
| 37 | yuzu-money | Yuzu Money | Yield | $57,3 M | -9,05% | 365 h |
| 38 | mezo-earn | Mezo Earn | Governance Incentives | $53,6 M | -12,22% | 186 h |
| 39 | tulipa-capital | Tulipa Capital | Risk Curators | $52,4 M | -9,35% | 543 h |
| 40 | firelight | Firelight | Insurance | $51,3 M | -14,41% | 340 h |

Pernyataan yang benar di dashboard: protokol-protokol ini "**mencatat tidak ada token**" (no token recorded) — bukan "tidak punya token". DefiLlama bisa saja tidak mencatat token yang sebenarnya ada.

---

## 4. Pembanding valuasi: protokol bertoken sejenis

Metode yang diusulkan memakai **rasio market-cap / TVL** dari protokol bertoken sebagai bukti pasar dari snapshot sendiri. Himpunan pembanding: protokol dengan `mcap_usd > 0` dan `tvl_usd > 0` (dan `gecko_id` tercatat): **n = 129** dari 416 token-bearing.

**Rasio global: median 0,205; mean 5,000; p25 0,044; p75 1,043.** Mean tidak bisa dipakai — didorong outlier ekstrem (Prediction Market 400,2; Token Locker 18,98; CEX 69,42). **Median adalah statistik yang benar** di sini; sebutkan alasannya di dashboard.

### Median mcap/TVL per kategori (hanya kategori dengan n ≥ 3)

| Kategori | n | Median | Mean | Min–Max |
|---|---:|---:|---:|---:|
| Dexs | 11 | **0,342** | 1,075 | 0,022–3,182 |
| Lending | 15 | **0,132** | 1,835 | 0,008–18,956 |
| Yield | 10 | **0,180** | 0,390 | ~0–1,057 |
| Liquid Staking | 9 | **0,041** | 0,266 | 0,004–1,655 |
| CEX | 9 | **0,075** | 7,825 | 0,006–69,422 |
| RWA | 9 | **0,275** | 0,381 | 0,036–1,007 |
| Canonical Bridge | 8 | **0,746** | 2,436 | 0–14,547 |
| Basis Trading | 7 | **0,654** | 5,642 | 0,044–36,170 |
| Bridge | 6 | **0,557** | 0,717 | 0,008–1,603 |
| Cross Chain Bridge | 4 | **1,220** | 1,564 | 0,195–3,620 |
| Yield Aggregator | 4 | **0,151** | 0,203 | 0,031–0,479 |
| Indexes | 3 | **0,148** | 0,755 | 0,051–2,065 |
| CDP | 3 | **0,169** | 0,141 | 0,008–0,246 |
| Privacy | 3 | **0,969** | 0,879 | 0,034–1,635 |

### Kategori watchlist dengan pembanding sedikit / tidak ada (masalah nyata)

| Kategori watchlist | n pembanding | Median | Keputusan metode |
|---|---|---:|---:|---|
| Risk Curators (12 dari 40!) | 1 | 2,975 | **JANGAN pakai** — fallback global |
| Onchain Capital Allocator | 2 | 0,012 | **JANGAN pakai** — fallback global |
| Chain | 1 | 3,026 | **JANGAN pakai** — fallback global |
| Collateral Markets | 0 | — | fallback global |
| CeDeFi | 0 | — | fallback global |
| Governance Incentives | 0 | — | fallback global |
| Insurance | 0 | — | fallback global |
| Stablecoin Wrapper | 0 | — | fallback global |
| Restaking | 2 | 0,025 | **JANGAN pakai** — fallback global |
| Staking Pool | 2 | 0,002 | **JANGAN pakai** — fallback global |
| Payments | 2 | 0,181 | **JANGAN pakai** — fallback global |

Bukti kenapa ambang n ≥ 3 itu penting (dihitung, bukan asumsi):

- Memakai mentah median Risk Curators (n=1, 2,975) → Steakhouse Financial implied **$6,47 miliar** (vs $445,6 jt dengan fallback) — satu observasi mendikte peringkat 1.
- Memakai mentah median Onchain Capital Allocator (n=2, 0,012) → Veda implied **$15,5 jt** (vs $255,1 jt) — dua observasi kecil menghukum peringkat 3 menjadi papan bawah.
- Alternatif yang masih defensible: **pooling keluarga kategori**. Keluarga kurator (Risk Curators + Onchain Capital Allocator + Yield Aggregator + Yield, n=17) mediannya **0,169** → Veda $210,5 jt (vs $255,1 jt dengan fallback global — selisih kecil, peringkat tidak berubah). Keluarga staking (n=15) median 0,032; keluarga bridge (n=18) median 0,678. Pooling boleh dipakai sebagai penyempurnaan, tapi menambah kompleksitas penjelasan di depan juri; **rekomendasi default: fallback global saja** (lebih sederhana, lebih mudah dipertahankan).

---

## 5. Metode implied value yang diusulkan — "radar-2" (pengganti starter `radar-1`)

Starter memakai multiple datar **0,25** untuk semua kategori. Itu dekat dengan median global (0,205) dan bukan model yang buruk — tapi juri kriteria 2 menghargai model yang membedakan kategori berdasarkan bukti pasar. Metode di bawah ini **murni turunan snapshot** (dihitung ulang tiap run dari `snapshot.json`, tanpa satu pun nama protokol yang di-hardcode dan tanpa angka luar).

### Rumus lengkap

```
multiple(kategori) = median(mcap_usd / tvl_usd) atas protokol bertoken
                     dengan kategori sama, mcap_usd > 0, tvl_usd > 0,
                     bila n >= 3; bila tidak, median global 0,2049 (n=129)

growth     = clamp(change_7d, -60, 120)      ; change_7d null -> 0
growthMult = 1 + (growth / 100) * 0,5

age        = as_of - listed_at (hari)         ; listed_at null -> 365
maturity   = 0,6 + min(age, 1095) / 1095 * 0,4   ; rentang 0,6 - 1,0

implied_value_usd = max(1, round(tvl_usd * multiple * growthMult * maturity))
```

- **Kenapa multiple kategori dari median:** ini satu-satunya bukti valuasi yang ada di snapshot — berapa pasar menghargai token protokol sejenis per dolar TVL. Median (bukan mean) karena distribusi sangat menceng (mean 5,0 vs median 0,205).
- **Kenapa ambang n ≥ 3 + fallback global:** satu-dua observasi bukan estimasi; fallback global 0,2049 adalah estimasi pasar keseluruhan yang paling jujur saat kategori tidak punya pembanding cukup.
- **Kenapa growth di-clamp [-60, +120] dan bobot 0,5:** `change_7d` punya outlier +4.448% (shift-defi) yang tanpa clamp akan mendominasi ranking; bobot 0,5 membuat pertumbuhan menggeser nilai maksimal ±~30–60%, tidak menenggelamkan TVL. Diwarisi dari starter (sudah terkalibrasi sebagai anchor 2-plain).
- **Kenapa maturity 0,6–1,0 dari umur:** juri kriteria 2 eksplisit menyebut "how long it has run with no token" sebagai input model. Protokol yang bertahan lama tanpa token (mis. lofty 1.563 hari, symbiotic 886 hari) mendapat premi moderat; protokol berumur 45 hari (nonce-capital) tidak dihukum berat (lantai 0,6). Cap 1.095 hari (3 tahun) mencegah umur ekstrem mendominasi.
- **Yang TIDAK dipakai (dan kenapa):** jumlah chain (tidak ada bukti di snapshot bahwa multi-chain ⇒ valuasi lebih tinggi — chain terbanyak justru agregator), nama protokol (dilarang rubrik: "not from a hardcoded list of names"), APY/fee/revenue/poin airdrop (tidak ada di snapshot — mengarangnya = fabrikasi).

### Contoh hitung (3 protokol watchlist, angka persis dari snapshot)

**1. steakhouse-financial (Risk Curators, peringkat 1)**

```
TVL     = $2.753.981.495 ; change_7d = -2,1935% ; age = 543 hari
multiple = 0,2049 (Risk Curators n=1 -> fallback global)
growthMult = 1 + (-2,1935/100)*0,5 = 0,9890
maturity   = 0,6 + 543/1095*0,4 = 0,7984
implied = 2.753.981.495 x 0,2049 x 0,9890 x 0,7984 = $445.574.284
(starter flat 0,25: $543.636.080)
```

**2. gauntlet (Risk Curators, peringkat 2)**

```
TVL     = $1.577.685.462 ; change_7d = +5,645% ; age = 543 hari
multiple = 0,2049 (fallback global)
growthMult = 1 + (5,645/100)*0,5 = 1,0282
maturity   = 0,7984
implied = 1.577.685.462 x 0,2049 x 1,0282 x 0,7984 = $265.373.236
(starter flat 0,25: $323.776.463)
```

**3. symbiotic (Collateral Markets, peringkat 11)**

```
TVL     = $253.923.299 ; change_7d = -12,0318% ; age = 886 hari
multiple = 0,2049 (Collateral Markets n=0 -> fallback global)
growthMult = 1 + (-12,0318/100)*0,5 = 0,9398
maturity   = 0,6 + 886/1095*0,4 = 0,9237
implied = 253.923.299 x 0,2049 x 0,9398 x 0,9237 = $45.166.623
(starter flat 0,25: $55.106.874)
```

### Ranking 40 watchlist di bawah metode ini (implied $ jt)

1 steakhouse-financial 445,6 · 2 gauntlet 265,4 · 3 veda 255,1 · 4 usdd 144,6 · 5 upshift 91,5 · 6 bittensor-dtao 77,3 · 7 onre 66,1 · 8 nonce-capital 61,7 · 9 opentrade 56,5 · 10 plume-vaults 50,0 · 11 symbiotic 45,2 · 12 rockawayx 40,5 · 13 r25 36,7 · 14 hive-protocol 36,3 · 15 hyperithm 35,5 · 16 tori-finance 33,8 · 17 k3-capital 32,5 · 18 lightning-network 31,1 · 19 axis 29,3 · 20 lofty 27,8 · 21 b14g 26,1 · 22 lagoon 26,0 · 23 clearstar 25,1 · 24 saturn 21,4 · 25 valos 18,7 · 26 galaxy-curation 18,7 · 27 ember 18,1 · 28 doppler-finance 14,8 · 29 armitage-by-wintermute 14,5 · 30 curvance 13,2 · 31 noble 12,2 · 32 tydro 10,7 · 33 reti-pooling 10,6 · 34 keyrock 10,6 · 35 infinifi 10,0 · 36 gami-labs 8,9 · 37 tulipa-capital 8,2 · 38 yuzu-money 7,2 · 39 firelight 7,1 · 40 mezo-earn 6,9.

Semua 40 nilai berbeda (tidak ada tie). Vs starter: **31 dari 40 posisi berubah** — yang paling bergerak: bittensor-dtao naik (multiple Dexs 0,342), tori-finance/axis naik (Basis Trading 0,654), curvance/tydro turun (Lending 0,132). Papan atas (1–5) tidak berubah urutannya — TVL masih dominan, sesuai intuisi "implied value" sebagai klaim nilai.

### Sensitivitas yang harus diakui di dashboard (kejujuran model)

- Multiple kategori adalah bukti **cross-sectional**, bukan kausal: tidak ada data fee/revenue/pengguna di snapshot, jadi TVL adalah satu-satunya proksi ukuran — sebutkan itu.
- Fallback global dipakai untuk **24 dari 40** baris watchlist (kategori tanpa pembanding cukup) — dashboard harus menampilkan multiple yang dipakai tiap baris + n pembandingnya, supaya juri melihat kejujurannya, bukan menyembunyikannya.
- Implied value adalah **klaim model, bukan prediksi** peluncuran token, bukan harga, bukan janji airdrop. Tulis itu di halaman.

---

## 6. Rencana board 100+ baris

### Opsi default (direkomendasikan): 200 baris — bentuk starter

- **40 watchlist** (wajib) + **160 early**: pre-token di bawah floor, diurutkan TVL menurun (starter `EARLY_ROWS = 160`). Total pre-token di bawah floor = 210, jadi 160 teratas TVL $49,6 jt → ~$7 jt.
- Kelebihan: sama dengan bentuk yang sudah lolos gate sebagai anchor; `board.json` kecil; dashboard cepat; screenshot dan teks dossier muat.
- Catatan: 23 baris early mengalahkan implied value watchlist terbawah ($6,9 jt) di bawah metode ini — jadi early rows bukan sekadar pengisi; 10 early teratas: ink-bridge $22,6 jt, pulsechain-bridge $22,0 jt, polygon-zkevm-bridge $21,4 jt, txflow-bridge $18,4 jt, aegis-yusd $18,3 jt, suibridge $16,9 jt, manta-cedefi $16,1 jt, liminal-basis $14,4 jt, scroll-bridge $14,1 jt, drakewell $11,6 jt. **Perhatian:** 6 dari 10 teratas itu bridge — konsekuensi multiple bridge yang tinggi (0,557–1,220). Builder harus memutuskan: biarkan model berbicara (defensible, tapi papan early didominasi bridge), atau beri label jujur di baris bridge ("bridge — farming = memakai jembatan; bukan klaim token"). Jangan pernah mengecualikan bridge secara diam-diam tanpa alasan yang dinyatakan — itu terlihat seperti hardcoding.

### Opsi stretch: 289 baris — semua pre-token yang rankable

- Semua pre-token kecuali CEX (42 protokol — exchange terpusat tidak punya "token launch" yang relevan untuk radar ini) dan nama berversi (11 protokol — pool dari protokol lain). Total rankable = **289** (TVL $65,45 miliar).
- Kelebihan: cakupan maksimal untuk kriteria juri 1 ("board covers every protocol on the watchlist… a board may carry protocols below it"). Kekurangan: `board.json` lebih besar (tetap jauh di bawah 8 MiB), 289 farm plan harus tetap konkret dan tidak repetitif, dan dashboard harus tetap terbaca. Putuskan setelah 200-baris jalan dan lolos check lokal.

### Yang tidak boleh masuk board

- Protokol bertoken (416) — mereka masuk **Live view terpisah** (starter: 24 teratas by mcap), dengan market cap sebagai fakta pasar, bukan implied value. Jangan pernah mencampur implied value dan mcap dalam satu ranking.
- CEX pre-token (bybit, kucoin, dsb.) — bukan subjek "token launch" yang masuk akal untuk radar ini; starter sudah mengecualikannya di `isRankable`.
- Nama berversi (aera-v2, aera-v3, dsb.) — pool dari protokol lain, sesuai aturan watchlist.

### Farm plan per baris (rencana, tanpa klaim APY/reward)

- **6 langkah per baris**, tiap langkah 20–600 karakter, selalu memuat **biaya dan waktu** (format starter: `… Cost: …. Time: ….`). Struktur: (1) dompet baru + seed offline; (2) aksi utama sesuai kategori (lihat tabel); (3) satu aksi kualifikasi tiap minggu; (4) hold N hari (60 hari bila umur <180 hari, 45 hari bila <365 hari, 30 hari bila lebih tua/tidak diketahui); (5) cek halaman points/rewards resmi, klaim hanya dari link yang diterbitkan protokol, jangan pernah membayar untuk klaim; (6) catat di farm log.
- **Modal kerja** dari TVL (starter `capitalFor`): TVL ≥$5B → $250; ≥$1B → $150; ≥$100 jt → $100; di bawah itu $50. Gas disebut sebagai kisaran kasar ($2–8), bukan angka pasti — snapshot tidak berisi data gas.
- **Aksi utama per kategori** (starter sudah mencakup: Lending/CDP, Dexs/Yield/Leveraged Farming, Bridge, Staking/Restaking, Perpetual/Derivatives, Prediction, Curator/Allocator, Stablecoin, RWA, Insurance + default "deposit USDC"). **Yang harus ditambahkan untuk watchlist** (starter jatuh ke default generik yang lemah di sini — 12 Risk Curators + kategori lain):
  - **Risk Curators** (12 baris!): "Deposit $X ke vault yang dikurasi {name} di {chain} dan pegang share-nya." (bukan "deposit USDC" generik — kurator adalah bisnis vault.)
  - **Onchain Capital Allocator** (veda, upshift, lagoon): "Deposit $X ke vault alokasi {name} di {chain}."
  - **Basis Trading** (tori-finance, axis): "Deposit $X ke vault basis-trading {name} di {chain} dan pegang posisinya."
  - **Chain** (hive-protocol, noble): "Bridge $X ke {chain} dan pakai aplikasi native di chain itu (swap/deposit) agar tercatat aktivitas on-chain-nya."
  - **Payments** (lightning-network): "Buka channel Lightning dengan $X dan lakukan beberapa pembayaran kecil lewat channel itu."
  - **Governance Incentives** (mezo-earn): "Kunci/stake $X untuk insentif governance {name} dan ikuti voting yang ada."
  - **Collateral Markets** (symbiotic): "Deposit $X sebagai collateral lewat {name} di {chain} dan pegang receipt-nya."
  - **CeDeFi** (doppler-finance): "Deposit $X ke vault CeDeFi {name} di {chain}."
  - **Stablecoin Wrapper** (saturn): "Wrap/mint stable asset senilai $X lewat {name} di {chain}."
  - **Restaking** (b14g): "Restake $X aset BTC lewat {name} dan pegang receipt-nya."
  - **Staking Pool** (reti-pooling): "Stake $X ke pool {name} di {chain}."
  - **Insurance** (firelight) dan **CDP** (usdd) sudah dicakup starter; **RWA** sudah dicakup.
- **Larangan keras di farm plan:** jangan menulis APY, reward, poin, atau "airdrop confirmed" — tidak satu pun ada di snapshot. Jangan menulis nama exchange/wallet spesifik di luar yang ada di data. Jangan menulis "dijamin". Setiap langkah harus bisa dihasilkan dari field snapshot (kategori, chain, TVL, umur) — tanpa lookup nama.

### Dashboard (di atas starter)

- Pertahankan arsitektur starter (index.html + app.css + app.js + data.js; tanpa network; hash-state untuk search/filter/detail) — starter = anchor 2-plain, jadi perubahan harus **menambah**, bukan merombak: (a) rumus baru + tabel multiple per kategori yang terlihat di halaman model; (b) kolom "Multiple (n)" per baris detail; (c) aksi farm per kategori baru di atas; (d) Live view tetap terpisah; (e) palet/spacing yang dipilih (kriteria 5) — starter sudah punya fondasi visual yang rapi, jangan ganti framework.
- **Anggaran byte (kritis):** total source dashboard ≤ 64 KiB agar teks dossier tidak terpotong; tiap screenshot 300–350 KiB (JPEG kualitas sedang, 1440×800); dossier total ≤ 1,5 MiB (gate) — targetkan ≤ 1,2 MiB untuk margin.
- Determinisme: `main.ts` harus menulis byte identik di dua run — urutan sort stabil (tie-break slug), tanpa timestamp di output (kecuali `as_of` dari snapshot), tanpa random.

---

## 7. Checklist validasi (untuk tahap build)

### Check lokal (sebelum `check` situs — bisa jalan tanpa server)

- [ ] `node main.ts` jalan dengan `MAKEFUN_OUTPUT_DIR=out node main.ts --input <kit>/input/snapshot.json` (Node ≥ 22.18).
- [ ] Jalankan **2×** ke direktori berbeda, `diff -r` — harus identik byte-for-byte.
- [ ] `board.json`: 100–4.000 baris (target 200 atau 289), ≤ 8 MiB; semua slug ada di snapshot; rank 1..N unik; implied value menurun seiring rank; tidak semua sama; semua 40 watchlist ada.
- [ ] Tiap `farm_steps`: 3–12 string, tiap string 20–600 karakter setelah trim.
- [ ] `dashboard/`: ada index.html + ≥1 .css + ≥1 .js; ≤ 400 file, ≤ 4 MiB; nama file valid; **grep `https?://` di atribut HTML, `<style>`, CSS, dan import JS** — harus nol (kecuali teks/komentar).
- [ ] Total source dashboard ≤ 65.536 byte (target ≤ 64 KiB).
- [ ] `screenshots/`: 3 file, masing-masing ≤ 512 KiB (target 300–350 KiB), PNG/JPEG utuh, sisi panjang ≤ 1440, sisi pendek ≥ 800.
- [ ] `dossier.json` = `buildDossier(out, {text_max_bytes: 65536, …})` yang ditulis ulang dari output yang sama — bandingkan byte; total ≤ 1,5 MiB (target ≤ 1,2 MiB).
- [ ] Dashboard dibuka di browser lokal tanpa network (matikan network / buka via `file://`): board render, filter/search/sort jalan, detail view tiap baris menampilkan rumus + farm plan yang sama dengan `board.json`.
- [ ] Tidak ada nama protokol yang di-hardcode di `lib/model.ts` (cek: satu fungsi skor untuk semua baris; multiple dihitung dari data, bukan tabel nama).
- [ ] `vendor/makefun-board.ts` **byte-identik** dengan kit (jangan edit; `sha256sum` cocokkan dengan `kit.json`).

### Check situs (butuh repo + transkrip)

- [ ] `node cli/makefun.mjs check --kit . --repo <repo> --transcripts transcripts.tar.gz` (dari direktori kit) — harus exit 0.
- [ ] Repo: dibuat **setelah** 2026-11-14T10:00:00Z, publik, ber-LICENSE OSI (MIT), `main.ts` di root, `.makefun/owner.json` bila owner GitHub ≠ login GitHub akun (atau repo di bawah akun GitHub yang login). README membawa 3 badge make.fun (lihat RULES.txt "Enter" langkah 4) + GitHub About (website make.fun + topik `makefun`).
- [ ] Transkrip: bundle dari sesi yang membangun entry; lihat §8 — ini gerbang yang paling sering menggagalkan.

### Transcript gate — ringkasan ambang (RULES.txt, "The transcript gate")

- ≥1 sesi ter-parse; tiap sesi log harness terekam atau file ekspor dari rekamannya.
- `thinking_reproduces` ≥ **30%** baris yang dihitung (authored/pasted), dan `main.ts` punya ≥1 baris authored.
- `thinking_turns` ≥ **5** assistant turn berisi teks/thinking.
- `thinking_revised`: suatu file (entrypoint atau kode yang dijalaninya) konten akhirnya berasal dari ≥2 pesan assistant yang menulis/mengeditnya.
- `thinking_in_window`: semua timestamp transkrip di antara pembukaan kompetisi dan receipt (±60 dtk skew). **Sesi yang dimulai sebelum 2026-11-14T10:00:00Z tidak bisa dientry.**
- `thinking_priced`: sesi self-reported membawa usage provider di ≥50% pesan assistant; sesi Muse app butuh ≥1 usage row (`--muse-usage`).
- `thinking_fresh` (source bundle): tiap baris credited berasal dari sesi yang menampilkan baris anchor `makefun anchor <root sha> round <round>` dari `init` sebelum write pertama.
- **Peringatan keras:** sesi yang di-hand-over manual (`handed_over`) membuat entry **diranking tapi tidak mengambil tempat berbayar** (`handed_over_places: none`). Karena sesi build ini berjalan di Muse app, pastikan bundle menemukan session file Muse (`~/agents/<agent>/sessions/<id>.jsonl`) + usage rows, atau build di harness yang sesinya terekam (mis. superbot.gg — disebut di rules). **Jangan** menulis/merekonstruksi sesi dari memori.
- Transkrip juga harus mencakup parent chat bila run dimulai dari hand-off agent lain (aturan 17–18 Nov 2026: run record wajib; system prompt + instruction files wajib di-upload atau ditandai).

---

## 8. Hal yang masih belum jelas dari kit (butuh keputusan / verifikasi saat build)

1. **Selisih cap dossier:** library `makefun-board.ts` menolak dossier > **4 MiB** (`DOSSIER_MAX_BYTES`), tapi gate di RULES.txt/competition.yaml menolak dossier > **1,5 MiB**. Ikuti yang ketat (1,5 MiB) — tapi belum ada yang membuktikan angka mana yang benar-benar dipakai scorer server. Target ≤1,2 MiB memberi margin untuk keduanya.
2. **`reference/gate.json` tidak ada di kit** — scorer dan reference data tinggal di server. Semua angka gate di dokumen ini berasal dari narasi `competition.yaml`/RULES.txt, bukan dari file gate itu sendiri; tidak bisa dicek lokal selain lewat `makefun check`.
3. **Apakah `data.js` dihitung ke cap dashboard?** `buildDossier` hanya membaca `dashboard/` + `screenshots/`, jadi `data.js` di `/output` tidak masuk teks dossier dan (menurut teks gate) tidak masuk hitungan file dashboard. Tapi belum terbukti apakah scorer menghitung `/output/data.js` ke cap lain — amankan dengan menjaga `data.js` tetap kecil dan model tetap terlihat di `app.js`.
4. **Screenshot belum terverifikasi di VM ini** — Chromium headless gagal sebelumnya ("Hatch WebGL domain policy is required"); belum ada Chromium/Firefox lain yang teruji. Tiga screenshot wajib 1440×800-ish dan 300–350 KiB; ini blocker build yang sudah dicatat di riset bounty (perlu install Chromium vanilla/Playwright atau lewat browser parent).
5. **Akses GitHub user belum diberikan** (disetujui 19 Nov 2026 06:03 WIB, "pake github juga gapapa, nanti gw kasih aksesnya") — tanpa itu, rute entry yang tersedia adalah **source bundle** (`init` + `submit --source`), yang mewajibkan anchor `makefun anchor …` di transkrip sebelum write pertama. Build JANGAN dimulai sebelum rute entry diputuskan, karena `init` harus jalan di repo kosong sebelum file apa pun ditulis.
6. **Aturan snapshot-copy:** submission dengan file identik dengan submission akun lain yang lebih dulu akan ditolak — jadi starter yang tidak diubah (atau diubah nyaris tidak) berisiko ditolak bila akun lain sudah submit starter. Perubahan model + dashboard di dokumen ini adalah pembedanya.
7. **Status escrow vs signature:** hadiah bounty ini terkunci di escrow Solana (lihat RULES.txt "The escrow"), jadi tiap entry **wajib ditandatangani** wallet Solana yang terhubung ke akun (entry v1/v2). Keypair yang dipakai untuk submit harus yang terhubung ke akun @wildan-mustofa — jangan membuat keypair baru tanpa koordinasi.
8. **Kuota submit akun:** maks 5/hari, 10 total (akun ini sudah memakai 4 untuk tiny-chess-01; kuota per kompetisi terpisah atau per akun belum ditegaskan di kit — cek `status` sebelum submit).
9. **Definisi "pre-token" vs "live" untuk 272 protokol bergecko-tanpa-mcap:** starter memperlakukan mereka sebagai live. Itu konsisten dengan aturan watchlist, tapi juri bisa mempertanyakan kenapa mis. varian aave tidak diranking — jawaban yang sudah disiapkan: mereka mencatat token (gecko_id ada), jadi bukan subjek "token yang belum ada". Sebutkan ini di dashboard Live view.
10. **Tidak ada cara menguji skor juri secara lokal** — tidak ada local grade; satu-satunya umpan balik adalah dev grade server (12 game vs house dashboards, 24 judge calls) setelah submit. Artinya iterasi = submit → baca provisional rate → perbaiki → submit lagi, dengan kuota 10 submission total sebagai batas.
