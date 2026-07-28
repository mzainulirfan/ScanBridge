type HomePanelProps = {
  pairingCode: string;
  onPairingCodeChange: (value: string) => void;
  onConnect: () => void;
};

function HomePanel({ pairingCode, onPairingCodeChange, onConnect }: HomePanelProps) {
  const pairingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pairingInputRef.current?.focus();
  }, []);

  return (
    <>
      <section className="intro">
        <span className="section-label">[pair device]</span>
        <h2>Ponsel Anda menjadi scanner.</h2>
        <p>Masukkan 6 angka dari ScanBridge Desktop.</p>
      </section>
      <section className="pairing-panel">
        <label className="label" htmlFor="pairing-code">
          kode pairing
        </label>
        <input
          id="pairing-code"
          ref={pairingInputRef}
          inputMode="numeric"
          pattern="[0-9]*"
          autoCapitalize="off"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={pairingCode}
          onChange={(event) => onPairingCodeChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onConnect();
          }}
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
import { useEffect, useRef } from "react";
