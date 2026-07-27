# Product Requirements Document

# ScanBridge

**Tagline:** Turn Your Smartphone into a Barcode Scanner.  
**Version:** 1.0  
**Status:** Draft  
**Tanggal:** 2026-07-27  
**Bahasa:** Indonesia  

---

## 1. Executive Summary

ScanBridge adalah aplikasi yang mengubah smartphone menjadi barcode scanner untuk desktop Windows. User cukup membuka aplikasi PWA di HP, melakukan pairing ke Desktop Helper melalui QR Code, lalu setiap barcode yang discan akan langsung diketik ke aplikasi desktop yang sedang aktif seperti Notepad, Excel, Shopee Seller Center, Tokopedia Seller, SAP, POS, ERP, atau browser.

Produk ini menggantikan kebutuhan barcode scanner USB dengan memanfaatkan kamera smartphone dan Desktop Helper ringan berbasis Tauri. Komunikasi realtime dilakukan melalui Supabase Realtime Broadcast. Tidak ada backend custom, tidak ada NodeJS server, tidak ada Express, dan tidak ada business logic di server.

| Area | Keputusan |
| --- | --- |
| Mobile | React, Vite, TypeScript, PWA, ZXing |
| Desktop | Tauri, Rust, Tokio, Enigo, Serde |
| Realtime Relay | Supabase Realtime Broadcast |
| Auth | Supabase Anonymous Authentication |
| Frontend Hosting | Vercel |
| Desktop Distribution | Tauri Installer |

Contoh penggunaan:

1. Desktop menampilkan QR session.
2. HP scan QR dan membuka `https://scanbridge.app/connect?session=<uuid>`.
3. HP scan barcode `JP123456789ID`.
4. Desktop menerima event scan dari Supabase.
5. Desktop mengetik `JP123456789ID` ke aplikasi yang sedang aktif.

---

## 2. Background

Barcode scanner USB banyak digunakan oleh seller marketplace, gudang, retail, UMKM, dan kantor. Namun perangkat ini memiliki biaya tambahan, perlu dibawa, bisa rusak, membutuhkan port USB atau Bluetooth, dan tidak selalu tersedia ketika dibutuhkan.

Sebaliknya, hampir semua user sudah memiliki smartphone dengan kamera yang mampu membaca barcode dengan akurat. ScanBridge memanfaatkan perangkat yang sudah dimiliki user untuk menyelesaikan masalah input barcode di desktop.

Contoh kondisi lapangan:

| Situasi | Masalah | Dampak |
| --- | --- | --- |
| Seller marketplace input resi | Mengetik nomor resi manual | Lambat dan rawan salah |
| Gudang scan SKU | Scanner fisik terbatas | Antrian perangkat |
| UMKM mengelola stok | Tidak ingin membeli alat tambahan | Proses tetap manual |
| Staff office input kode dokumen | Data ada di label fisik | Perlu copy manual |

---

## 3. Problem Statement

User membutuhkan cara cepat dan murah untuk memasukkan barcode ke aplikasi desktop tanpa membeli scanner USB.

Masalah utama:

| Masalah | Penjelasan |
| --- | --- |
| Biaya perangkat | Scanner USB atau Bluetooth menambah biaya operasional |
| Mobilitas rendah | Scanner fisik perlu dibawa, disimpan, dan dirawat |
| Input manual rawan salah | Barcode panjang mudah typo |
| Integrasi aplikasi sulit | Banyak aplikasi desktop atau web tidak menyediakan API |
| Setup teknis kompleks | User non-teknis membutuhkan solusi sederhana |

Pernyataan masalah:

> Bagaimana memungkinkan user men-scan barcode menggunakan smartphone dan memasukkan hasilnya ke aplikasi desktop apa pun seolah-olah diketik oleh keyboard?

---

## 4. Goals

| Goal | Deskripsi | Contoh |
| --- | --- | --- |
| Mengganti scanner USB | HP menjadi scanner utama | Scan resi Shopee dengan kamera HP |
| Setup sederhana | Desktop install satu helper, HP tanpa install app native | HP cukup buka web PWA |
| Input universal | Barcode masuk ke aplikasi aktif | Notepad, Excel, browser, POS |
| Realtime | Latensi rendah dari scan ke input | Target di bawah 300 ms end-to-end |
| Aman | Tidak ada penyimpanan barcode permanen di cloud | Supabase hanya relay event |

---

## 5. Non Goals

| Non Goal | Alasan |
| --- | --- |
| Membuat backend custom | Arsitektur final wajib memakai Supabase Realtime |
| Membuat NodeJS server | Mengurangi kompleksitas deployment dan maintenance |
| Menyediakan REST API di MVP | Semua komunikasi memakai Realtime Broadcast |
| Menyimpan barcode permanen di cloud | Mengurangi risiko privasi dan compliance |
| Menggantikan WMS/ERP | ScanBridge hanya input bridge, bukan sistem inventory penuh |
| Mobile native app | MVP berbasis PWA agar tanpa install dari app store |

---

## 6. Product Vision

ScanBridge menjadi alat scan barcode universal berbasis smartphone yang dapat dipakai oleh siapa pun dalam waktu kurang dari 5 menit sejak instalasi.

Visi produk:

> Setiap smartphone dapat menjadi barcode scanner desktop yang cepat, murah, dan kompatibel dengan aplikasi apa pun.

Prinsip produk:

| Prinsip | Implementasi |
| --- | --- |
| Simple first | Pairing QR, satu tombol utama, scanner langsung aktif |
| Universal input | Keyboard simulation, bukan integrasi khusus per aplikasi |
| Low friction | HP memakai web app/PWA |
| Privacy aware | Event realtime sementara, tidak menyimpan barcode di cloud |
| Reliable | Auto reconnect dan status session jelas |

---

## 7. Success Metrics

| Metric | Target MVP | Cara Ukur |
| --- | --- | --- |
| Time to first scan | < 5 menit | Dari install desktop sampai barcode masuk Notepad |
| Scan delivery success | >= 99% | Jumlah scan diterima desktop / scan terkirim |
| Keyboard input success | >= 99% | Barcode muncul benar di aplikasi aktif |
| End-to-end latency | < 300 ms | Waktu scan mobile sampai input desktop |
| Crash-free session | 1.000 scan berturut-turut | Stress test QA |
| Pairing success rate | >= 95% | QR scan berhasil connect ke session |

Contoh metrik event lokal:

```json
{
  "event": "scan_received",
  "sessionId": "4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "latencyMs": 184,
  "success": true
}
```

---

## 8. Target Users

| Segment | Kebutuhan Utama | Contoh Aplikasi |
| --- | --- | --- |
| Seller Marketplace | Scan resi dan SKU | Shopee, Tokopedia, TikTok Shop |
| Warehouse | Scan barang masuk/keluar | ERP, WMS, Excel |
| Retail | Scan produk | POS, spreadsheet |
| UMKM | Input barcode murah | Excel, Google Sheets, browser |
| Office | Input kode dokumen | Notepad, SAP, internal web |

---

## 9. User Persona

### Persona 1: Seller Marketplace

| Field | Detail |
| --- | --- |
| Nama | Rina |
| Role | Owner toko online |
| Device | Laptop Windows, Android phone |
| Pain | Harus mengetik nomor resi panjang |
| Goal | Scan resi dan langsung masuk ke Seller Center |

Contoh cerita:

> Rina membuka Shopee Seller Center, klik field nomor resi, scan barcode dari label paket memakai HP, lalu nomor resi langsung terisi.

### Persona 2: Staff Warehouse

| Field | Detail |
| --- | --- |
| Nama | Budi |
| Role | Staff gudang |
| Device | PC Windows shared, beberapa smartphone |
| Pain | Scanner fisik hanya satu |
| Goal | Scan SKU cepat ke Excel atau ERP |

### Persona 3: Admin Inventory

| Field | Detail |
| --- | --- |
| Nama | Sari |
| Role | Admin stok |
| Device | Windows laptop |
| Pain | Input kode barang sering salah |
| Goal | Mengurangi typo dan mempercepat input |

---

## 10. User Stories

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| US-001 | Sebagai seller, saya ingin scan barcode dari HP agar nomor resi masuk ke Seller Center. | Barcode muncul pada field yang aktif. |
| US-002 | Sebagai user baru, saya ingin pairing dengan QR agar tidak mengetik session manual. | QR membuka scanner dengan session yang benar. |
| US-003 | Sebagai admin, saya ingin auto enter agar setiap scan pindah baris. | Setelah barcode diketik, Enter terkirim. |
| US-004 | Sebagai staff gudang, saya ingin melihat status connected agar yakin scan siap dipakai. | Desktop dan mobile menampilkan status session. |
| US-005 | Sebagai user, saya ingin reconnect otomatis saat koneksi putus. | Aplikasi mencoba connect kembali tanpa refresh manual. |

---

## 11. Functional Requirements

### Desktop

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-D-001 | Desktop berjalan sebagai tray application. | App tetap aktif ketika window ditutup. |
| FR-D-002 | Desktop membuat Session UUID. | UUID baru dibuat saat session dimulai. |
| FR-D-003 | Desktop subscribe ke Supabase Realtime channel. | Desktop menerima event dari channel session. |
| FR-D-004 | Desktop membuat QR Code pairing. | QR berisi URL `https://scanbridge.app/connect?session=<uuid>`. |
| FR-D-005 | Desktop menerima payload barcode. | Barcode valid diproses dan ditampilkan di history lokal. |
| FR-D-006 | Desktop mensimulasikan keyboard. | Barcode muncul di aplikasi yang sedang fokus. |
| FR-D-007 | Desktop mendukung auto enter. | Enter dikirim setelah barcode jika setting aktif. |
| FR-D-008 | Desktop mendukung auto tab. | Tab dikirim setelah barcode jika setting aktif. |
| FR-D-009 | Desktop mendukung prefix dan suffix. | Teks tambahan dikirim sebelum/sesudah barcode. |
| FR-D-010 | Desktop menyediakan history lokal. | Riwayat scan terlihat di UI desktop. |
| FR-D-011 | Desktop auto reconnect. | Subscribe ulang setelah koneksi Supabase pulih. |

### Mobile

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| FR-M-001 | User membuka PWA. | Halaman utama tampil dari browser mobile. |
| FR-M-002 | Mobile membaca parameter session. | `session` dari URL dipakai untuk channel. |
| FR-M-003 | Mobile meminta izin kamera. | Browser menampilkan permission prompt. |
| FR-M-004 | Scanner aktif otomatis. | Kamera tampil dan siap scan. |
| FR-M-005 | Barcode terbaca oleh ZXing. | Nilai barcode dan symbology didapat. |
| FR-M-006 | Mobile publish event scan. | Event terkirim ke Supabase Broadcast. |
| FR-M-007 | Mobile memberi feedback. | Beep dan vibrate aktif setelah scan sukses. |
| FR-M-008 | Mobile auto scan berikutnya. | Scanner siap lagi setelah cooldown. |
| FR-M-009 | Mobile menampilkan status session. | Connected, reconnecting, disconnected terlihat. |

---

## 12. Non Functional Requirements

| Kategori | Requirement | Target |
| --- | --- | --- |
| Startup desktop | App siap dipakai cepat | < 2 detik |
| RAM desktop | Ringan untuk PC kasir/laptop lama | < 80 MB |
| Installer | Mudah didistribusikan | < 20 MB jika memungkinkan |
| Latency | Scan ke keyboard | < 300 ms |
| Availability | Desktop tahan lama | 24 jam aktif |
| Browser support | Mobile modern | Chrome Android, Safari iOS terbaru |
| Reliability | Stress test | 1.000 scan tanpa crash |
| Privacy | Data barcode | Tidak disimpan permanen di cloud |

---

## 13. System Architecture

ScanBridge menggunakan arsitektur client-to-client melalui Supabase Realtime Broadcast.

```
+------------------+        +--------------------------+        +------------------+
| Mobile PWA       |        | Supabase Realtime Relay  |        | Desktop Helper   |
| React + ZXing    | <----> | Broadcast Channel        | <----> | Tauri + Rust     |
| Anonymous Client |        | No Business Logic        |        | Enigo Keyboard   |
+------------------+        +--------------------------+        +------------------+
```

Keputusan utama:

| Keputusan | Alasan | Trade-off |
| --- | --- | --- |
| Supabase Realtime | Menghindari backend custom | Bergantung pada layanan cloud |
| Broadcast channel per session | Pairing sederhana | Session ID harus dijaga sulit ditebak |
| Keyboard simulation | Kompatibel dengan banyak aplikasi | Bergantung focus window aktif |
| PWA | Tanpa install native app | Akses kamera bergantung browser |

Alternatif yang dipertimbangkan:

| Alternatif | Status | Alasan Tidak Dipilih |
| --- | --- | --- |
| LAN WebSocket langsung | Ditolak untuk final architecture | Sulit pada jaringan berbeda dan firewall |
| NodeJS server | Ditolak | Prompt melarang backend custom |
| REST API | Ditolak untuk MVP | Tidak realtime dan butuh server logic |
| Bluetooth/BLE | Future | Kompleksitas pairing dan platform |

---

## 14. Technology Stack

| Layer | Teknologi | Catatan |
| --- | --- | --- |
| Mobile UI | React + TypeScript | Component-based dan type-safe |
| Build Mobile | Vite | Cepat untuk development |
| PWA | Vite PWA plugin | Installable web app |
| Scanner | ZXing | Mendukung EAN-13, Code128, QR Code |
| Realtime | Supabase JS | Broadcast publish dari HP |
| Desktop Shell | Tauri | Desktop app ringan |
| Desktop Core | Rust | Performa dan footprint rendah |
| Async Runtime | Tokio | Realtime subscription async |
| Keyboard | Enigo | Simulasi typing dan key press |
| Serialization | Serde | JSON payload |
| Hosting | Vercel | Deploy PWA |
| Installer | Tauri Bundler | MSI/NSIS sesuai target |

---

## 15. High Level Diagram

```
User opens Desktop
        |
        v
Desktop creates session UUID
        |
        v
Desktop subscribes to Supabase channel
        |
        v
Desktop shows QR Code
        |
        v
Mobile opens connect URL
        |
        v
Mobile scans barcode
        |
        v
Mobile broadcasts scan event
        |
        v
Desktop receives event
        |
        v
Desktop types barcode into active window
```

---

## 16. Detailed Architecture

### Desktop Modules

| Module | Tanggung Jawab |
| --- | --- |
| `session` | Membuat dan mengelola UUID session |
| `realtime` | Subscribe Supabase channel dan receive event |
| `keyboard` | Mengetik barcode, Enter, Tab, prefix, suffix |
| `settings` | Menyimpan konfigurasi lokal |
| `history` | Menyimpan history lokal opsional |
| `tray` | Tray menu dan lifecycle app |
| `ui` | Menampilkan QR, status, history, settings |

### Mobile Modules

| Module | Tanggung Jawab |
| --- | --- |
| `pages` | Home, connect, scanner |
| `scanner` | Kamera dan ZXing decoder |
| `realtime` | Publish broadcast ke Supabase |
| `feedback` | Beep, vibrate, toast |
| `session` | Membaca session dari URL dan status connection |
| `settings` | Preferensi mobile lokal sederhana |

---

## 17. Project Structure

```
scanbridge/
  mobile/
  desktop/
  docs/
  .github/
  README.md
  scanBridge_PRD.md
```

Penjelasan:

| Folder | Isi |
| --- | --- |
| `mobile` | PWA scanner |
| `desktop` | Tauri Windows helper |
| `docs` | Dokumen teknis tambahan |
| `.github` | CI workflow dan issue template |

---

## 18. Folder Structure

### Mobile

```
mobile/
  public/
  src/
    components/
    pages/
    hooks/
    scanner/
    realtime/
    feedback/
    session/
    utils/
    types/
```

### Desktop

```
desktop/
  src/
    components/
    pages/
    hooks/
  src-tauri/
    src/
      commands/
      realtime/
      keyboard/
      session/
      settings/
      history/
      tray/
      config/
```

---

## 19. Component Architecture

### Mobile Components

| Component | Fungsi |
| --- | --- |
| `HomePage` | Instruksi awal dan tombol scan pairing |
| `ConnectPage` | Membaca session dan menyiapkan scanner |
| `ScannerView` | Menampilkan kamera dan overlay scanner |
| `SessionStatus` | Connected, reconnecting, disconnected |
| `FeedbackToast` | Pesan scan sukses/gagal |
| `FlashToggle` | Mengaktifkan flash jika tersedia |

### Desktop Components

| Component | Fungsi |
| --- | --- |
| `DashboardPage` | QR, status, device, history |
| `QrPairingPanel` | Menampilkan QR session |
| `SettingsPage` | Auto enter, auto tab, prefix, suffix |
| `HistoryList` | Riwayat scan lokal |
| `ConnectionBadge` | Status Supabase channel |

---

## 20. Desktop Architecture

Desktop Helper adalah aplikasi Tauri yang berjalan di system tray. Frontend Tauri menampilkan UI, sedangkan Rust mengelola realtime subscription dan keyboard simulation.

```
Tauri UI
  |
  | invoke command
  v
Rust Commands
  |
  +-- Session Manager
  +-- Supabase Realtime Client
  +-- Keyboard Engine
  +-- Settings Store
  +-- History Store
```

Implementation notes:

| Topik | Catatan |
| --- | --- |
| Keyboard | Gunakan Enigo untuk mengetik teks dan key Enter/Tab |
| Focus | Jangan mengambil alih focus window; user harus klik field target |
| Tray | Close window hanya hide, bukan exit |
| Settings | Simpan lokal di app config directory |
| History | Simpan lokal, maksimal item dapat dikonfigurasi |

---

## 21. Mobile Architecture

Mobile PWA bertugas membaca barcode dan publish event ke Supabase channel session.

```
React Page
  |
  +-- Camera Permission
  +-- ZXing Decoder
  +-- Supabase Broadcast Publisher
  +-- Beep/Vibration Feedback
```

Implementation notes:

| Topik | Catatan |
| --- | --- |
| Camera | Gunakan rear camera sebagai default |
| Cooldown | Beri jeda 500-1000 ms agar barcode tidak terkirim berulang |
| Duplicate guard | Abaikan barcode sama dalam window pendek jika dibutuhkan |
| Vibration | Gunakan `navigator.vibrate` jika tersedia |
| Beep | Gunakan Web Audio API agar tidak bergantung file audio |

---

## 22. Supabase Architecture

Supabase digunakan sebagai realtime relay.

| Komponen | Fungsi |
| --- | --- |
| Supabase Auth | Anonymous authentication |
| Realtime Broadcast | Channel scan per session |
| Database | Tidak wajib untuk MVP |
| Edge Function | Tidak digunakan untuk MVP |
| Storage | Tidak digunakan |

Channel naming:

```text
scanbridge:session:<sessionId>
```

Event naming:

| Event | Publisher | Subscriber |
| --- | --- | --- |
| `client_joined` | Mobile | Desktop |
| `scan` | Mobile | Desktop |
| `scan_ack` | Desktop | Mobile |
| `desktop_status` | Desktop | Mobile |

---

## 23. Session Lifecycle

| State | Trigger | Next State |
| --- | --- | --- |
| `idle` | Desktop dibuka | `creating_session` |
| `creating_session` | UUID dibuat | `subscribing` |
| `subscribing` | Channel subscribed | `waiting_pairing` |
| `waiting_pairing` | Mobile join | `connected` |
| `connected` | Scan diterima | `connected` |
| `connected` | Network error | `reconnecting` |
| `reconnecting` | Subscribe berhasil | `connected` |
| `connected` | User disconnect | `idle` |

Contoh session:

```json
{
  "sessionId": "4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "channel": "scanbridge:session:4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "createdAt": "2026-07-27T12:00:00.000Z"
}
```

---

## 24. Realtime Event Flow

| Step | Aktor | Event |
| --- | --- | --- |
| 1 | Desktop | Subscribe channel session |
| 2 | Desktop | Broadcast `desktop_status` ready |
| 3 | Mobile | Subscribe channel dari URL session |
| 4 | Mobile | Broadcast `client_joined` |
| 5 | Mobile | Broadcast `scan` |
| 6 | Desktop | Simulasi keyboard |
| 7 | Desktop | Broadcast `scan_ack` |

---

## 25. Sequence Diagram

```text
Desktop        Supabase Realtime        Mobile PWA        Active App
   |                   |                    |                 |
   | create session    |                    |                 |
   | subscribe channel |                    |                 |
   |------------------>|                    |                 |
   | show QR           |                    |                 |
   |                   |                    | scan QR         |
   |                   |<-------------------| subscribe       |
   |<------------------| client_joined      |                 |
   |                   |                    | scan barcode    |
   |<------------------| scan event         |                 |
   | type barcode      |                    |                 |
   |-------------------------------------------------------->|
   | scan_ack          |                    |                 |
   |------------------>|------------------->|                 |
```

---

## 26. State Diagram

```text
[Idle]
  |
  v
[Creating Session]
  |
  v
[Waiting Pairing] <----+
  |                    |
  v                    |
[Connected]            |
  |                    |
  v                    |
[Reconnecting] --------+
  |
  v
[Disconnected]
```

Mobile scanner state:

```text
[No Session] -> [Connecting] -> [Camera Permission] -> [Ready]
                                                |          |
                                                v          v
                                             [Denied]   [Scanning]
                                                           |
                                                           v
                                                        [Cooldown]
                                                           |
                                                           v
                                                        [Ready]
```

---

## 27. Pairing Flow

1. User membuka Desktop Helper.
2. Desktop membuat Session UUID.
3. Desktop subscribe ke channel Supabase.
4. Desktop menampilkan QR Code.
5. User membuka kamera HP atau web scanner pairing.
6. HP membuka URL `https://scanbridge.app/connect?session=<uuid>`.
7. Mobile subscribe ke channel yang sama.
8. Mobile mengirim event `client_joined`.
9. Desktop menampilkan status connected.

Acceptance criteria:

| Criteria | Expected Result |
| --- | --- |
| QR discan | Browser membuka halaman connect |
| Session valid | Mobile masuk scanner page |
| Desktop online | Status menjadi connected |
| Session invalid | Mobile menampilkan error session |

---

## 28. Barcode Flow

```text
Barcode detected
  |
  v
Validate value
  |
  v
Apply cooldown and duplicate guard
  |
  v
Publish scan event
  |
  v
Desktop receives event
  |
  v
Keyboard simulation
  |
  v
ACK and feedback
```

Contoh:

```json
{
  "type": "scan",
  "sessionId": "4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "barcode": "8991234567890",
  "symbology": "EAN_13",
  "timestamp": "2026-07-27T12:00:00.000Z",
  "source": "mobile"
}
```

---

## 29. Keyboard Simulation Flow

```text
Receive scan
  |
  v
Load settings
  |
  v
Type prefix
  |
  v
Type barcode
  |
  v
Type suffix
  |
  v
Send Enter or Tab if enabled
```

Rules:

| Setting | Behavior |
| --- | --- |
| Prefix | Dikirim sebelum barcode |
| Suffix | Dikirim setelah barcode |
| Auto Enter | Menekan Enter setelah teks |
| Auto Tab | Menekan Tab setelah teks |
| Enter + Tab aktif | Prioritas ditentukan settings, default Enter lebih dulu |

Technical note:

> Desktop tidak boleh memindahkan focus window secara otomatis. User bertanggung jawab memastikan cursor berada di field target.

---

## 30. Configuration

| Key | Default | Scope | Deskripsi |
| --- | --- | --- | --- |
| `supabaseUrl` | env | Desktop/Mobile | URL project Supabase |
| `supabaseAnonKey` | env | Desktop/Mobile | Anonymous key |
| `autoEnter` | `true` | Desktop | Kirim Enter setelah scan |
| `autoTab` | `false` | Desktop | Kirim Tab setelah scan |
| `prefix` | `""` | Desktop | Teks sebelum barcode |
| `suffix` | `""` | Desktop | Teks setelah barcode |
| `scanCooldownMs` | `800` | Mobile | Jeda antar scan |
| `historyLimit` | `100` | Desktop | Jumlah history lokal |

Contoh `.env` mobile:

```text
VITE_SUPABASE_URL=https://example.supabase.co
VITE_SUPABASE_ANON_KEY=public-anon-key
```

---

## 31. Settings

Desktop settings:

| Setting | Type | UI Control | Validation |
| --- | --- | --- | --- |
| Auto Enter | Boolean | Toggle | Tidak boleh konflik dengan mode custom |
| Auto Tab | Boolean | Toggle | Dapat aktif sendiri |
| Prefix | String | Text input | Maksimal 64 karakter |
| Suffix | String | Text input | Maksimal 64 karakter |
| History Enabled | Boolean | Toggle | Default true |
| History Limit | Number | Number input | 10-1000 |

Mobile settings:

| Setting | Type | UI Control | Validation |
| --- | --- | --- | --- |
| Beep | Boolean | Toggle | Default true |
| Vibrate | Boolean | Toggle | Default true |
| Flash | Boolean | Toggle | Jika device mendukung |
| Camera | Enum | Select | Rear/front |

---

## 32. Data Model

### Local Desktop Settings

```json
{
  "autoEnter": true,
  "autoTab": false,
  "prefix": "",
  "suffix": "",
  "historyEnabled": true,
  "historyLimit": 100
}
```

### Local History Item

```json
{
  "id": "local-001",
  "barcode": "8991234567890",
  "symbology": "EAN_13",
  "receivedAt": "2026-07-27T12:00:00.000Z",
  "typed": true
}
```

Data model MVP bersifat lokal. Tidak ada tabel database wajib.

---

## 33. Realtime Event Contract

| Event | Direction | Payload |
| --- | --- | --- |
| `client_joined` | Mobile -> Desktop | `ClientJoinedEvent` |
| `scan` | Mobile -> Desktop | `ScanEvent` |
| `scan_ack` | Desktop -> Mobile | `ScanAckEvent` |
| `desktop_status` | Desktop -> Mobile | `DesktopStatusEvent` |

Contract rules:

| Rule | Deskripsi |
| --- | --- |
| Semua event punya `type` | Memudahkan routing |
| Semua event punya `sessionId` | Mencegah salah channel |
| Timestamp ISO 8601 | Konsisten lintas platform |
| Payload kecil | Hindari data besar di broadcast |

---

## 34. JSON Schema

### Scan Event

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ScanEvent",
  "type": "object",
  "required": ["type", "sessionId", "barcode", "timestamp", "source"],
  "properties": {
    "type": { "const": "scan" },
    "sessionId": { "type": "string", "format": "uuid" },
    "barcode": { "type": "string", "minLength": 1, "maxLength": 256 },
    "symbology": { "type": "string" },
    "timestamp": { "type": "string", "format": "date-time" },
    "source": { "const": "mobile" }
  }
}
```

### Scan ACK Event

```json
{
  "type": "scan_ack",
  "sessionId": "4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "barcode": "8991234567890",
  "success": true,
  "message": "typed",
  "timestamp": "2026-07-27T12:00:00.150Z"
}
```

---

## 35. Security

| Risiko | Mitigasi |
| --- | --- |
| Session ditebak | Gunakan UUID v4 cryptographically random |
| Channel diakses pihak lain | Channel memakai session ID panjang dan sementara |
| Barcode tersimpan di cloud | Jangan insert ke database; broadcast saja |
| Abuse anonymous key | Batasi Supabase Realtime policy jika memakai auth rules |
| QR dibagikan tidak sengaja | Tombol regenerate session di desktop |

Technical notes:

1. Supabase anon key boleh berada di client, tetapi RLS dan policy harus tetap dipahami.
2. Session sebaiknya dapat di-regenerate.
3. Untuk versi enterprise, tambahkan signed pairing token dengan expiry.

---

## 36. Performance Requirement

| Area | Target |
| --- | --- |
| Mobile scanner startup | < 2 detik setelah izin kamera |
| Desktop startup | < 2 detik |
| Broadcast latency | < 200 ms rata-rata |
| Keyboard typing start | < 100 ms setelah event diterima |
| Scan throughput | Minimal 1 scan/detik stabil |
| Stress test | 1.000 scan berturut-turut |

Contoh pengukuran:

```json
{
  "detectedAt": "2026-07-27T12:00:00.000Z",
  "receivedAt": "2026-07-27T12:00:00.130Z",
  "typedAt": "2026-07-27T12:00:00.180Z",
  "latencyMs": 180
}
```

---

## 37. Scalability

MVP dirancang untuk single desktop session dengan satu atau beberapa mobile client.

| Skala | Dukungan MVP | Catatan |
| --- | --- | --- |
| 1 desktop, 1 HP | Ya | Target utama |
| 1 desktop, banyak HP | Terbatas | Butuh device identity |
| Banyak desktop | Ya, per session | Session channel berbeda |
| Enterprise multi-user | Future | Butuh account dan admin dashboard |

Trade-off:

> Supabase Broadcast cukup untuk realtime relay ringan, tetapi untuk audit enterprise, role management, dan analytics besar, dibutuhkan arsitektur tambahan di luar MVP.

---

## 38. Error Handling

| Error | Mobile Behavior | Desktop Behavior |
| --- | --- | --- |
| Camera denied | Tampilkan pesan izin kamera | Tidak terkait |
| Session missing | Tampilkan invalid session | Tidak terkait |
| Supabase disconnected | Status reconnecting | Status reconnecting |
| Scan publish failed | Toast gagal, retry opsional | Tidak menerima event |
| Keyboard simulation failed | Tampilkan ACK gagal jika mungkin | Log error lokal |
| Duplicate scan | Abaikan selama cooldown | Tidak memproses ulang |

Contoh error payload:

```json
{
  "type": "scan_ack",
  "success": false,
  "message": "keyboard_simulation_failed",
  "timestamp": "2026-07-27T12:00:00.200Z"
}
```

---

## 39. Logging

Logging wajib membantu debugging tanpa membocorkan data sensitif secara berlebihan.

| Log | Level | Contoh |
| --- | --- | --- |
| App started | Info | Desktop Helper started |
| Session created | Info | Session UUID created |
| Realtime connected | Info | Subscribed to channel |
| Scan received | Info | Barcode length and symbology |
| Keyboard error | Error | Enigo typing failed |
| Reconnect attempt | Warn | Reconnecting to Supabase |

Technical note:

> Untuk privacy, log production sebaiknya menyamarkan barcode, misalnya hanya menyimpan 4 karakter awal dan panjang barcode.

---

## 40. Testing Strategy

### Unit Test

| Area | Test |
| --- | --- |
| Session | UUID valid dan channel name benar |
| Event parser | Payload valid/invalid |
| Settings | Default dan update setting |
| Keyboard formatter | Prefix, barcode, suffix, Enter/Tab |

### Integration Test

| Area | Test |
| --- | --- |
| Mobile publish | Event terkirim ke channel test |
| Desktop subscribe | Event diterima dan diproses |
| Reconnect | Putus jaringan lalu subscribe ulang |

### Manual QA

| Scenario | Expected |
| --- | --- |
| Scan EAN-13 | Barcode diketik benar |
| Scan Code128 | Barcode diketik benar |
| Scan QR Code | Nilai QR diketik benar |
| Notepad target | Input muncul |
| Excel target | Input masuk cell aktif |
| Chrome target | Input masuk field aktif |
| Shopee Seller target | Input masuk field aktif |

---

## 41. Acceptance Criteria

MVP diterima jika:

| Criteria | Status Target |
| --- | --- |
| Desktop app dapat dijalankan di Windows | Wajib |
| Tray icon muncul | Wajib |
| Desktop membuat session UUID | Wajib |
| QR pairing muncul | Wajib |
| Mobile membuka scanner dari QR | Wajib |
| Mobile connect ke Supabase channel | Wajib |
| Barcode terkirim dari mobile | Wajib |
| Desktop menerima barcode | Wajib |
| Desktop mengetik barcode ke Notepad | Wajib |
| Auto Enter berfungsi | Wajib |
| Auto reconnect berjalan | Wajib |
| 1.000 scan tidak crash | Wajib |

---

## 42. UI Wireframe (ASCII)

Desktop:

```text
+------------------------------------------------+
| ScanBridge                                     |
| Status: Connected                              |
|                                                |
| +----------------+                             |
| |    QR CODE     |                             |
| +----------------+                             |
|                                                |
| Session: 4d8e...5c01                           |
| Connected Device: 1                            |
|                                                |
| Recent Scans                                   |
| 12:00  8991234567890                           |
| 12:01  JP123456789ID                           |
|                                                |
| [Settings] [Regenerate QR]                     |
+------------------------------------------------+
```

Mobile:

```text
+--------------------------+
| ScanBridge               |
| Connected                |
|                          |
| +----------------------+ |
| |                      | |
| |       CAMERA         | |
| |                      | |
| +----------------------+ |
|                          |
| Ready                    |
| [Flash] [Beep] [Vibrate] |
+--------------------------+
```

---

## 43. Desktop Screen

| Screen | Elemen | Behavior |
| --- | --- | --- |
| Dashboard | QR Code | Menampilkan URL pairing aktif |
| Dashboard | Status badge | Connected, waiting, reconnecting |
| Dashboard | History | Menampilkan scan terbaru |
| Settings | Auto Enter toggle | Mengatur Enter setelah scan |
| Settings | Prefix/Suffix input | Menyimpan teks tambahan |
| Tray Menu | Open | Membuka window |
| Tray Menu | Settings | Membuka settings |
| Tray Menu | Exit | Menutup app |

Acceptance:

1. Window close menyembunyikan app ke tray.
2. Exit dari tray benar-benar menutup process.
3. Regenerate QR membuat session baru dan subscribe channel baru.

---

## 44. Mobile Screen

| Screen | Elemen | Behavior |
| --- | --- | --- |
| Home | Scan QR Pairing | Membuka kamera untuk scan QR pairing |
| Connect | Session loader | Membaca query `session` |
| Scanner | Camera preview | Scanner aktif |
| Scanner | Status | Menampilkan connected/reconnecting |
| Scanner | Flash toggle | Muncul jika device mendukung |
| Scanner | Last scan | Menampilkan barcode terakhir |

Acceptance:

1. Jika URL memiliki session valid, scanner langsung siap.
2. Jika kamera ditolak, tampil pesan yang jelas.
3. Setelah scan sukses, HP beep dan vibrate.

---

## 45. Roadmap

| Phase | Fokus | Output |
| --- | --- | --- |
| Phase 1 | MVP scan ke keyboard | Notepad scan berhasil |
| Phase 2 | Settings dan history | Auto enter/tab, prefix/suffix |
| Phase 3 | Reliability | Reconnect, stress test, logging |
| Phase 4 | Packaging | Installer dan deployment Vercel |
| Phase 5 | Productivity | Profiles, multi-device, export |

---

## 46. Sprint Planning

### Sprint 1: Foundation

| Task | Output |
| --- | --- |
| Setup repo mobile | React Vite TS berjalan |
| Setup repo desktop | Tauri app berjalan |
| Supabase config | Client dapat connect |
| Session UUID | Desktop membuat session |

### Sprint 2: Pairing and Realtime

| Task | Output |
| --- | --- |
| QR desktop | QR berisi connect URL |
| Mobile connect page | Session terbaca |
| Broadcast scan mock | Event diterima desktop |

### Sprint 3: Scanner and Keyboard

| Task | Output |
| --- | --- |
| ZXing scanner | Barcode terbaca |
| Enigo keyboard | Barcode diketik |
| Auto enter | Enter setelah barcode |

### Sprint 4: Hardening

| Task | Output |
| --- | --- |
| Auto reconnect | Recovery koneksi |
| Settings | Prefix/suffix/auto tab |
| Stress test | 1.000 scan |

---

## 47. Milestones

| Milestone | Definition |
| --- | --- |
| M1 | Desktop dan mobile skeleton berjalan |
| M2 | Pairing QR berhasil |
| M3 | Mobile publish scan mock dan desktop receive |
| M4 | Barcode camera nyata terkirim |
| M5 | Keyboard simulation stabil |
| M6 | Installer dan PWA deploy |

---

## 48. Future Features

| Feature | Deskripsi |
| --- | --- |
| BLE connection | Pairing tanpa cloud relay |
| USB mode | HP sebagai HID via kabel jika memungkinkan |
| Inventory mode | Simpan scan sebagai data stok |
| CSV export | Export history lokal |
| Excel export | Export ke workbook |
| Webhook | Kirim scan ke sistem eksternal |
| REST API | Untuk integrasi enterprise, bukan MVP |
| Profiles | Setting berbeda per workflow |
| Multi-device | Banyak HP per desktop |
| Cloud account | Sinkronisasi settings enterprise |

---

## 49. Coding Standard

| Item | Standard | Contoh |
| --- | --- | --- |
| Variable | camelCase | `sessionId` |
| Function | camelCase | `createSession()` |
| React Component | PascalCase | `ScannerView` |
| TypeScript Type | PascalCase | `ScanEvent` |
| Constant | SCREAMING_SNAKE_CASE | `DEFAULT_SCAN_COOLDOWN_MS` |
| Rust function | snake_case | `create_session()` |
| Rust struct | PascalCase | `ScanEvent` |

Technical notes:

1. Gunakan TypeScript strict mode.
2. Hindari business logic di React component; pindahkan ke hook/service.
3. Rust command harus mengembalikan error yang bisa dipahami UI.
4. Semua event realtime harus punya type definition bersama.

---

## 50. Git Convention

Commit format:

```text
feat: add mobile scanner
fix: handle realtime reconnect
refactor: split keyboard service
docs: update setup guide
style: format dashboard layout
test: add event parser tests
build: configure tauri bundler
chore: update dependencies
```

Rules:

| Rule | Deskripsi |
| --- | --- |
| Commit kecil | Satu perubahan logis per commit |
| Pesan jelas | Gunakan imperative summary |
| PR wajib test | Minimal test relevan atau manual QA notes |

---

## 51. Branch Strategy

```text
main
develop
feature/<short-name>
fix/<short-name>
release/<version>
```

| Branch | Fungsi |
| --- | --- |
| `main` | Stable release |
| `develop` | Integrasi aktif |
| `feature/*` | Pengembangan fitur |
| `fix/*` | Bug fix |
| `release/*` | Persiapan release |

---

## 52. Definition of Done

Sebuah fitur dianggap selesai jika:

| Checklist | Wajib |
| --- | --- |
| Requirement terpenuhi | Ya |
| Acceptance criteria lulus | Ya |
| Error state ditangani | Ya |
| UI responsif | Ya |
| Logging relevan tersedia | Ya |
| Test ditambahkan sesuai risiko | Ya |
| Manual QA dicatat | Ya |
| Tidak ada regression kritis | Ya |

Definition of Done MVP:

1. Desktop dapat dijalankan.
2. Tray icon muncul.
3. QR Pairing berhasil.
4. HP berhasil connect.
5. HP berhasil scan barcode.
6. Desktop menerima barcode.
7. Desktop mengetik barcode ke Notepad.
8. Auto reconnect berjalan.
9. Auto Enter berfungsi.
10. Tidak crash setelah 1.000 scan berturut-turut.

---

## 53. Deployment Guide

### Mobile PWA ke Vercel

1. Set environment variable:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

2. Build:

```text
npm run build
```

3. Deploy ke Vercel dari repo.

4. Pastikan domain production:

```text
https://scanbridge.app
```

### Desktop Installer

1. Set Supabase config untuk desktop.
2. Build Tauri:

```text
cargo tauri build
```

3. Ambil installer dari output bundler.
4. Test install di Windows bersih.

---

## 54. Developer Setup Guide

Prerequisites:

| Tool | Versi Rekomendasi |
| --- | --- |
| Node.js | LTS |
| Rust | Stable |
| Tauri CLI | Versi sesuai project |
| Supabase Project | Realtime enabled |
| Windows | 10/11 |

Setup mobile:

```text
cd mobile
npm install
npm run dev
```

Setup desktop:

```text
cd desktop
npm install
cargo tauri dev
```

Supabase setup:

1. Buat project Supabase.
2. Aktifkan Realtime.
3. Gunakan anonymous authentication.
4. Simpan URL dan anon key di env mobile dan desktop.
5. Test broadcast dengan session dummy.

---

## 55. Appendix

### Glossary

| Istilah | Definisi |
| --- | --- |
| PWA | Progressive Web App yang dapat dibuka seperti aplikasi dari browser |
| Desktop Helper | Aplikasi Windows yang menerima barcode dan mengetik ke active window |
| Supabase Realtime | Layanan websocket managed dari Supabase |
| Broadcast | Event realtime tanpa penyimpanan database |
| Session UUID | ID unik untuk pairing desktop dan mobile |
| Keyboard Simulation | Proses mengirim input seolah-olah dari keyboard |

### Contoh URL Pairing

```text
https://scanbridge.app/connect?session=4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01
```

### Contoh Payload Lengkap

```json
{
  "type": "scan",
  "sessionId": "4d8e7f85-0d84-4b1d-b7dc-0b7a6cbe5c01",
  "barcode": "JP123456789ID",
  "symbology": "CODE_128",
  "timestamp": "2026-07-27T12:00:00.000Z",
  "source": "mobile",
  "device": {
    "id": "mobile-anonymous-001",
    "name": "Android Chrome"
  }
}
```

### Final Technical Notes

1. Supabase hanya relay realtime, bukan tempat business logic.
2. Jangan membangun backend custom untuk MVP.
3. Jangan menggunakan NodeJS server atau Express.
4. Desktop dan mobile sama-sama client.
5. Keyboard simulation adalah inti kompatibilitas aplikasi.
6. Session UUID adalah boundary pairing utama.
7. Semua fitur harus diuji dengan target aplikasi nyata, minimal Notepad, Excel, dan browser.
