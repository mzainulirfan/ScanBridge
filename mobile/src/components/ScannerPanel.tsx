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
        onReady={() => onSubmitScan(barcode)}
        onFlashToggle={() => onSubmitScan(barcode)}
      />
      <section className="panel">
        <label className="label">ACK</label>
        <div className="ack-box">{lastAck || "-"}</div>
      </section>
    </>
  );
}

export default ScannerPanel;
