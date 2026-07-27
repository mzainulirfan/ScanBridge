import { useCallback, useEffect, useMemo, useState } from "react";
import { buildConnectUrl, createClientJoinedEvent, createSessionId, normalizeBarcode } from "../../../shared/contracts";
import { beep, vibrate } from "../lib/feedback";
import { createRealtimeClient } from "../lib/realtime";
import { createScanEvent, isValidScanValue } from "../lib/scanner";
import { getSessionFromLocation } from "../lib/session";

export type ScannerState = "home" | "connect" | "scanner";

export function useScannerSession() {
  const sessionFromUrl = useMemo(() => getSessionFromLocation(), []);
  const [screen, setScreen] = useState<ScannerState>(sessionFromUrl ? "scanner" : "home");
  const [sessionId, setSessionId] = useState(sessionFromUrl ?? createSessionId());
  const [status, setStatus] = useState<string>(sessionFromUrl ? "Connected" : "Ready to pair");
  const [barcode, setBarcode] = useState("");
  const [lastAck, setLastAck] = useState<string>("");
  const [realtime] = useState(() => createRealtimeClient());

  useEffect(() => {
    if (sessionFromUrl) {
      setSessionId(sessionFromUrl);
      setScreen("scanner");
    }
  }, [sessionFromUrl]);

  useEffect(() => {
    if (screen === "scanner") {
      void realtime.connect(sessionId).then(() => {
        void realtime.publish(createClientJoinedEvent(sessionId));
      });
    }
  }, [realtime, screen, sessionId]);

  const connectUrl = useMemo(() => buildConnectUrl(sessionId), [sessionId]);

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
      setStatus("Connected");
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
    setStatus("Connected");
  }, [realtime, sessionId]);

  return {
    screen,
    setScreen,
    sessionId,
    setSessionId,
    status,
    setStatus,
    barcode,
    setBarcode,
    lastAck,
    setLastAck,
    connectUrl,
    submitScan,
    reconnect
  };
}
