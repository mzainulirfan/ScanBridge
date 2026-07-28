import { useEffect, useState } from "react";
import { useScannerSession } from "./hooks/useScannerSession";
import HomePanel from "./components/HomePanel";
import ScannerPanel from "./components/ScannerPanel";
import SessionStatusPill from "./components/SessionStatusPill";
import { useBarcodeScanner } from "./hooks/useBarcodeScanner";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function App() {
  const {
    screen,
    updateSessionId,
    connectWithCode,
    pairingCode,
    status,
    barcode,
    manualBarcode,
    setBarcode,
    setManualBarcode,
    lastAck,
    submitScan,
    reconnect,
    disconnect
  } = useScannerSession();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);
  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };
  const scanner = useBarcodeScanner({
    enabled: screen === "scanner",
    onScan: (result) => {
      void submitScan(result.barcode);
    }
  });

  return (
    <main className={`app-shell ${screen === "scanner" ? "scanner-mode" : ""}`}>
      <header className="header">
        <div className="brand">
          <span className="brand-mark">[SB]</span>
          <div>
            <h1>ScanBridge</h1>
            <p>mobile scanner / live relay</p>
          </div>
        </div>
        <SessionStatusPill state={status} />
      </header>
      {installPrompt && screen === "home" && (
        <aside className="install-banner">
          <span>Pasang ScanBridge di layar utama.</span>
          <button className="primary" onClick={() => void install()} type="button">
            [pasang]
          </button>
        </aside>
      )}

      {screen === "home" && (
        <HomePanel pairingCode={pairingCode} onPairingCodeChange={updateSessionId} onConnect={connectWithCode} />
      )}

      {screen === "scanner" && (
        <ScannerPanel
          status={status}
          barcode={barcode}
          manualBarcode={manualBarcode}
          lastAck={lastAck}
          active={scanner.active}
          error={scanner.error}
          videoRef={scanner.videoRef}
          onBarcodeChange={setManualBarcode}
          onReconnect={() => {
            void reconnect();
          }}
          onDisconnect={() => {
            void disconnect();
          }}
          onSubmitScan={(value) => {
            void submitScan(value);
          }}
        />
      )}
    </main>
  );
}

export default App;
