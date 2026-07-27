import { useCallback, useEffect, useMemo, useState } from "react";
import { beep, vibrate } from "../lib/feedback";
import { createRealtimeClient } from "../lib/realtime";
import { createScanEvent, isValidScanValue } from "../lib/scanner";
import {
  clearSessionFromLocation,
  clearStoredPairingCode,
  getSessionFromLocation,
  getStoredPairingCode,
  storePairingCode
} from "../lib/session";
import {
  createClientJoinedEvent,
  createClientLeftEvent,
  formatPairingCode,
  isValidPairingCode,
  normalizeBarcode,
  normalizePairingCode
} from "../shared/contracts";

export type ScannerState = "home" | "connect" | "scanner";

export function useScannerSession() {
  const sessionFromUrl = useMemo(() => getSessionFromLocation(), []);
  const initialSessionId = useMemo(() => {
    const urlCode = normalizePairingCode(sessionFromUrl ?? "");
    if (isValidPairingCode(urlCode)) {
      return urlCode;
    }
    return getStoredPairingCode() ?? "";
  }, [sessionFromUrl]);
  const [screen, setScreen] = useState<ScannerState>(initialSessionId ? "scanner" : "home");
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [status, setStatus] = useState<string>(initialSessionId ? "Connecting" : "Ready to pair");
  const [barcode, setBarcode] = useState("");
  const [lastAck, setLastAck] = useState<string>("");
  const [realtime] = useState(() => createRealtimeClient());

  const disconnect = useCallback(
    async (notifyDesktop = true) => {
      if (notifyDesktop && isValidPairingCode(sessionId)) {
        try {
          await realtime.publish(createClientLeftEvent(sessionId));
        } catch {
          // Continue with local disconnect when the relay is already unavailable.
        }
      }
      await realtime.disconnect();
      clearStoredPairingCode();
      clearSessionFromLocation();
      setSessionId("");
      setBarcode("");
      setLastAck("");
      setStatus("Ready to pair");
      setScreen("home");
    },
    [realtime, sessionId]
  );

  useEffect(() => {
    realtime.onEvent?.((event) => {
      if (event.type === "desktop_status") {
        if (event.status === "idle") {
          void disconnect(false);
          return;
        }
        setStatus("Desktop ready");
        setLastAck("Desktop is online. Scanner is ready.");
      }
    });
  }, [disconnect, realtime]);

  useEffect(() => {
    if (screen === "scanner") {
      let cancelled = false;
      if (!isValidPairingCode(sessionId)) {
        setStatus("Invalid code");
        setLastAck("Enter the 6-character code shown on desktop.");
        setScreen("home");
        return;
      }
      setStatus("Connecting");
      void realtime
        .connect(sessionId)
        .then(() => realtime.publish(createClientJoinedEvent(sessionId)))
        .then(() => {
          if (cancelled) return;
          setStatus("Connected to relay");
          setLastAck("Pairing signal sent. Desktop should show Mobile: Joined.");
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("Disconnected");
          setLastAck("Realtime failed. Check Supabase env and internet connection.");
        });

      return () => {
        cancelled = true;
      };
    }
  }, [realtime, screen, sessionId]);

  const updateSessionId = useCallback((value: string) => {
    setSessionId(normalizePairingCode(value).slice(0, 6));
  }, []);

  const connectWithCode = useCallback(() => {
    if (!isValidPairingCode(sessionId)) {
      setStatus("Invalid code");
      setLastAck("Enter the 6-character code shown on desktop.");
      return;
    }
    storePairingCode(sessionId);
    setScreen("scanner");
  }, [sessionId]);

  const submitScan = useCallback(
    async (value: string) => {
      const clean = normalizeBarcode(value);
      if (!isValidScanValue(clean)) {
        setLastAck("Barcode kosong");
        return;
      }

      const event = createScanEvent(sessionId, { barcode: clean });
      await realtime.publish(event);
      setBarcode(clean);
      setLastAck(`Published ${clean}`);
      setStatus("Connected to relay");
      beep();
      vibrate();
    },
    [realtime, sessionId]
  );

  const reconnect = useCallback(async () => {
    setStatus("Reconnecting");
    await realtime.disconnect();
    await realtime.connect(sessionId);
    await realtime.publish(createClientJoinedEvent(sessionId));
    setStatus("Connected to relay");
    setLastAck("Pairing signal sent. Desktop should show Mobile: Joined.");
  }, [realtime, sessionId]);

  return {
    screen,
    setScreen,
    sessionId,
    setSessionId,
    updateSessionId,
    connectWithCode,
    pairingCode: formatPairingCode(sessionId),
    status,
    setStatus,
    barcode,
    setBarcode,
    lastAck,
    setLastAck,
    submitScan,
    reconnect,
    disconnect: () => disconnect(true)
  };
}
