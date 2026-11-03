import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prepareScannerSound, scannerSuccessSound, vibrate } from "../lib/feedback";
import { createRealtimeClient } from "../lib/realtime";
import { HEARTBEAT_INTERVAL_MS, PEER_TIMEOUT_MS } from "../../../shared/realtime-session";
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
  const paired = useRef(false);
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
      void realtime.disconnect().catch(() => {});
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
      document.visibilityState === "hidden" || navigator.onLine === false ||
      !isValidPairingCode(sessionId)
    ) return;

    reconnectTimer.current = window.setTimeout(() => {
      reconnectTimer.current = null;
      setPairingPending(true);
    }, AUTO_RECONNECT_DELAY_MS);
  }, [realtime.configured, sessionId]);

  const rejectPendingScans = useCallback((message: string) => {
    pendingScans.current.forEach(({ reject, timer }) => {
      window.clearTimeout(timer);
      reject(new Error(message));
    });
    pendingScans.current.clear();
  }, []);

  const connectionLost = useCallback((message: string) => {
    paired.current = false;
    lastDesktopSeenAt.current = 0;
    if (pairingTimer.current !== null) window.clearTimeout(pairingTimer.current);
    pairingTimer.current = null;
    rejectPendingScans(message);
    setPairingPending(false);
    setScreen("home");
    setStatus(message);
    setLastAck("Pairing tetap tersimpan. Akan tersambung kembali saat kedua perangkat aktif dan online.");
    showToast(message);
    scheduleAutoReconnect();
  }, [rejectPendingScans, scheduleAutoReconnect, showToast]);

  const disconnect = useCallback(
    async (notifyDesktop = true) => {
      resumeAttempt.current = false;
      paired.current = false;
      rejectPendingScans("Pairing diputus");
      clearAutoReconnect();
      setPairingPending(false);
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
      if (notifyDesktop && isValidPairingCode(sessionId)) {
        try {
          await realtime.publish(createClientLeftEvent(sessionId, clientId.current));
        } catch {
          // Continue with local disconnect when the relay is already unavailable.
        }
      }
      await realtime.disconnect();
    },
    [clearAutoReconnect, realtime, rejectPendingScans, sessionId]
  );

  useEffect(() => {
    realtime.onEvent?.((event) => {
      if (event.sessionId !== sessionId) return;
      if (event.type === "desktop_status") {
        lastDesktopSeenAt.current = Date.now();
        if (event.status === "idle") {
          void disconnect(false);
          return;
        }
        if (event.status === "waiting_pairing" && isValidPairingCode(sessionId)) {
          if (paired.current) connectionLost("Desktop menyambungkan ulang");
          setStatus("Menyambungkan kembali");
          void realtime.publish(createClientJoinedEvent(sessionId, clientId.current))
            .catch(() => connectionLost("Koneksi terputus"));
          return;
        }
        if (event.status !== "connected" || event.clientId !== clientId.current) return;
        if (pairingTimer.current !== null) {
          window.clearTimeout(pairingTimer.current);
          pairingTimer.current = null;
        }
        clearAutoReconnect();
        const wasPaired = paired.current;
        paired.current = true;
        setStatus("Desktop siap");
        if (!wasPaired) setLastAck("Desktop online. Scanner siap digunakan.");
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
        lastDesktopSeenAt.current = Date.now();
        pending.resolve(event);
      }
    });
    realtime.onPeerLeft?.(() => {
      if (paired.current || resumeAttempt.current) connectionLost("Desktop offline");
    });
    realtime.onStateChange?.((state) => {
      if (state === "disconnected" && (paired.current || pairingPending || resumeAttempt.current)) {
        connectionLost("Koneksi terputus");
      } else if (state === "connected" && resumeAttempt.current && !pairingPending) {
        void realtime.publish(createClientJoinedEvent(sessionId, clientId.current))
          .catch(() => connectionLost("Koneksi terputus"));
      }
    });
    return () => {
      realtime.onEvent?.(() => {});
      realtime.onPeerLeft?.(() => {});
      realtime.onStateChange?.(() => {});
    };
  }, [clearAutoReconnect, connectionLost, disconnect, pairingPending, realtime, sessionId]);

  useEffect(() => {
    if (screen !== "scanner" || pairingPending || !realtime.configured || !isValidPairingCode(sessionId)) return;
    const sendHeartbeat = () => {
      void realtime
        .publish(createClientHeartbeatEvent(sessionId, clientId.current))
        .catch(() => connectionLost("Koneksi terputus"));
    };
    sendHeartbeat();
    const heartbeat = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") sendHeartbeat();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [connectionLost, pairingPending, realtime, screen, sessionId]);

  useEffect(() => {
    if (screen !== "scanner") return;

    const watchdog = window.setInterval(() => {
      const lastSeen = lastDesktopSeenAt.current;
      if (lastSeen > 0 && Date.now() - lastSeen >= PEER_TIMEOUT_MS) connectionLost("Desktop offline");
    }, 2000);

    return () => window.clearInterval(watchdog);
  }, [connectionLost, screen]);

  useEffect(() => {
    const suspend = () => {
      if (!paired.current && !resumeAttempt.current) return;
      connectionLost(navigator.onLine === false ? "Internet terputus" : "Koneksi dijeda");
      clearAutoReconnect();
      void realtime.disconnect().catch(() => {});
    };
    const resume = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false ||
          !resumeAttempt.current || !isValidPairingCode(sessionId)) return;
      if (paired.current && Date.now() - lastDesktopSeenAt.current < PEER_TIMEOUT_MS) return;
      paired.current = false;
      clearAutoReconnect();
      setScreen("home");
      setPairingPending(true);
    };
    const visibility = () => document.visibilityState === "hidden" ? suspend() : resume();
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", resume);
    window.addEventListener("offline", suspend);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("offline", suspend);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clearAutoReconnect, connectionLost, realtime, sessionId]);

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
      paired.current = false;
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
          void realtime.disconnect().then(finishTimeout, finishTimeout);
        }
      }, PAIRING_CONFIRM_TIMEOUT_MS);
      void realtime
        .connect(sessionId, clientId.current)
        .then(async () => {
          if (cancelled) return;
          await realtime.publish(createClientJoinedEvent(sessionId, clientId.current));
          await realtime.publish(createClientHeartbeatEvent(sessionId, clientId.current));
        })
        .then(() => {
          if (cancelled || paired.current) return;
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
      if (!paired.current || screen !== "scanner" || !isValidPairingCode(sessionId)) {
        showToast("Hubungkan desktop sebelum mengirim barcode");
        return false;
      }
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

      let acknowledged = false;
      try {
        setBarcode(clean);
        setLastAck(`Menunggu konfirmasi desktop: ${clean}`);
        const [, ack] = await Promise.all([realtime.publish(event), ackPromise]);
        if (!paired.current) return false;
        acknowledged = true;
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
        if (!resumeAttempt.current && !paired.current) return false;
        const message = error instanceof Error ? error.message : "Pengiriman barcode gagal";
        if (!acknowledged) connectionLost("Desktop tidak merespons");
        setLastAck(message);
        if (acknowledged) setStatus("Desktop siap");
        showToast(message);
        return false;
      }
    },
    [connectionLost, realtime, screen, sessionId, showToast]
  );

  const reconnect = useCallback(async () => {
    paired.current = false;
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
