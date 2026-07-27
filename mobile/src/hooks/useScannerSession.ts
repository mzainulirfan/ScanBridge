import { useCallback, useEffect, useMemo, useState } from "react";
import { beep, vibrate } from "../lib/feedback";
import { createRealtimeClient } from "../lib/realtime";
import { createScanEvent, isValidScanValue } from "../lib/scanner";
import { getSessionFromLocation } from "../lib/session";
import {
  createClientJoinedEvent,
  formatPairingCode,
  isValidPairingCode,
  normalizeBarcode,
  normalizePairingCode
} from "../shared/contracts";

export type ScannerState = "home" | "connect" | "scanner";

export function useScannerSession() {
  const sessionFromUrl = useMemo(() => getSessionFromLocation(), []);
  const [screen, setScreen] = useState<ScannerState>(sessionFromUrl ? "scanner" : "home");
  const [sessionId, setSessionId] = useState(sessionFromUrl ? normalizePairingCode(sessionFromUrl) : "");
  const [status, setStatus] = useState<string>(sessionFromUrl ? "Connecting" : "Ready to pair");
  const [barcode, setBarcode] = useState("");
  const [lastAck, setLastAck] = useState<string>("");
  const [realtime] = useState(() => createRealtimeClient());

  useEffect(() => {
    realtime.onEvent?.((event) => {
      if (event.type === "desktop_status") {
        setStatus("Desktop ready");
        setLastAck("Desktop is online. Scanner is ready.");
      }
    });
  }, [realtime]);

  useEffect(() => {
    if (sessionFromUrl) {
      setSessionId(normalizePairingCode(sessionFromUrl));
      setScreen("scanner");
    }
  }, [sessionFromUrl]);

  useEffect(() => {
    if (screen === "scanner") {
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
          setStatus("Connected to relay");
          setLastAck("Pairing signal sent. Desktop should show Mobile: Joined.");
        })
        .catch(() => {
          setStatus("Disconnected");
          setLastAck("Realtime failed. Check Supabase env and internet connection.");
        });
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
    reconnect
  };
}
