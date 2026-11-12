import type { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult } from "../lib/scanner";
import { useLiftDetection } from "./useLiftDetection";

type UseBarcodeScannerOptions = {
  enabled: boolean;
  cooldownMs?: number;
  idleTimeoutMs?: number;
  onScan: (result: ScanResult) => void;
};

type CameraPauseReason = "none" | "inactivity" | "resting" | "dark";

function getVideoTrack(video: HTMLVideoElement | null): MediaStreamTrack | null {
  const stream = video?.srcObject instanceof MediaStream ? video.srcObject : null;
  return stream?.getVideoTracks()[0] ?? null;
}

const DARK_SAMPLE_WIDTH = 32;
const DARK_SAMPLE_HEIGHT = 24;
const DARK_SAMPLE_INTERVAL_MS = 400;
/** Ignore the first frames while the camera exposure settles. */
const DARK_GRACE_MS = 1600;
/** Darkness must persist this long before the camera is paused. */
const DARK_SETTLE_MS = 2000;
/** Mean luma (0–255) at or below which the frame looks covered. */
const DARK_MEAN_LUMA = 14;
/** Luma spread allowed for a covered lens; a dim room still shows variance. */
const DARK_MAX_DEVIATION = 9;
/** Share of clearly bright pixels allowed before the frame counts as lit. */
const DARK_MAX_BRIGHT_RATIO = 0.01;

/**
 * A camera covered by a hand, a pocket, or a desk shows an almost uniformly black
 * frame. Measuring brightness alone is not enough because a dim room is also dark,
 * so the spread of luma values is checked as well.
 */
function isFrameCovered(context: CanvasRenderingContext2D): boolean {
  const { data } = context.getImageData(0, 0, DARK_SAMPLE_WIDTH, DARK_SAMPLE_HEIGHT);
  const pixels = data.length / 4;
  let sum = 0;
  let sumOfSquares = 0;
  let bright = 0;
  for (let index = 0; index < data.length; index += 4) {
    const luma = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
    sum += luma;
    sumOfSquares += luma * luma;
    if (luma > 48) bright += 1;
  }
  const mean = sum / pixels;
  const deviation = Math.sqrt(Math.max(0, sumOfSquares / pixels - mean * mean));
  return (
    mean <= DARK_MEAN_LUMA &&
    deviation <= DARK_MAX_DEVIATION &&
    bright / pixels <= DARK_MAX_BRIGHT_RATIO
  );
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 30 }
  }
};

export function useBarcodeScanner({
  enabled,
  cooldownMs = 800,
  idleTimeoutMs = 10_000,
  onScan
}: UseBarcodeScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanAtRef = useRef(0);
  const lastBarcodeRef = useRef("");
  const onScanRef = useRef(onScan);
  const idleTimerRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const [pauseReason, setPauseReason] = useState<CameraPauseReason>("none");
  const pauseReasonRef = useRef<CameraPauseReason>("none");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
    setTorchEnabled(false);
  }, []);

  const setPause = useCallback((reason: CameraPauseReason) => {
    pauseReasonRef.current = reason;
    setPauseReason(reason);
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetIdleTimer = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      if (pauseReasonRef.current === "none") setPause("inactivity");
    }, idleTimeoutMs);
  }, [clearIdleTimer, idleTimeoutMs, setPause]);

  const resume = useCallback(() => {
    setError(null);
    setPause("none");
    setCameraAttempt(attempt => attempt + 1);
    resetIdleTimer();
  }, [resetIdleTimer, setPause]);

  const lift = useLiftDetection({
    enabled,
    onRest: useCallback(() => {
      if (pauseReasonRef.current !== "resting") setPause("resting");
    }, [setPause]),
    onLift: useCallback(() => {
      if (pauseReasonRef.current !== "none") resume();
    }, [resume]),
    // A covered camera resumes as soon as the phone is picked up again.
    onMove: useCallback(() => {
      if (pauseReasonRef.current === "dark") resume();
    }, [resume])
  });

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
    if (!enabled || pauseReason !== "none") {
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
          delayBetweenScanAttempts: 10,
          delayBetweenScanSuccess: 20
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
          resetIdleTimer();
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
  }, [cameraAttempt, cooldownMs, enabled, pauseReason, resetIdleTimer, stop]);

  // Pause when the lens is covered: the preview turns into an almost black frame.
  useEffect(() => {
    if (!enabled || pauseReason !== "none" || !active) return;

    const canvas = document.createElement("canvas");
    canvas.width = DARK_SAMPLE_WIDTH;
    canvas.height = DARK_SAMPLE_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    const startedAt = Date.now();
    let coveredSince: number | null = null;
    let paused = false;

    const sample = () => {
      if (paused) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) {
        coveredSince = null;
        return;
      }
      if (Date.now() - startedAt < DARK_GRACE_MS) return;

      let covered = false;
      try {
        context.drawImage(video, 0, 0, DARK_SAMPLE_WIDTH, DARK_SAMPLE_HEIGHT);
        covered = isFrameCovered(context);
      } catch {
        coveredSince = null;
        return;
      }

      if (!covered) {
        coveredSince = null;
        return;
      }

      const now = Date.now();
      if (coveredSince === null) {
        coveredSince = now;
        return;
      }
      if (now - coveredSince >= DARK_SETTLE_MS) {
        paused = true;
        setPause("dark");
      }
    };

    const timer = window.setInterval(sample, DARK_SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, enabled, pauseReason, setPause]);

  useEffect(() => {
    if (!enabled) {
      clearIdleTimer();
      if (pauseReasonRef.current !== "none") setPause("none");
      return;
    }

    if (pauseReason !== "none") {
      clearIdleTimer();
      return;
    }

    resetIdleTimer();
    return clearIdleTimer;
  }, [clearIdleTimer, enabled, pauseReason, resetIdleTimer, setPause]);

  return {
    videoRef,
    active,
    pausedForInactivity: pauseReason === "inactivity",
    pausedForRest: pauseReason === "resting",
    pausedForDark: pauseReason === "dark",
    requestMotionPermission: lift.requestPermission,
    resume,
    error,
    stop,
    torchSupported,
    torchEnabled,
    toggleTorch
  };
}
