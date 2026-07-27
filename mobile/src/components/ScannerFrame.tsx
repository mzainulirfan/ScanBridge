type ScannerFrameProps = {
  status: string;
  lastScan: string;
  active: boolean;
  error?: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  onBarcodeChange: (value: string) => void;
  onReconnect: () => void;
  onReady: () => void;
  onFlashToggle?: () => void;
};

function ScannerFrame({
  status,
  lastScan,
  active,
  error,
  videoRef,
  onBarcodeChange,
  onReconnect,
  onReady,
  onFlashToggle
}: ScannerFrameProps) {
  return (
    <section className="panel scanner">
      <div className="camera-frame">
        <video ref={videoRef} className="camera-video" muted playsInline />
        {!active && <div className="camera-placeholder">Camera preview</div>}
      </div>
      <div className="meta-row">
        <span className="label">Status</span>
        <span>{status}</span>
      </div>
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="meta-row">
        <span className="label">Last scan</span>
        <span>{lastScan || "-"}</span>
      </div>
      <label className="label">Last scan payload</label>
      <input value={lastScan} onChange={(event) => onBarcodeChange(event.target.value)} placeholder="Barcode" />
      <div className="row">
        <button className="secondary" onClick={onFlashToggle} type="button">
          Flash
        </button>
        <button className="secondary" onClick={onReconnect} type="button">
          Reconnect
        </button>
        <button className="primary" onClick={onReady} type="button">
          Ready
        </button>
      </div>
    </section>
  );
}

export default ScannerFrame;
