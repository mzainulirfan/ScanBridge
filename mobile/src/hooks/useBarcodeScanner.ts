import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult } from "../lib/scanner";

type UseBarcodeScannerOptions = {
  enabled: boolean;
  cooldownMs?: number;
  onScan: (result: ScanResult) => void;
};

export function useBarcodeScanner({ enabled, cooldownMs = 800, onScan }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanAtRef = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    if (!enabled || !videoRef.current) {
      stop();
      return;
    }

    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    void reader
      .decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" }
          },
          audio: false
        },
        videoRef.current,
        (result) => {
          if (!result || cancelled) {
            return;
          }

          const now = Date.now();
          if (now - lastScanAtRef.current < cooldownMs) {
            return;
          }

          lastScanAtRef.current = now;
          onScan({
            barcode: result.getText(),
            symbology: result.getBarcodeFormat().toString()
          });
        }
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setActive(true);
        setError(null);
      })
      .catch((scanError: unknown) => {
        setActive(false);
        setError(scanError instanceof Error ? scanError.message : "Camera scanner failed");
      });

    return () => {
      cancelled = true;
      stop();
    };
  }, [cooldownMs, enabled, onScan, stop]);

  return {
    videoRef,
    active,
    error,
    stop
  };
}
