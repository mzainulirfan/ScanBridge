# ScanBridge Mobile

## Deploy to Vercel

1. Set Vercel project root directory to `mobile`.
2. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Build command: `npm run build`
4. Output directory: `dist`

## Local run

```bash
npm install
npm run dev
```

## Perilaku kamera

Kamera scanner berhenti otomatis dalam tiga kondisi:

- Ponsel diletakkan mendatar dan tidak bergerak selama ±2,5 detik (misalnya disimpan di meja sehingga tampilan kamera menjadi gelap). Kamera menyala kembali otomatis saat ponsel diangkat.
- Tidak ada scan selama 10 detik. Ini tetap menjadi fallback, termasuk pada perangkat yang tidak mendukung sensor gerakan.
- Layar scanner ditinggalkan, modal dibuka, atau input manual dipilih.

Deteksi "ponsel diangkat" memakai sensor `devicemotion` dan membutuhkan:

- Konteks aman (HTTPS atau `localhost`).
- Izin sensor gerakan pada iOS 13+. Izin diminta saat pengguna pertama kali menyentuh layar scanner (atau saat menekan tombol "Pindai QR desktop"). Jika izin ditolak atau sensor tidak tersedia, kamera tetap berjalan dan hanya fallback idle 10 detik yang aktif.

Pengujian cepat di perangkat:

1. Hubungkan ponsel ke desktop hingga layar scanner terbuka.
2. Letakkan ponsel mendatar di meja tanpa menyentuhnya. Setelah ±2,5 detik kamera berhenti dan muncul pesan "Ponsel diam".
3. Angkat ponsel. Kamera menyala kembali tanpa menekan tombol.
