import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult } from "../lib/scanner";

type UseBarcodeScannerOptions = {
  enabled: boolean;
  cooldownMs?: number;
  onScan: (result: ScanResult) => void;
};

const SCAN_FORMATS = [
  BarcodeFormat.EAN_8,
  BarcodeFormat.EAN_13,
  BarcodeFormat.CODE_128,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.QR_CODE
];

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  }
};

export function useBarcodeScanner({ enabled, cooldownMs = 250, onScan }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanAtRef = useRef(0);
  const lastBarcodeRef = useRef("");
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
      const hints = new Map<DecodeHintType, BarcodeFormat[]>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, SCAN_FORMATS);
      readerRef.current = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 20,
        delayBetweenScanSuccess: 40
      });
    }

    void readerRef.current
      .decodeFromConstraints(
        CAMERA_CONSTRAINTS,
        video,
        (result: { getText: () => string; getBarcodeFormat: () => { toString: () => string } } | undefined) => {
          if (!result || cancelled) {
            return;
          }

          const now = Date.now();
          const barcode = result.getText();
          if (barcode === lastBarcodeRef.current && now - lastScanAtRef.current < cooldownMs) {
            return;
          }

          lastBarcodeRef.current = barcode;
          lastScanAtRef.current = now;
          onScanRef.current({
            barcode,
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
