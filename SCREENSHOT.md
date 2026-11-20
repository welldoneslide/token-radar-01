# Screenshot — token-radar-01

Cara mengambil 3 screenshot PNG asli hasil render dashboard (board, detail view,
filtered view). Terverifikasi 19 Nov 2026 di VM Linux ini.

## Browser yang berhasil

- **Google Chrome for Testing 159.0.8154.6** (Playwright chromium r1255),
  di `~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`
- Driver: **Playwright 1.65.1** (`scripts/package.json`, `node_modules/` tidak di-commit)
- Node v24.22.1, npm 10.9.4
- Perintah screenshot: `scripts/screenshot.mjs` (Playwright, headless, viewport
  1280×800, `--no-sandbox --disable-dev-shm-usage --disable-gpu`)

## Instalasi (satu kali, sudah dilakukan di VM ini)

`npx playwright install chromium` **gagal** di VM ini: unduhan 199 MB dari
`storage.googleapis.com` selalu timeout setelah 30 detik
(`Error: Request to https://storage.googleapis.com/chrome-for-testing-public/159.0.8154.6/linux64/chrome-linux64.zip timed out after 30000ms`).
Solusinya — unduh manual dengan curl lalu letakkan di cache Playwright:

```sh
cd /tmp
curl -L --retry 3 -o chrome-linux64.zip \
  https://storage.googleapis.com/chrome-for-testing-public/159.0.8154.6/linux64/chrome-linux64.zip
mkdir -p ~/.cache/ms-playwright/chromium-1255
cd ~/.cache/ms-playwright/chromium-1255
unzip -q -o /tmp/chrome-linux64.zip   # -> chrome-linux64/chrome
```

Lalu di repo:

```sh
cd ~/workspace/makefun/token-radar-01/scripts
npm install   # playwright 1.65.1
```

Catatan:

- `/opt/meta-chromium/chrome` headless **gagal** dengan
  `Hatch WebGL domain policy is required for browser startup` — jangan dipakai.
- Semua shared library Chromium sudah ada di VM ini
  (`ldd chrome | grep "not found"` kosong) — tidak perlu `apt-get install`.
- Playwright headless default mencari `chromium_headless_shell-1255`; yang
  terinstal di sini hanya Chrome penuh, jadi `screenshot.mjs` selalu memakai
  `executablePath` eksplisit ke `chrome-linux64/chrome` (atau isi env
  `CHROME_PATH`). Tanpa itu launch gagal dengan `Executable doesn't exist at
  .../chromium_headless_shell-1255/...`.
- Jangan install Firefox/Chromium apt sebagai cadangan selama cara ini jalan
  (RAM VM sempit, ~600 MB available saat instalasi).

## Bukti render (proof)

`screenshot-proof.png` (1280×800, 124.654 byte, PNG, 6.148 warna unik,
45,6% piksel bukan background) — render asli dashboard starter, **bukan**
placeholder: header "40 watchlist protocols, ranked by implied value",
200 rows, baris pertama Steakhouse Financial $543.6M.

Dashboard butuh `data.js` (output build, tidak ada di kit). Untuk proof ini,
`data.js` dibuat dengan menjalankan program starter kit sendiri ke direktori
sementara (bukan ke repo):

```sh
mkdir -p /tmp/radar-test-out
cd ~/workspace/makefun/token-radar-01-kit/token-radar-01-kit/starter
MAKEFUN_OUTPUT_DIR=/tmp/radar-test-out node main.ts --input ../input/snapshot.json
# -> 758 protocols, 40 on the watchlist, 200 rows scored (160 early, 24 live)
```

Lalu:

```sh
cd ~/workspace/makefun/token-radar-01
CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome \
  node scripts/screenshot.mjs \
  "file:///tmp/radar-test-out/dashboard/index.html" screenshot-proof.png
```

Verifikasi gambar bukan halaman kosong (dijalankan saat proof dibuat):

```sh
file screenshot-proof.png   # PNG image data, 1280 x 800
python3 -c "from PIL import Image; im = Image.open('screenshot-proof.png'); print(im.size, len(im.convert('RGB').getcolors(maxcolors=10000000)))"
```

## 3 screenshot final (setelah dashboard final di-build ke `<out>/`)

Ganti `<out>` dengan direktori output build (berisi `dashboard/` + `data.js`).
Dashboard membaca state dari hash URL: `#p=<slug>` membuka detail drawer,
`#q=<teks>` mencari, `#category=<nama>` memfilter kategori. Argumen ke-5
`screenshot.mjs` adalah selector CSS yang digulir ke atas viewport sebelum
foto diambil — dipakai untuk tampilan detail dan filter, karena board-nya
berada di bawah KPI strip dan tabel bukti, jadi tanpa scroll fotonya hanya
menunjukkan bagian atas halaman yang sama untuk ketiga tampilan. Ketiga
perintah di bawah sudah diuji dan menghasilkan render asli (detail drawer
USDD dan filter kategori Risk Curators terverifikasi 20 Nov 2026, radar-4):

```sh
cd ~/workspace/makefun/token-radar-01
export CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome
OUT=file:///path/ke/<out>/dashboard/index.html

node scripts/screenshot.mjs "$OUT"                       screenshots/1-board.png
node scripts/screenshot.mjs "$OUT#p=usdd"                screenshots/2-detail.png 1280 800 .controls
node scripts/screenshot.mjs "$OUT#category=Risk%20Curators" screenshots/3-filtered.png 1280 800 .controls
```

Contoh dengan output starter (slug & kategori nyata dari data):

```sh
OUT=file:///tmp/radar-test-out/dashboard/index.html
node scripts/screenshot.mjs "$OUT"                                  /tmp/1-board.png
node scripts/screenshot.mjs "$OUT#p=steakhouse-financial"           /tmp/2-detail.png 1280 800 .controls
node scripts/screenshot.mjs "$OUT#category=Risk%20Curators"         /tmp/3-filtered.png 1280 800 .controls
```

Batas kit (RULES/main.ts): maks 4 screenshot, masing-masing ≤ 524.288 byte.
`screenshot-proof.png` 124 KB — aman. Cek ukuran sebelum submit:

```sh
ls -la screenshots/ && file screenshots/*.png
```

## Kalau browser rusak / tidak jalan lagi

1. Cek biner masih ada: `ls ~/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome`
   dan `.../chrome --version`.
2. Ulangi blok curl + unzip di atas (revisi Playwright 1.65.1 = r1255; kalau
   `scripts/package.json` di-upgrade, sesuaikan nomor revisi dan URL
   `chrome-for-testing-public/<versi>/linux64/chrome-linux64.zip`).
3. Kalau instalasi browser tidak mungkin di VM ini, alternatif terakhir:
   ambil screenshot lewat browser parent agent (Muse utama) — jangan membuat
   placeholder atau menyalin `starter/screenshots/*.png` sebagai screenshot
   final.
