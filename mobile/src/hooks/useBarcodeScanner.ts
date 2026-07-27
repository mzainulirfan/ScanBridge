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
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanAtRef = useRef(0);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (controlsRef.current) {
      return;
    }

    let cancelled = false;
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }

    void readerRef.current
      .decodeFromVideoDevice(
        undefined,
        video,
        (result: { getText: () => string; getBarcodeFormat: () => { toString: () => string } } | undefined) => {
          if (!result || cancelled) {
            return;
          }

          const now = Date.now();
          if (now - lastScanAtRef.current < cooldownMs) {
            return;
          }

          lastScanAtRef.current = now;
          onScanRef.current({
            barcode: result.getText(),
            symbology: result.getBarcodeFormat().toString()
          });
        }
      )
      .then((controls: IScannerControls) => {
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
  }, [cooldownMs, enabled, stop]);

  return {
    videoRef,
    active,
    error,
    stop
  };
}
