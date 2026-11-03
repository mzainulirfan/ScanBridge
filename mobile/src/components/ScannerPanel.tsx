import ScannerFrame, { type ScannerFrameProps } from "./ScannerFrame";

type ScannerPanelProps = Omit<ScannerFrameProps, "onReady"> & {
  onSubmitScan: (value: string) => Promise<boolean>;
};

export default function ScannerPanel({ onSubmitScan, ...props }: ScannerPanelProps) {
  return <ScannerFrame {...props} onReady={() => {
    void onSubmitScan(props.manualBarcode).then(success => {
      if (success) props.onBarcodeChange("");
    });
  }} />;
}