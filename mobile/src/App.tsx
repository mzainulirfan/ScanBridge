import { useScannerSession } from "./hooks/useScannerSession";
import ConnectPanel from "./components/ConnectPanel";
import HomePanel from "./components/HomePanel";
import ScannerPanel from "./components/ScannerPanel";
import SessionStatusPill from "./components/SessionStatusPill";
import { useBarcodeScanner } from "./hooks/useBarcodeScanner";

function App() {
  const {
    screen,
    setScreen,
    sessionId,
    setSessionId,
    status,
    barcode,
    setBarcode,
    lastAck,
    connectUrl,
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

      {screen === "home" && <HomePanel connectUrl={connectUrl} onScanPairing={() => setScreen("connect")} />}

      {screen === "connect" && (
        <ConnectPanel
          sessionId={sessionId}
          onSessionChange={setSessionId}
          onConnect={() => setScreen("scanner")}
        />
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
