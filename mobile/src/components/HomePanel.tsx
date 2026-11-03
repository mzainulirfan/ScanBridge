type HomePanelProps = {
  pairingCode: string;
  onPairingCodeChange: (value: string) => void;
  onConnect: (value?: string) => void;
  onResetPairing: () => void;
  pairingScanMode: boolean;
  pairingScanActive: boolean;
  pairingScanPaused: boolean;
  pairingScanError: string;
  pairingConnectionMessage: string;
  pairingVideoRef: RefObject<HTMLVideoElement>;
  onStartPairingScan: () => void;
  onCancelPairingScan: () => void;
  onResumePairingScan: () => void;
};

function HomePanel({
  pairingCode,
  onPairingCodeChange,
  onConnect,
  onResetPairing,
  pairingScanMode,
  pairingScanActive,
  pairingScanPaused,
  pairingScanError,
  pairingConnectionMessage,
  pairingVideoRef,
  onStartPairingScan,
  onCancelPairingScan,
  onResumePairingScan
}: HomePanelProps) {
  const pairingInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pairingScanMode) return;
    pairingInputRef.current?.focus();
    const focusTimer = window.setTimeout(() => pairingInputRef.current?.focus(), 120);
    return () => window.clearTimeout(focusTimer);
  }, [pairingScanMode]);

  return (
    <>
      <section className="intro">
        <span className="section-label">[pair device]</span>
        <h2>Ponsel Anda menjadi scanner.</h2>
        <p>Scan QR dari ScanBridge Desktop, atau masukkan kode pairing.</p>
      </section>
      <section className="pairing-panel">
        {!pairingScanMode && (
          <button className="primary pairing-scan-button" onClick={onStartPairingScan} type="button">
            [scan QR desktop]
          </button>
        )}
        {pairingScanMode && (
          <div className="pairing-camera">
            <video ref={pairingVideoRef} className="camera-video" muted playsInline aria-label="Kamera untuk scan QR pairing" />
            <div className="scan-guide pairing-scan-guide" aria-hidden="true"><span /></div>
            {!pairingScanActive && (
              <div className="camera-placeholder">
                {pairingScanPaused ? (
                  <button className="primary camera-resume" onClick={onResumePairingScan} type="button">[nyalakan kamera]</button>
                ) : "Meminta akses kamera..."}
              </div>
            )}
            <button className="secondary pairing-cancel" onClick={onCancelPairingScan} type="button">[batal]</button>
          </div>
        )}
        {pairingScanError && <p className="pairing-scan-error" role="alert">[!] {pairingScanError}</p>}
        {pairingConnectionMessage && (
          <p className="pairing-connection-message" role="status">{pairingConnectionMessage}</p>
        )}
        <label className="label" htmlFor="pairing-code">
          kode pairing
        </label>
        <div className="pairing-code-entry">
          <div className="pairing-code-block" aria-hidden="true">
            {formatPairingCode(pairingCode) || "-------- -------- -------- --------"}
          </div>
          <input
            id="pairing-code"
            ref={pairingInputRef}
            autoFocus
            inputMode="text"
            pattern="[A-Fa-f0-9]*"
            autoCapitalize="off"
            autoComplete="one-time-code"
            maxLength={32}
            value={pairingCode}
            onChange={(event) => {
              const value = event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32).toUpperCase();
              onPairingCodeChange(value);
              if (value.length === 32) onConnect(value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") onConnect();
            }}
            aria-label="Kode pairing 32 karakter"
          />
        </div>
        <div className="pairing-actions">
          <button className="primary" onClick={() => onConnect()} type="button">
            [connect]
          </button>
          {pairingCode && (
            <button className="secondary" onClick={onResetPairing} type="button">
              [reset kode]
            </button>
          )}
        </div>
      </section>
      <p className="privacy-note">[+] Relay realtime langsung &middot; barcode tidak disimpan</p>
    </>
  );
}

export default HomePanel;
import { useEffect, useRef, type RefObject } from "react";
import { formatPairingCode } from "../shared/contracts";
