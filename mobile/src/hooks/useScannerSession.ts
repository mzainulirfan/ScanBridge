import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prepareScannerSound, scannerSuccessSound, vibrate } from "../lib/feedback";
import { createRealtimeClient } from "../lib/realtime";
import { createScanEvent, isValidScanValue } from "../lib/scanner";
import {
  clearSessionFromLocation,
  clearStoredPairingCode,
  getOrCreateStoredClientId,
  getPairingCodeFromScan,
  getSessionFromLocation,
  getStoredPairingCode,
  storePairingCode
} from "../lib/session";
import {
  createClientHeartbeatEvent,
  createClientJoinedEvent,
  createClientLeftEvent,
  isValidPairingCode,
  normalizeBarcode,
  normalizePairingCode,
  type ScanAckEvent
} from "../shared/contracts";

export type ScannerState = "home" | "connect" | "scanner";
const DESKTOP_HEARTBEAT_TIMEOUT_MS = 30000;
const PAIRING_CONFIRM_TIMEOUT_MS = 10000;
const AUTO_RECONNECT_DELAY_MS = 5000;
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
  const [screen, setScreen] = useState<ScannerState>("home");
  const [pairingPending, setPairingPending] = useState(Boolean(initialSessionId));
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [status, setStatus] = useState<string>(initialSessionId ? "Menghubungkan" : "Siap pairing");
  const [barcode, setBarcode] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [lastAck, setLastAck] = useState<string>("");
  const [toast, setToast] = useState("");
  const [realtime] = useState(() => createRealtimeClient());
  const clientId = useRef(getOrCreateStoredClientId());
  const resumeAttempt = useRef(Boolean(initialSessionId));
  const lastDesktopSeenAt = useRef(0);
  const pairingTimer = useRef<number | null>(null);
  const reconnectTimer = useRef<number | null>(null);
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
      if (pairingTimer.current !== null) window.clearTimeout(pairingTimer.current);
      if (reconnectTimer.current !== null) window.clearTimeout(reconnectTimer.current);
      pendingScans.current.forEach(({ reject, timer }) => {
        window.clearTimeout(timer);
        reject(new Error("Scanner ditutup"));
      });
      pendingScans.current.clear();
    };
  }, []);

  const clearAutoReconnect = useCallback(() => {
    if (reconnectTimer.current !== null) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
  }, []);

  const scheduleAutoReconnect = useCallback(() => {
    if (
      reconnectTimer.current !== null ||
      !resumeAttempt.current ||
      !realtime.configured ||
      !isValidPairingCode(sessionId)
    ) return;

    reconnectTimer.current = window.setTimeout(() => {
      reconnectTimer.current = null;
      setPairingPending(true);
    }, AUTO_RECONNECT_DELAY_MS);
  }, [realtime.configured, sessionId]);

  const disconnect = useCallback(
    async (notifyDesktop = true) => {
      resumeAttempt.current = false;
      clearAutoReconnect();
      setPairingPending(false);
      if (notifyDesktop && isValidPairingCode(sessionId)) {
        try {
          await realtime.publish(createClientLeftEvent(sessionId, clientId.current));
        } catch {
          // Continue with local disconnect when the relay is already unavailable.
        }
      }
      await realtime.disconnect();
      clearStoredPairingCode();
      clearSessionFromLocation();
      clearAutoReconnect();
      setSessionId("");
      setPairingPending(false);
      setBarcode("");
      setLastAck("");
      lastDesktopSeenAt.current = 0;
      if (pairingTimer.current !== null) {
        window.clearTimeout(pairingTimer.current);
        pairingTimer.current = null;
      }
      setStatus("Siap pairing");
      setScreen("home");
    },
    [clearAutoReconnect, realtime, sessionId]
  );

  useEffect(() => {
    realtime.onEvent?.((event) => {
      if (event.type === "desktop_status") {
        lastDesktopSeenAt.current = Date.now();
        if (event.status === "idle") {
          void disconnect(false);
          return;
        }
        if (event.status === "waiting_pairing" && isValidPairingCode(sessionId)) {
          setStatus("Menyambungkan kembali");
          void realtime.publish(createClientJoinedEvent(sessionId, clientId.current));
          return;
        }
        if (event.status !== "connected" || event.clientId !== clientId.current) return;
        if (pairingTimer.current !== null) {
          window.clearTimeout(pairingTimer.current);
          pairingTimer.current = null;
        }
        clearAutoReconnect();
        setStatus("Desktop siap");
        setLastAck("Desktop online. Scanner siap digunakan.");
        storePairingCode(event.sessionId);
        resumeAttempt.current = true;
        setPairingPending(false);
        setScreen("scanner");
      }
      if (event.type === "scan_ack") {
        const pending = pendingScans.current.get(event.scanId);
        if (!pending) return;
        window.clearTimeout(pending.timer);
        pendingScans.current.delete(event.scanId);
        pending.resolve(event);
      }
    });
  }, [clearAutoReconnect, disconnect, realtime]);

  useEffect(() => {
    if (screen !== "scanner" || pairingPending || !realtime.configured || !isValidPairingCode(sessionId)) return;
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
  }, [pairingPending, realtime, screen, sessionId]);

  useEffect(() => {
    if (screen !== "scanner") return;

    const watchdog = window.setInterval(() => {
      const lastSeen = lastDesktopSeenAt.current;
      if (lastSeen > 0 && Date.now() - lastSeen > DESKTOP_HEARTBEAT_TIMEOUT_MS) {
        lastDesktopSeenAt.current = 0;
        setStatus("Desktop offline");
        setLastAck("Pairing tetap tersimpan. Scanner akan tersambung saat desktop aktif.");
        setScreen("home");
        scheduleAutoReconnect();
      }
    }, 2000);

    return () => window.clearInterval(watchdog);
  }, [scheduleAutoReconnect, screen]);

  useEffect(() => {
    if (pairingPending) {
      let cancelled = false;
      if (!isValidPairingCode(sessionId)) {
        setStatus("Kode tidak valid");
        setLastAck("Masukkan kode pairing 32 karakter dari ScanBridge Desktop.");
        setPairingPending(false);
        setScreen("home");
        return;
      }
      setStatus("Menghubungkan");
      lastDesktopSeenAt.current = 0;
      if (pairingTimer.current !== null) window.clearTimeout(pairingTimer.current);
      pairingTimer.current = window.setTimeout(() => {
        pairingTimer.current = null;
        const finishTimeout = () => {
          if (cancelled) return;
          setPairingPending(false);
          setScreen("home");
          if (resumeAttempt.current) {
            setStatus("Desktop belum aktif");
            setLastAck("Pairing tersimpan. Menunggu desktop kembali aktif.");
            scheduleAutoReconnect();
          } else {
            setStatus("Kode tidak cocok");
            setLastAck("Kode pairing tidak ditemukan di desktop. Periksa kembali kode yang disalin dari desktop.");
          }
        };
        if (resumeAttempt.current) {
          finishTimeout();
        } else {
          void realtime.disconnect().then(finishTimeout);
        }
      }, PAIRING_CONFIRM_TIMEOUT_MS);
      void realtime
        .connect(sessionId)
        .then(async () => {
          if (cancelled) return;
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
          if (pairingTimer.current !== null) {
            window.clearTimeout(pairingTimer.current);
            pairingTimer.current = null;
          }
          setStatus("Terputus");
          setLastAck("Koneksi gagal. Periksa internet lalu coba sambungkan ulang.");
          setPairingPending(false);
          setScreen("home");
          scheduleAutoReconnect();
        });

      return () => {
        cancelled = true;
        if (pairingTimer.current !== null) {
          window.clearTimeout(pairingTimer.current);
          pairingTimer.current = null;
        }
      };
    }
  }, [pairingPending, realtime, scheduleAutoReconnect, sessionId]);

  const updateSessionId = useCallback((value: string) => {
    setSessionId(normalizePairingCode(value).slice(0, 32));
  }, []);

  const connectWithCode = useCallback((value?: string) => {
    const nextSessionId =
      getPairingCodeFromScan(value ?? "") ?? normalizePairingCode(value ?? sessionId).slice(0, 32);
    if (!realtime.configured) {
      setStatus("Konfigurasi belum siap");
      setLastAck("Supabase belum dikonfigurasi. Hubungi administrator aplikasi.");
      showToast("Relay belum dikonfigurasi");
      return;
    }
    if (!isValidPairingCode(nextSessionId)) {
      setStatus("Kode tidak valid");
      setLastAck("Masukkan kode pairing 32 karakter dari ScanBridge Desktop.");
      return;
    }
    prepareScannerSound();
    clearAutoReconnect();
    clientId.current = getOrCreateStoredClientId();
    resumeAttempt.current = false;
    setSessionId(nextSessionId);
    setStatus("Memeriksa kode");
    setLastAck("Mencari desktop dengan kode ini...");
    setPairingPending(true);
  }, [clearAutoReconnect, realtime.configured, sessionId, showToast]);

  const submitScan = useCallback(
    async (value: string, symbology?: string): Promise<boolean> => {
      const clean = normalizeBarcode(value);
      if (!isValidScanValue(clean)) {
        setLastAck("Barcode masih kosong.");
        showToast("Barcode tidak boleh kosong");
        return false;
      }

      const event = createScanEvent(sessionId, clientId.current, { barcode: clean, symbology });
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
    clearAutoReconnect();
    setStatus("Menyambungkan ulang");
    setScreen("home");
    setPairingPending(true);
  }, [clearAutoReconnect]);

  return {
    screen,
    setScreen,
    sessionId,
    setSessionId,
    updateSessionId,
    connectWithCode,
    pairingCode: sessionId,
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
