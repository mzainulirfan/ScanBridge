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
    toast,
    realtimeConfigured,
    submitScan,
    reconnect,
    disconnect
  } = useScannerSession();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
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
    enabled: screen === "scanner" && realtimeConfigured,
    onScan: (result) => {
      void submitScan(result.barcode, result.symbology);
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
        <HomePanel
          pairingCode={pairingCode}
          onPairingCodeChange={updateSessionId}
          onConnect={connectWithCode}
          onResetPairing={() => setResetDialogOpen(true)}
        />
      )}

      {screen === "scanner" && (
        <ScannerPanel
          barcode={barcode}
          manualBarcode={manualBarcode}
          active={scanner.active}
          error={scanner.error}
          toast={toast}
          videoRef={scanner.videoRef}
          torchSupported={scanner.torchSupported}
          torchEnabled={scanner.torchEnabled}
          onBarcodeChange={setManualBarcode}
          onTorchToggle={() => void scanner.toggleTorch()}
          onReconnect={() => {
            void reconnect();
          }}
          onResetPairing={() => setResetDialogOpen(true)}
          onDisconnect={() => {
            void disconnect();
          }}
          onSubmitScan={(value) => {
            return submitScan(value);
          }}
        />
      )}
      {resetDialogOpen && (
        <div
          className="confirm-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setResetDialogOpen(false);
          }}
        >
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="reset-title">
            <div className="confirm-dialog-heading">
              <span className="confirm-marker" aria-hidden="true">[!]</span>
              <div>
                <h2 id="reset-title">Reset kode pairing?</h2>
                <p>Kode tersimpan akan dihapus dan aplikasi kembali ke halaman pairing.</p>
              </div>
            </div>
            <p className="confirm-dialog-note">Desktop tetap aktif dan dapat menerima kode baru.</p>
            <div className="confirm-dialog-actions">
              <button className="secondary" onClick={() => setResetDialogOpen(false)} type="button">
                [batal]
              </button>
              <button
                className="danger"
                onClick={() => {
                  setResetDialogOpen(false);
                  void disconnect();
                }}
                type="button"
              >
                [reset kode]
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
