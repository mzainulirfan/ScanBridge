type ScannerFrameProps = {
  lastScan: string;
  manualBarcode: string;
  active: boolean;
  error?: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  torchSupported: boolean;
  torchEnabled: boolean;
  onBarcodeChange: (value: string) => void;
  onTorchToggle: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onReady: () => void;
};

function ScannerFrame({
  lastScan,
  manualBarcode,
  active,
  error,
  videoRef,
  torchSupported,
  torchEnabled,
  onBarcodeChange,
  onTorchToggle,
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
        <button
          className={torchEnabled ? "camera-torch active" : "camera-torch"}
          disabled={!active || !torchSupported}
          onClick={onTorchToggle}
          aria-pressed={torchEnabled}
          title={torchSupported ? "Nyalakan atau matikan senter" : "Senter tidak didukung kamera ini"}
          type="button"
        >
          {torchEnabled ? "[matikan senter]" : "[nyalakan senter]"}
        </button>
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
