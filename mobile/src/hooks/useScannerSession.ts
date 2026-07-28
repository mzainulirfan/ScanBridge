import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prepareScannerSound, scannerSuccessSound, vibrate } from "../lib/feedback";
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
  createClientHeartbeatEvent,
  createClientJoinedEvent,
  createClientLeftEvent,
  createSessionId,
  formatPairingCode,
  isValidPairingCode,
  normalizeBarcode,
  normalizePairingCode,
  type ScanAckEvent
} from "../shared/contracts";

export type ScannerState = "home" | "connect" | "scanner";
const DESKTOP_HEARTBEAT_TIMEOUT_MS = 30000;
const SCAN_ACK_TIMEOUT_MS = 5000;

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
  const [toast, setToast] = useState("");
  const [realtime] = useState(() => createRealtimeClient());
  const clientId = useRef(createSessionId());
  const lastDesktopSeenAt = useRef(0);
  const toastTimer = useRef<number | null>(null);
  const pendingScans = useRef(
    new Map<string, { resolve: (ack: ScanAckEvent) => void; reject: (error: Error) => void; timer: number }>()
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 1800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
      pendingScans.current.forEach(({ reject, timer }) => {
        window.clearTimeout(timer);
        reject(new Error("Scanner ditutup"));
      });
      pendingScans.current.clear();
    };
  }, []);

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
      lastDesktopSeenAt.current = 0;
      setStatus("Siap pairing");
      setScreen("home");
    },
    [realtime, sessionId]
  );

  useEffect(() => {
    realtime.onEvent?.((event) => {
      if (event.type === "desktop_status") {
        lastDesktopSeenAt.current = Date.now();
        if (event.status === "idle") {
          void disconnect(false);
          return;
        }
        setStatus("Desktop siap");
        setLastAck("Desktop online. Scanner siap digunakan.");
      }
      if (event.type === "scan_ack") {
        const pending = pendingScans.current.get(event.scanId);
        if (!pending) return;
        window.clearTimeout(pending.timer);
        pendingScans.current.delete(event.scanId);
        pending.resolve(event);
      }
    });
  }, [disconnect, realtime]);

  useEffect(() => {
    if (screen !== "scanner" || !realtime.configured || !isValidPairingCode(sessionId)) return;
    const sendHeartbeat = () => {
      void realtime
        .publish(createClientHeartbeatEvent(sessionId, clientId.current))
        .catch(() => setStatus("Koneksi tidak stabil"));
    };
    sendHeartbeat();
    const heartbeat = window.setInterval(sendHeartbeat, 4000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [realtime, screen, sessionId]);

  useEffect(() => {
    if (screen !== "scanner") return;

    const watchdog = window.setInterval(() => {
      const lastSeen = lastDesktopSeenAt.current;
      if (lastSeen > 0 && Date.now() - lastSeen > DESKTOP_HEARTBEAT_TIMEOUT_MS) {
        setLastAck("Desktop tidak lagi aktif. Masukkan kembali kode saat desktop siap.");
        void disconnect(false);
      }
    }, 2000);

    return () => window.clearInterval(watchdog);
  }, [disconnect, screen]);

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
      lastDesktopSeenAt.current = 0;
      void realtime
        .connect(sessionId)
        .then(async () => {
          await realtime.publish(createClientJoinedEvent(sessionId, clientId.current));
          await realtime.publish(createClientHeartbeatEvent(sessionId, clientId.current));
        })
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
    if (!realtime.configured) {
      setStatus("Konfigurasi belum siap");
      setLastAck("Supabase belum dikonfigurasi. Hubungi administrator aplikasi.");
      showToast("Relay belum dikonfigurasi");
      return;
    }
    if (!isValidPairingCode(sessionId)) {
      setStatus("Kode tidak valid");
      setLastAck("Masukkan kode 6 karakter dari ScanBridge Desktop.");
      return;
    }
    prepareScannerSound();
    storePairingCode(sessionId);
    setScreen("scanner");
  }, [realtime.configured, sessionId, showToast]);

  const submitScan = useCallback(
    async (value: string, symbology?: string): Promise<boolean> => {
      const clean = normalizeBarcode(value);
      if (!isValidScanValue(clean)) {
        setLastAck("Barcode masih kosong.");
        showToast("Barcode tidak boleh kosong");
        return false;
      }

      const event = createScanEvent(sessionId, { barcode: clean, symbology });
      const ackPromise = new Promise<ScanAckEvent>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pendingScans.current.delete(event.scanId);
          reject(new Error("Desktop belum mengonfirmasi scan"));
        }, SCAN_ACK_TIMEOUT_MS);
        pendingScans.current.set(event.scanId, { resolve, reject, timer });
      });

      try {
        await realtime.publish(event);
        setBarcode(clean);
        setLastAck(`Menunggu konfirmasi desktop: ${clean}`);
        const ack = await ackPromise;
        if (!ack.success) throw new Error(ack.message || "Desktop gagal mengetik barcode");
        setLastAck(`Berhasil diketik: ${clean}`);
        setStatus("Desktop siap");
        showToast("Barcode berhasil diketik");
        scannerSuccessSound();
        vibrate();
        return true;
      } catch (error) {
        const pending = pendingScans.current.get(event.scanId);
        if (pending) window.clearTimeout(pending.timer);
        pendingScans.current.delete(event.scanId);
        const message = error instanceof Error ? error.message : "Pengiriman barcode gagal";
        setLastAck(message);
        setStatus("Terputus");
        showToast(message);
        return false;
      }
    },
    [realtime, sessionId, showToast]
  );

  const reconnect = useCallback(async () => {
    setStatus("Menyambungkan ulang");
    try {
      await realtime.disconnect();
      await realtime.connect(sessionId);
      await realtime.publish(createClientJoinedEvent(sessionId, clientId.current));
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
    toast,
    realtimeConfigured: realtime.configured,
    setLastAck,
    submitScan,
    reconnect,
    disconnect: () => disconnect(true)
  };
}
