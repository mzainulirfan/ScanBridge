type HomePanelProps = {
  connectUrl: string;
  onScanPairing: () => void;
};

function HomePanel({ connectUrl, onScanPairing }: HomePanelProps) {
  return (
    <section className="panel">
      <p className="text">Desktop session siap. Buka link pairing dari QR, lalu scanner akan langsung aktif di sini.</p>
      <div className="qr-frame" aria-label="QR pairing placeholder">
        <div className="qr-inner">
          <span>QR Pairing</span>
          <small>{connectUrl}</small>
        </div>
      </div>
      <div className="link-box">{connectUrl}</div>
      <button className="primary" onClick={onScanPairing} type="button">
        Scan QR Pairing
      </button>
    </section>
  );
}

export default HomePanel;
