type HomePanelProps = {
  pairingCode: string;
  onPairingCodeChange: (value: string) => void;
  onConnect: () => void;
};

function HomePanel({ pairingCode, onPairingCodeChange, onConnect }: HomePanelProps) {
  return (
    <>
      <section className="intro">
        <span className="section-label">[pair device]</span>
        <h2>Ponsel Anda menjadi scanner.</h2>
        <p>Masukkan kode 6 karakter dari ScanBridge Desktop.</p>
      </section>
      <section className="pairing-panel">
        <label className="label" htmlFor="pairing-code">
          kode pairing
        </label>
        <input
          id="pairing-code"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          placeholder="123 456"
          value={pairingCode}
          onChange={(event) => onPairingCodeChange(event.target.value)}
        />
        <button className="primary" onClick={onConnect} type="button">
          [connect]
        </button>
      </section>
      <p className="privacy-note">[+] Relay realtime langsung &middot; barcode tidak disimpan</p>
    </>
  );
}

export default HomePanel;
