import ScannerFrame from "./ScannerFrame";
import type { RefObject } from "react";

type ScannerPanelProps = {
  barcode: string;
  manualBarcode: string;
  active: boolean;
  error?: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  torchSupported: boolean;
  torchEnabled: boolean;
  onBarcodeChange: (value: string) => void;
  onTorchToggle: () => void;
  onReconnect: () => void;
  onDisconnect: () => void;
  onSubmitScan: (value: string) => Promise<boolean>;
};

function ScannerPanel({
  barcode,
  manualBarcode,
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
        onReady={() => {
          void onSubmitScan(manualBarcode).then((success) => {
            if (success) onBarcodeChange("");
          });
        }}
      />
    </>
  );
}

export default ScannerPanel;
