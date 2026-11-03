import type { RefObject } from "react";
import { formatPairingCode, isValidPairingCode } from "../shared/contracts";
import { getPairingCodeFromScan } from "../lib/session";
import Icon from "./Icon";

type HomePanelProps = {
  pairingCode: string; status: string; busy: boolean; pairingSaved: boolean; configured: boolean;
  onPairingCodeChange: (value: string) => void; onConnect: () => void; onResetPairing: () => void;
  onCancelConnect: () => void; pairingScanMode: boolean; pairingScanActive: boolean;
  pairingScanPaused: boolean; pairingScanError: string; pairingConnectionMessage: string;
  pairingVideoRef: RefObject<HTMLVideoElement>; onStartPairingScan: () => void;
  onCancelPairingScan: () => void; onResumePairingScan: () => void;
};

export default function HomePanel({ pairingCode, status, busy, pairingSaved, configured,
  onPairingCodeChange, onConnect, onResetPairing, onCancelConnect, pairingScanMode,
  pairingScanActive, pairingScanPaused, pairingScanError, pairingConnectionMessage,
  pairingVideoRef, onStartPairingScan, onCancelPairingScan, onResumePairingScan
}: HomePanelProps) {
  const failed = /offline|terputus|tidak|gagal|belum aktif|dijeda/.test(status.toLowerCase());
  const showNotice = busy || pairingSaved || failed || !configured;
  const invalidCharacters = /[^A-F0-9]/.test(pairingCode);
  return (
    <div className="home-content">
      <section className="page-heading"><p className="eyebrow">PAIRING PERANGKAT</p><h2>Hubungkan ke<br />komputer Anda.</h2><p>Ponsel memindai. Komputer mengetik.<br />Tanpa scanner tambahan.</p></section>
      {showNotice && <section className="connection-notice" data-state={!configured || failed && !busy ? "error" : busy ? "pending" : "idle"} role="status">
        <span className={busy ? "notice-icon spinning" : "notice-icon"}><Icon name={busy ? "refresh" : failed || !configured ? "alert" : "monitor"} /></span>
        <div><h3>{!configured ? "Koneksi belum tersedia" : busy ? "Menghubungkan ke desktop" : pairingSaved ? "Menunggu komputer kembali" : status}</h3><p>{!configured ? "Hubungi pengelola aplikasi untuk menyiapkan koneksi." : busy ? "Memeriksa pairing dan menunggu konfirmasi komputer…" : pairingConnectionMessage || "Buka ScanBridge Desktop dan pastikan kedua perangkat terhubung ke internet."}</p></div>
      </section>}
      <section className="card pairing-panel" aria-labelledby="pairing-title">
        <div className="card-heading"><span className="card-icon"><Icon name="monitor" /></span><div><h3 id="pairing-title">{pairingScanMode ? "Pindai QR desktop" : pairingSaved ? "Pairing perangkat" : "Pasangkan perangkat"}</h3><p>{pairingSaved ? "Kode pairing untuk komputer ini." : "Temukan QR di Ringkasan pada desktop."}</p></div></div>
        {pairingScanMode ? <>
          <div className="pairing-camera" data-active={pairingScanActive}>
            <video ref={pairingVideoRef} className="camera-video" muted playsInline aria-label="Kamera untuk scan QR pairing" />
            {pairingScanActive && <div className="scan-guide pairing-scan-guide" aria-hidden="true"><i /><i /><i /><i /></div>}
            {!pairingScanActive && <div className="camera-placeholder"><Icon name={pairingScanError ? "alert" : "camera"} /><strong>{pairingScanError ? "Kamera belum dapat dipakai" : pairingScanPaused ? "Kamera dijeda" : "Menyiapkan kamera"}</strong><p>{pairingScanError ? "Izinkan akses kamera di browser, atau masukkan kode pairing secara manual." : pairingScanPaused ? "Aktifkan kembali saat QR desktop sudah terlihat." : "Izinkan akses kamera untuk memindai QR desktop."}</p>{(pairingScanPaused || pairingScanError) && <button className="camera-resume" onClick={onResumePairingScan} type="button">{pairingScanError ? "Coba kamera lagi" : "Nyalakan kamera"}</button>}</div>}
            <button className="camera-close" onClick={onCancelPairingScan} aria-label="Tutup kamera pairing" type="button"><Icon name="close" /></button>
            {pairingScanActive && <span className="camera-caption">Arahkan ke QR di layar komputer</span>}
          </div>
          {pairingScanError && <p className="error-message" role="alert">{pairingScanError}</p>}
          <button className="secondary" onClick={onCancelPairingScan} type="button"><Icon name="keyboard" />Masukkan kode manual</button>
        </> : pairingSaved ? <>
          <div className="saved-pairing"><span className="eyebrow">KODE PAIRING ANDA</span><code>{formatPairingCode(pairingCode)}</code><p>{busy ? "Menunggu konfirmasi komputer." : "Tidak perlu membuat kode baru saat koneksi terputus."}</p></div>
          <button className="primary" onClick={onConnect} disabled={busy || !configured} type="button"><Icon name={busy ? "refresh" : "link"} className={busy ? "spinning" : undefined} />{busy ? "Menghubungkan…" : "Coba sambungkan ulang"}</button>
          <button className="text-button" onClick={onResetPairing} type="button">Gunakan komputer lain</button>
        </> : <>
          <button className="primary scan-qr-button" onClick={onStartPairingScan} disabled={busy || !configured} type="button"><Icon name="qr" />Pindai QR desktop<Icon name="arrow" className="button-arrow" /></button>
          <div className="divider"><span>atau gunakan kode pairing</span></div>
          <form className="pairing-form" aria-busy={busy} onSubmit={event => { event.preventDefault(); onConnect(); }}>
            <label htmlFor="pairing-code">Kode pairing</label>
            <input id="pairing-code" className="code-input" inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={80} value={pairingCode} disabled={busy || !configured} placeholder="Tempel kode dari desktop" onChange={event => onPairingCodeChange(event.target.value)} onPaste={event => { const code = getPairingCodeFromScan(event.clipboardData.getData("text")); if (code) { event.preventDefault(); onPairingCodeChange(code); } }} aria-invalid={invalidCharacters} aria-describedby={invalidCharacters ? "pairing-code-help pairing-code-error" : "pairing-code-help"} />
            <div id="pairing-code-help" className="field-help"><span>32 karakter dari aplikasi desktop.</span><span>{pairingCode.length}/32</span></div>
            {invalidCharacters && <p id="pairing-code-error" className="field-validation">Kode hanya berisi angka 0–9 dan huruf A–F. Salin kembali kode dari desktop.</p>}
            <button className="secondary connect-button" disabled={busy || !configured || !isValidPairingCode(pairingCode)} type="submit">{busy ? <><Icon name="refresh" className="spinning" />Menghubungkan…</> : <>Hubungkan desktop<Icon name="arrow" /></>}</button>
          </form>
          {busy && <button className="text-button" onClick={onCancelConnect} type="button">Batalkan pairing</button>}
        </>}
      </section>
      {!pairingScanMode && <section className="setup-guide" aria-labelledby="setup-heading"><h3 id="setup-heading">Mulai dalam tiga langkah</h3><ol><li><span>01</span><div><strong>Buka ScanBridge Desktop</strong><p>Tampilkan QR pada halaman Ringkasan.</p></div></li><li><span>02</span><div><strong>Hubungkan ponsel ini</strong><p>Pindai QR atau tempel kode pairing.</p></div></li><li><span>03</span><div><strong>Pilih kolom tujuan di komputer</strong><p>Hasil scan akan langsung diketik di sana.</p></div></li></ol></section>}
      <p className="privacy-note"><Icon name="shield" /><span>Barcode dikirim ke komputer. Penyimpanan riwayat mengikuti pengaturan di desktop.</span></p>
    </div>
  );
}
