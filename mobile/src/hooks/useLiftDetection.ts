import { useCallback, useEffect, useRef, useState } from "react";

export type MotionPermission = "unsupported" | "unknown" | "granted" | "denied";

type Vector = { x: number; y: number; z: number };

type RequestableDeviceMotionEvent = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type UseLiftDetectionOptions = {
  enabled: boolean;
  /** Called when the phone transitions from moving/held to lying still on a surface. */
  onRest?: () => void;
  /** Called when the phone leaves the resting state (lifted or tilted). */
  onLift?: () => void;
};

/** How long the phone must stay still before it is considered resting. */
const REST_DELAY_MS = 2500;
/** Acceleration change (m/s²) that counts as movement. */
const MOTION_THRESHOLD = 0.8;
/** |gravity.z| / |gravity| above this means the phone lies flat on a surface. */
const FLAT_RATIO = 0.82;
const SAMPLE_INTERVAL_MS = 80;
const EVALUATION_INTERVAL_MS = 400;

function isMotionSupported(): boolean {
  return typeof window !== "undefined" && "DeviceMotionEvent" in window;
}

function needsMotionPermission(): boolean {
  if (!isMotionSupported()) return false;
  return typeof (window.DeviceMotionEvent as RequestableDeviceMotionEvent).requestPermission === "function";
}

function readVector(value: DeviceMotionEventAcceleration | null): Vector | null {
  if (!value || value.x === null || value.y === null || value.z === null) return null;
  return { x: value.x, y: value.y, z: value.z };
}

/**
 * Detects when the phone is lying flat and still on a surface (for example a desk)
 * and reports when it is lifted again. Uses the motion sensors, so it degrades to a
 * no-op when `devicemotion` is unavailable or permission is denied.
 */
export function useLiftDetection({ enabled, onRest, onLift }: UseLiftDetectionOptions) {
  const [supported] = useState<boolean>(() => isMotionSupported());
  const [permission, setPermission] = useState<MotionPermission>(() =>
    !isMotionSupported() ? "unsupported" : needsMotionPermission() ? "unknown" : "granted"
  );
  const permissionRef = useRef(permission);
  const onRestRef = useRef(onRest);
  const onLiftRef = useRef(onLift);
  const pendingRequestRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    onRestRef.current = onRest;
  }, [onRest]);

  useEffect(() => {
    onLiftRef.current = onLift;
  }, [onLift]);

  const applyPermission = useCallback((next: MotionPermission) => {
    permissionRef.current = next;
    setPermission(next);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    const constructor = window.DeviceMotionEvent as RequestableDeviceMotionEvent;
    if (typeof constructor.requestPermission !== "function") {
      applyPermission("granted");
      return true;
    }
    if (permissionRef.current === "granted") return true;
    if (permissionRef.current === "denied") return false;
    if (pendingRequestRef.current) return pendingRequestRef.current;

    const pending = constructor
      .requestPermission()
      .then(result => {
        applyPermission(result === "granted" ? "granted" : "denied");
        return result === "granted";
      })
      // Without a user gesture iOS rejects the request; keep "unknown" so a later tap can retry.
      .catch(() => false)
      .finally(() => {
        pendingRequestRef.current = null;
      });

    pendingRequestRef.current = pending;
    return pending;
  }, [applyPermission, supported]);

  // iOS only shows the motion prompt from a user gesture, so retry on the first tap.
  useEffect(() => {
    if (!enabled || permission !== "unknown") return;
    const handleGesture = () => {
      void requestPermission();
    };
    window.addEventListener("pointerdown", handleGesture, true);
    return () => window.removeEventListener("pointerdown", handleGesture, true);
  }, [enabled, permission, requestPermission]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;

    let previousGravity: Vector | null = null;
    let lastMotionAt = Date.now();
    let lastSampleAt = 0;
    let resting = false;
    let flat = false;

    const updateResting = (next: boolean) => {
      if (resting === next) return;
      resting = next;
      if (next) onRestRef.current?.();
      else onLiftRef.current?.();
    };

    const evaluate = () => {
      if (document.visibilityState === "hidden") return;
      updateResting(flat && Date.now() - lastMotionAt >= REST_DELAY_MS);
    };

    const handleMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastSampleAt < SAMPLE_INTERVAL_MS) return;
      lastSampleAt = now;

      const linear = readVector(event.acceleration);
      const gravity = readVector(event.accelerationIncludingGravity);
      let moved = false;

      if (linear) {
        moved = Math.hypot(linear.x, linear.y, linear.z) >= MOTION_THRESHOLD;
      }

      if (gravity) {
        if (previousGravity) {
          const delta = Math.hypot(
            gravity.x - previousGravity.x,
            gravity.y - previousGravity.y,
            gravity.z - previousGravity.z
          );
          if (delta >= MOTION_THRESHOLD) moved = true;
        }
        previousGravity = gravity;
        const magnitude = Math.hypot(gravity.x, gravity.y, gravity.z);
        const nextFlat = magnitude > 0 && Math.abs(gravity.z) / magnitude >= FLAT_RATIO;
        // Landing on a surface restarts the stillness window.
        if (nextFlat && !flat) lastMotionAt = now;
        flat = nextFlat;
      }

      if (moved) {
        lastMotionAt = now;
        updateResting(false);
      }
      evaluate();
    };

    window.addEventListener("devicemotion", handleMotion);
    const timer = window.setInterval(evaluate, EVALUATION_INTERVAL_MS);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.clearInterval(timer);
    };
  }, [enabled, permission]);

  return {
    supported,
    permission,
    requestPermission
  };
}
