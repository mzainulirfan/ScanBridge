import ScannerFrame from "./ScannerFrame";
import type { RefObject } from "react";

type ScannerPanelProps = {
  status: string;
  barcode: string;
  manualBarcode: string;
  lastAck: string;
  active: boolean;
  error?: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  torchSupported: boolean;
  torchEnabled: boolean;
  onBarcodeChange: (value: string) => void;
  onTorchToggle: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onSubmitScan: (value: string) => void;
};

function ScannerPanel({
  status,
  barcode,
  manualBarcode,
  lastAck,
  active,
  error,
  videoRef,
  torchSupported,
  torchEnabled,
  onBarcodeChange,
  onTorchToggle,
  onReconnect,
  onDisconnect,
  onSubmitScan
}: ScannerPanelProps) {
  return (
    <>
      <ScannerFrame
        status={status}
        lastScan={barcode}
        manualBarcode={manualBarcode}
        active={active}
        error={error}
        videoRef={videoRef}
        torchSupported={torchSupported}
        torchEnabled={torchEnabled}
        onBarcodeChange={onBarcodeChange}
        onTorchToggle={onTorchToggle}
        onReconnect={onReconnect}
        onDisconnect={onDisconnect}
        onReady={() => onSubmitScan(barcode)}
      />
      <section className="ack-panel" aria-live="polite">
        <span>status relay</span>
        <p>{lastAck || "Menunggu scan pertama."}</p>
      </section>
    </>
  );
}

export default ScannerPanel;
