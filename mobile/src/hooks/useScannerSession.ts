import { useCallback, useEffect, useMemo, useState } from "react";
import { scannerSuccessSound, vibrate } from "../lib/feedback";
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
  const [status, setStatus] = useState<string>(initialSessionId ? "Menghubungkan" : "Siap pairing");
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
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
      setStatus("Siap pairing");
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
        setStatus("Desktop siap");
        setLastAck("Desktop online. Scanner siap digunakan.");
      }
    });
  }, [disconnect, realtime]);

  useEffect(() => {
    if (screen === "scanner") {
      let cancelled = false;
      if (!isValidPairingCode(sessionId)) {
        setStatus("Kode tidak valid");
        setLastAck("Masukkan kode 6 karakter dari ScanBridge Desktop.");
        setScreen("home");
        return;
      }
      setStatus("Menghubungkan");
      void realtime
        .connect(sessionId)
        .then(() => realtime.publish(createClientJoinedEvent(sessionId)))
        .then(() => {
          if (cancelled) return;
          setStatus("Terhubung ke relay");
          setLastAck("Sinyal pairing terkirim. Desktop seharusnya menampilkan mobile terhubung.");
        })
        .catch(() => {
          if (cancelled) return;
          setStatus("Terputus");
          setLastAck("Koneksi gagal. Periksa internet lalu coba sambungkan ulang.");
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
      setStatus("Kode tidak valid");
      setLastAck("Masukkan kode 6 karakter dari ScanBridge Desktop.");
      return;
    }
    storePairingCode(sessionId);
    setScreen("scanner");
  }, [sessionId]);

  const submitScan = useCallback(
    async (value: string) => {
      const clean = normalizeBarcode(value);
      if (!isValidScanValue(clean)) {
        setLastAck("Barcode masih kosong.");
        return;
      }

      const event = createScanEvent(sessionId, { barcode: clean });
      await realtime.publish(event);
      setBarcode(clean);
      setLastAck(`Barcode terkirim: ${clean}`);
      setStatus("Terhubung ke relay");
      scannerSuccessSound();
      vibrate();
    },
    [realtime, sessionId]
  );

  const reconnect = useCallback(async () => {
    setStatus("Menyambungkan ulang");
    try {
      await realtime.disconnect();
      await realtime.connect(sessionId);
      await realtime.publish(createClientJoinedEvent(sessionId));
      setStatus("Terhubung ke relay");
      setLastAck("Sinyal pairing terkirim. Desktop seharusnya menampilkan mobile terhubung.");
    } catch {
      setStatus("Terputus");
      setLastAck("Sambung ulang gagal. Periksa internet lalu coba lagi.");
    }
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
    manualBarcode,
    setManualBarcode,
    lastAck,
    setLastAck,
    submitScan,
    reconnect,
    disconnect: () => disconnect(true)
  };
}
