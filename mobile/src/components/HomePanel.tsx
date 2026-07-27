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
        <h2>Your phone is the scanner.</h2>
        <p>Enter the six-character code shown in ScanBridge Desktop.</p>
      </section>
      <section className="pairing-panel">
        <label className="label" htmlFor="pairing-code">
          pairing_code
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
      <p className="privacy-note">[+] Direct realtime relay &middot; no barcode storage</p>
    </>
  );
}

export default HomePanel;
