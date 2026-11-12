import { useRef, type RefObject } from "react";
import type { ScanOutcome } from "../hooks/useScannerSession";
import Icon from "./Icon";

export type ScannerFrameProps = {
  barcode: string; scanOutcome: ScanOutcome | null; manualBarcode: string; manualMode: boolean;
  active: boolean; pausedForInactivity: boolean; pausedForRest: boolean; error?: string | null; toast?: string; toastTone: "idle" | "success" | "error";
  videoRef: RefObject<HTMLVideoElement>; torchSupported: boolean; torchEnabled: boolean;
  onBarcodeChange: (value: string) => void; onTorchToggle: () => void; onResumeCamera: () => void;
  onManageConnection: () => void; onManualModeChange: (manual: boolean) => void; onReady: () => void;
};

export default function ScannerFrame({ barcode, scanOutcome, manualBarcode, manualMode,
  active, pausedForInactivity, pausedForRest, error, toast, toastTone, videoRef, torchSupported, torchEnabled,
  onBarcodeChange, onTorchToggle, onResumeCamera, onManageConnection, onManualModeChange, onReady
}: ScannerFrameProps) {
  const swipeStartY = useRef<number | null>(null);
  const pending = scanOutcome?.state === "pending";
  const resultState = scanOutcome?.state ?? "idle";
  const time = scanOutcome?.timestamp ? new Date(scanOutcome.timestamp) : null;
  return (
    <section className="scanner" data-manual={manualMode}>
      <div className="scanner-heading"><div><p className="eyebrow">SCANNER MOBILE</p><h2>{manualMode ? "Input barcode" : "Pindai barcode"}</h2></div><button className="secondary connection-button" onClick={onManageConnection} type="button"><Icon name="link" />Koneksi</button></div>
      <div className="scan-mode-switch" aria-label="Cara memasukkan barcode"><button className={!manualMode ? "selected" : ""} aria-pressed={!manualMode} onClick={() => onManualModeChange(false)} type="button"><Icon name="camera" />Kamera</button><button className={manualMode ? "selected" : ""} aria-pressed={manualMode} onClick={() => onManualModeChange(true)} type="button"><Icon name="keyboard" />Input manual</button></div>
      {manualMode ? <form className="card manual-panel" onSubmit={event => { event.preventDefault(); onReady(); }}>
        <div className="card-heading"><span className="card-icon"><Icon name="keyboard" /></span><div><h3>Ketik atau tempel barcode</h3><p>Gunakan saat barcode sulit dipindai.</p></div></div>
        <label htmlFor="manual-barcode">Barcode</label><input id="manual-barcode" aria-describedby="manual-help" value={manualBarcode} onChange={event => onBarcodeChange(event.target.value)} maxLength={256} disabled={pending} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Contoh: 8991234567890" />
        <p id="manual-help" className="field-help">Maksimal 256 karakter. Dikirim ke desktop yang terhubung.</p>
        <button className="primary" disabled={pending || !manualBarcode.trim()} type="submit">{pending ? <><Icon name="refresh" className="spinning" />Menunggu konfirmasi…</> : <>Kirim ke komputer<Icon name="arrow" /></>}</button>
      </form> : <div className="camera-frame" data-active={active} onPointerDown={event => { if ((event.target as HTMLElement).closest("button")) return; swipeStartY.current = event.clientY; }} onPointerUp={event => {
        const start = swipeStartY.current; swipeStartY.current = null;
        if (start === null || !torchSupported || !active) return;
        const delta = event.clientY - start;
        if (Math.abs(delta) >= 45 && (delta < 0) !== torchEnabled) onTorchToggle();
      }} onPointerCancel={() => { swipeStartY.current = null; }}>
        <video ref={videoRef} className="camera-video" muted playsInline aria-label="Pratinjau kamera scanner barcode" />
        <div className="camera-tools"><span className="camera-state" data-state={active ? "active" : "idle"}><span className="status-dot" />{active ? "Kamera aktif" : pausedForRest ? "Ponsel diam" : pausedForInactivity ? "Hemat baterai" : error ? "Kamera belum aktif" : "Menyiapkan"}</span><button className="camera-torch" data-active={torchEnabled} disabled={!active || !torchSupported} onClick={onTorchToggle} aria-pressed={torchEnabled} aria-label={torchEnabled ? "Matikan senter" : "Nyalakan senter"} title={torchSupported ? "Nyalakan atau matikan senter" : "Senter tidak tersedia pada kamera ini"} type="button"><Icon name="flash" /></button></div>
        {active && <><div className="scan-guide" aria-hidden="true"><i /><i /><i /><i /><span className="scan-line" /></div><div className="camera-caption"><strong>Sejajarkan barcode dalam bingkai</strong><span>EAN · CODE128 · QR</span></div></>}
        {!active && <div className="camera-placeholder"><Icon name={error ? "alert" : "camera"} /><strong>{error ? "Kamera belum dapat dipakai" : pausedForRest ? "Kamera berhenti" : pausedForInactivity ? "Kamera dijeda" : "Menyiapkan kamera"}</strong><p>{error ? "Izinkan akses kamera di browser atau gunakan input manual." : pausedForRest ? "Ponsel terdeteksi diam di permukaan. Kamera menyala lagi otomatis saat ponsel diangkat." : pausedForInactivity ? "Tidak ada scan selama 10 detik. Aktifkan kembali saat siap." : "Izinkan akses kamera untuk mulai memindai barcode."}</p>{(pausedForRest || pausedForInactivity || error) && <button className="camera-resume" onClick={onResumeCamera} type="button">{error ? "Coba kamera lagi" : "Nyalakan kamera"}</button>}</div>}
        {toast && <span className="camera-toast" data-state={toastTone} role="status">{toast}</span>}
      </div>}
      {error && !manualMode && <p className="error-message" role="alert">{error}</p>}
      <section className="card scan-result" data-state={resultState} aria-labelledby="last-scan-heading" aria-live="polite">
        <div className="result-heading"><h3 id="last-scan-heading">Scan terakhir</h3><span className="result-badge" data-state={resultState}>{pending ? <Icon name="refresh" className="spinning" /> : scanOutcome?.state === "success" ? <Icon name="check" /> : scanOutcome?.state === "error" ? <Icon name="alert" /> : null}{pending ? "Menunggu" : scanOutcome?.state === "success" ? "Berhasil diketik" : scanOutcome?.state === "error" ? "Perlu diperiksa" : "Belum ada scan"}</span></div>
        <strong className="last-barcode">{scanOutcome?.barcode || barcode || "—"}</strong>
        <p className="result-message">{scanOutcome?.message || "Hasil scan muncul setelah barcode terbaca."}{time && !Number.isNaN(time.getTime()) && <time dateTime={scanOutcome?.timestamp}>{time.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</time>}</p>
      </section>
      <p className="destination-note"><Icon name="monitor" />Pilih kolom tujuan di komputer sebelum memindai.</p>
    </section>
  );
}
