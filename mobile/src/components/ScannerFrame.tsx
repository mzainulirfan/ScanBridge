type ScannerFrameProps = {
  status: string;
  lastScan: string;
  manualBarcode: string;
  active: boolean;
  error?: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  onBarcodeChange: (value: string) => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onReady: () => void;
};

function ScannerFrame({
  status,
  lastScan,
  manualBarcode,
  active,
  error,
  videoRef,
  onBarcodeChange,
  onReconnect,
  onDisconnect,
  onReady
}: ScannerFrameProps) {
  return (
    <section className="scanner">
      <div className="scanner-heading">
        <span className="section-label">[kamera scanner]</span>
        <span className={active ? "live-indicator active" : "live-indicator"}>
          {active ? "aktif" : "menyiapkan"}
        </span>
      </div>
      <div className="camera-frame">
        <video
          ref={videoRef}
          className="camera-video"
          muted
          playsInline
          aria-label="Pratinjau kamera scanner barcode"
        />
        <div className="scan-guide" aria-hidden="true">
          <span />
        </div>
        {!active && <div className="camera-placeholder">Meminta akses kamera...</div>}
      </div>
      {error && (
        <div className="error-box" role="alert">
          [!] Kamera belum siap: {error}
        </div>
      )}
      <div className="scan-meta">
        <div>
          <span>koneksi</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>scan terakhir</span>
          <strong>{lastScan || "menunggu..."}</strong>
        </div>
      </div>
      <div className="manual-row">
        <input
          aria-label="Barcode manual"
          value={manualBarcode}
          onChange={(event) => onBarcodeChange(event.target.value)}
          placeholder="barcode manual"
        />
        <button className="primary" onClick={onReady} type="button">
          [kirim]
        </button>
      </div>
      <div className="action-row">
        <button className="secondary" onClick={onReconnect} type="button">
          [sambungkan ulang]
        </button>
        <button className="danger" onClick={onDisconnect} type="button">
          [putuskan]
        </button>
      </div>
    </section>
  );
}

export default ScannerFrame;
