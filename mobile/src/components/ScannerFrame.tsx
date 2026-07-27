type ScannerFrameProps = {
  status: string;
  lastScan: string;
  active: boolean;
  error?: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  onBarcodeChange: (value: string) => void;
  onReconnect: () => void;
  onReady: () => void;
};

function ScannerFrame({
  status,
  lastScan,
  active,
  error,
  videoRef,
  onBarcodeChange,
  onReconnect,
  onReady
}: ScannerFrameProps) {
  return (
    <section className="scanner">
      <div className="scanner-heading">
        <span className="section-label">[camera input]</span>
        <span className={active ? "live-indicator active" : "live-indicator"}>
          {active ? "live" : "starting"}
        </span>
      </div>
      <div className="camera-frame">
        <video ref={videoRef} className="camera-video" muted playsInline />
        <div className="scan-guide" aria-hidden="true">
          <span />
        </div>
        {!active && <div className="camera-placeholder">initializing camera...</div>}
      </div>
      {error && (
        <div className="error-box" role="alert">
          [!] {error}
        </div>
      )}
      <div className="scan-meta">
        <div>
          <span>connection</span>
          <strong>{status}</strong>
        </div>
        <div>
          <span>last_scan</span>
          <strong>{lastScan || "waiting..."}</strong>
        </div>
      </div>
      <div className="manual-row">
        <input
          aria-label="Manual barcode"
          value={lastScan}
          onChange={(event) => onBarcodeChange(event.target.value)}
          placeholder="manual barcode"
        />
        <button className="primary" onClick={onReady} type="button">
          [send]
        </button>
      </div>
      <div className="action-row">
        <button className="secondary" onClick={onReconnect} type="button">
          [reconnect relay]
        </button>
      </div>
    </section>
  );
}

export default ScannerFrame;
