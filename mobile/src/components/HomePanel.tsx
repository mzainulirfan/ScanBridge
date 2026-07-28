type HomePanelProps = {
  pairingCode: string;
  onPairingCodeChange: (value: string) => void;
  onConnect: (value?: string) => void;
};

function HomePanel({ pairingCode, onPairingCodeChange, onConnect }: HomePanelProps) {
  const pairingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pairingInputRef.current?.focus();
    const focusTimer = window.setTimeout(() => pairingInputRef.current?.focus(), 120);
    return () => window.clearTimeout(focusTimer);
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
        <div className="pairing-code-entry">
          <div className="pairing-code-block" aria-hidden="true">
            {pairingCode.slice(0, 3).padEnd(3, "-")}
          </div>
          <div className="pairing-code-block" aria-hidden="true">
            {pairingCode.slice(3, 6).padEnd(3, "-")}
          </div>
          <input
            id="pairing-code"
            ref={pairingInputRef}
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            autoCapitalize="off"
            autoComplete="one-time-code"
            maxLength={6}
            value={pairingCode}
            onChange={(event) => {
              const value = event.target.value.replace(/\D/g, "").slice(0, 6);
              onPairingCodeChange(value);
              if (value.length === 6) onConnect(value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") onConnect();
            }}
            aria-label="Kode pairing 6 digit"
          />
        </div>
        <button className="primary" onClick={() => onConnect()} type="button">
          [connect]
        </button>
      </section>
      <p className="privacy-note">[+] Relay realtime langsung &middot; barcode tidak disimpan</p>
    </>
  );
}

export default HomePanel;
import { useEffect, useRef } from "react";
