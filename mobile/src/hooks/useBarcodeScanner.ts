import type { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult } from "../lib/scanner";

type UseBarcodeScannerOptions = {
  enabled: boolean;
  cooldownMs?: number;
  onScan: (result: ScanResult) => void;
};

function getVideoTrack(video: HTMLVideoElement | null): MediaStreamTrack | null {
  const stream = video?.srcObject instanceof MediaStream ? video.srcObject : null;
  return stream?.getVideoTracks()[0] ?? null;
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 }
  }
};

export function useBarcodeScanner({ enabled, cooldownMs = 800, onScan }: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanAtRef = useRef(0);
  const lastBarcodeRef = useRef("");
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
    setTorchEnabled(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = getVideoTrack(videoRef.current);
    if (!track || !torchSupported) {
      setError("Senter tidak didukung oleh kamera ini.");
      return;
    }
    try {
      const nextEnabled = !torchEnabled;
      await track.applyConstraints({
        advanced: [{ torch: nextEnabled } as MediaTrackConstraintSet]
      });
      setTorchEnabled(nextEnabled);
      setError(null);
    } catch {
      setError("Senter tidak dapat diubah pada perangkat ini.");
    }
  }, [torchEnabled, torchSupported]);

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
    void (async () => {
      if (!readerRef.current) {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library")
        ]);
        if (cancelled) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_8,
          BarcodeFormat.EAN_13,
          BarcodeFormat.CODE_128,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.QR_CODE
        ]);
        readerRef.current = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: 20,
          delayBetweenScanSuccess: 40
        });
      }

      const controls = await readerRef.current.decodeFromConstraints(
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
      );
      if (cancelled) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setActive(true);
      const track = getVideoTrack(video);
      const capabilities = track?.getCapabilities?.() as
        | (MediaTrackCapabilities & { torch?: boolean })
        | undefined;
      setTorchSupported(Boolean(capabilities?.torch));
      setError(null);
    })().catch((scanError: unknown) => {
      if (!cancelled) {
        setActive(false);
        setError(scanError instanceof Error ? scanError.message : "Camera scanner failed");
      }
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
    stop,
    torchSupported,
    torchEnabled,
    toggleTorch
  };
}
