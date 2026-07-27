import ScannerFrame from "./ScannerFrame";
import type { RefObject } from "react";

type ScannerPanelProps = {
  status: string;
  barcode: string;
  lastAck: string;
  active: boolean;
  error?: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  onBarcodeChange: (value: string) => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onSubmitScan: (value: string) => void;
};

function ScannerPanel({
  status,
  barcode,
  lastAck,
  active,
  error,
  videoRef,
  onBarcodeChange,
  onReconnect,
  onDisconnect,
  onSubmitScan
}: ScannerPanelProps) {
  return (
    <>
      <ScannerFrame
        status={status}
        lastScan={barcode}
        active={active}
        error={error}
        videoRef={videoRef}
        onBarcodeChange={onBarcodeChange}
        onReconnect={onReconnect}
        onDisconnect={onDisconnect}
        onReady={() => onSubmitScan(barcode)}
      />
      <section className="ack-panel" aria-live="polite">
        <span>relay_ack</span>
        <p>{lastAck || "Waiting for first scan."}</p>
      </section>
    </>
  );
}

export default ScannerPanel;
