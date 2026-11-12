import { useEffect, useRef, useState } from "react";
import { useScannerSession } from "./hooks/useScannerSession";
import HomePanel from "./components/HomePanel";
import ScannerPanel from "./components/ScannerPanel";
import SessionStatusPill from "./components/SessionStatusPill";
import Modal from "./components/Modal";
import Icon from "./components/Icon";
import { useBarcodeScanner } from "./hooks/useBarcodeScanner";
import { getPairingCodeFromScan } from "./lib/session";
import { formatPairingCode } from "./shared/contracts";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export default function App() {
  const { screen, updateSessionId, connectWithCode, pairingCode, pairingPending, pairingSaved, status,
    lastAck, barcode, scanOutcome, manualBarcode, setManualBarcode, toast, toastTone, realtimeConfigured,
    submitScan, reconnect, disconnect } = useScannerSession();
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [pairingScanMode, setPairingScanMode] = useState(false);
  const [pairingScanError, setPairingScanError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [uiNotice, setUiNotice] = useState("");
  const pairingScanLocked = useRef(false);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);
  useEffect(() => {
    if (screen !== "scanner") { setManualMode(false); setConnectionOpen(false); }
  }, [screen]);
  const scanner = useBarcodeScanner({
    enabled: !resetDialogOpen && !connectionOpen && ((screen === "scanner" && realtimeConfigured && !manualMode) || pairingScanMode),
    idleTimeoutMs: 10_000,
    onScan: result => {
      if (pairingScanMode) {
        if (pairingScanLocked.current) return;
        const code = getPairingCodeFromScan(result.barcode);
        if (!code) { setPairingScanError("QR ini bukan QR pairing ScanBridge. Gunakan QR pada halaman Ringkasan desktop."); return; }
        pairingScanLocked.current = true;
        setPairingScanMode(false);
        setPairingScanError("");
        updateSessionId(code);
        connectWithCode(result.barcode);
        return;
      }
      if (scanOutcome?.state !== "pending") void submitScan(result.barcode, result.symbology);
    }
  });
  const resetPairing = () => {
    setResetDialogOpen(false); setConnectionOpen(false); setPairingScanMode(false); setUiNotice("");
    void disconnect().catch(() => setUiNotice("Pairing lokal sudah dihapus. Pastikan koneksi tersedia saat menghubungkan kembali."));
  };

  return (
    <main className={`app-shell ${screen === "scanner" ? "scanner-mode" : "home-mode"}`}>
      <header className="header"><div className="brand"><span className="brand-mark"><Icon name="brand" /></span><div><h1>ScanBridge<span className="brand-mobile">Mobile</span></h1><p>Scanner ponsel, langsung ke komputer.</p></div></div><SessionStatusPill state={status} /></header>
      {uiNotice && <p className="ui-notice" role="status">{uiNotice}</p>}
      {screen !== "scanner" ? <>
        <HomePanel pairingCode={pairingCode} status={status} busy={pairingPending} pairingSaved={pairingSaved} configured={realtimeConfigured} onPairingCodeChange={updateSessionId} onConnect={() => { if (pairingSaved) void reconnect(); else connectWithCode(); }} onResetPairing={() => setResetDialogOpen(true)} onCancelConnect={resetPairing} pairingScanMode={pairingScanMode} pairingScanActive={scanner.active} pairingScanPaused={scanner.pausedForInactivity} pairingScanError={pairingScanMode ? pairingScanError || scanner.error || "" : ""} pairingConnectionMessage={lastAck} pairingVideoRef={scanner.videoRef} onStartPairingScan={() => { pairingScanLocked.current = false; setPairingScanError(""); setPairingScanMode(true); scanner.resume(); }} onCancelPairingScan={() => setPairingScanMode(false)} onResumePairingScan={scanner.resume} />
        {installPrompt && <aside className="install-banner"><span className="card-icon"><Icon name="download" /></span><div><strong>Lebih cepat dari layar utama</strong><p>Pasang ScanBridge tanpa membuka tab baru.</p></div><button className="secondary" type="button" onClick={() => { void installPrompt.prompt().then(() => setInstallPrompt(null)).catch(() => setUiNotice("Pemasangan belum berhasil. Coba kembali dari menu browser.")); }}>Pasang</button></aside>}
        <footer className="app-footer"><span>ScanBridge Mobile</span><span>Terhubung melalui internet</span></footer>
      </> : <ScannerPanel barcode={barcode} scanOutcome={scanOutcome} manualBarcode={manualBarcode} manualMode={manualMode} active={scanner.active} pausedForInactivity={scanner.pausedForInactivity} error={scanner.error} toast={toast} toastTone={toastTone} videoRef={scanner.videoRef} torchSupported={scanner.torchSupported} torchEnabled={scanner.torchEnabled} onBarcodeChange={setManualBarcode} onTorchToggle={() => void scanner.toggleTorch()} onResumeCamera={scanner.resume} onManageConnection={() => { setCopyMessage(""); setConnectionOpen(true); }} onManualModeChange={setManualMode} onSubmitScan={submitScan} />}
      {connectionOpen && <Modal title="Koneksi perangkat" eyebrow="DESKTOP & PAIRING" id="connection-title" onClose={() => setConnectionOpen(false)}>
        <div className="sheet-connection"><Icon name="monitor" /><div><strong>{status}</strong><p>Hasil scan diketik ke kolom aktif di komputer.</p></div><span className="status-dot" /></div>
        <div className="saved-pairing"><span className="eyebrow">KODE PAIRING</span><code>{formatPairingCode(pairingCode)}</code><button className="text-button" type="button" onClick={async () => { try { await navigator.clipboard.writeText(pairingCode); setCopyMessage("Kode pairing disalin."); } catch { setCopyMessage("Kode belum dapat disalin. Gunakan kode yang tampil di atas."); } }}>Salin kode</button>{copyMessage && <p role="status">{copyMessage}</p>}</div>
        <p className="muted-text">Pairing dipertahankan saat koneksi terputus. Membuka kembali aplikasi akan mencoba menyambungkan perangkat yang sama.</p>
        <button className="secondary" type="button" onClick={() => { setConnectionOpen(false); void reconnect(); }}><Icon name="refresh" />Sambungkan ulang</button>
        <button className="text-button danger-text" type="button" onClick={() => { setConnectionOpen(false); setResetDialogOpen(true); }}>Putus &amp; reset pairing</button>
      </Modal>}
      {resetDialogOpen && <Modal title="Putus dan reset pairing?" eyebrow="KONEKSI PERANGKAT" id="reset-title" onClose={() => setResetDialogOpen(false)}><p className="modal-description">Ponsel akan terputus dan kode pairing yang tersimpan di sini akan dihapus. Untuk tersambung lagi, pindai QR terbaru dari desktop.</p><div className="dialog-actions"><button className="secondary" autoFocus type="button" onClick={() => setResetDialogOpen(false)}>Batal</button><button className="danger" type="button" onClick={resetPairing}>Putus &amp; reset</button></div></Modal>}
    </main>
  );
}
