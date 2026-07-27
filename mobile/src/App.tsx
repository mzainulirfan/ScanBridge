import { useScannerSession } from "./hooks/useScannerSession";
import HomePanel from "./components/HomePanel";
import ScannerPanel from "./components/ScannerPanel";
import SessionStatusPill from "./components/SessionStatusPill";
import { useBarcodeScanner } from "./hooks/useBarcodeScanner";

function App() {
  const {
    screen,
    updateSessionId,
    connectWithCode,
    pairingCode,
    status,
    barcode,
    setBarcode,
    lastAck,
    submitScan,
    reconnect
  } = useScannerSession();
  const scanner = useBarcodeScanner({
    enabled: screen === "scanner",
    onScan: (result) => {
      void submitScan(result.barcode);
    }
  });

  return (
    <main className="app-shell">
      <header className="header">
        <div>
          <div className="eyebrow">ScanBridge</div>
          <h1>Turn Your Smartphone into a Barcode Scanner</h1>
        </div>
        <SessionStatusPill state={status} />
      </header>

      {screen === "home" && (
        <HomePanel pairingCode={pairingCode} onPairingCodeChange={updateSessionId} onConnect={connectWithCode} />
      )}

      {screen === "scanner" && (
        <ScannerPanel
          status={status}
          barcode={barcode}
          lastAck={lastAck}
          active={scanner.active}
          error={scanner.error}
          videoRef={scanner.videoRef}
          onBarcodeChange={setBarcode}
          onReconnect={() => {
            void reconnect();
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
