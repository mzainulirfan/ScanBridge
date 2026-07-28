import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createSupabaseDesktopClient, subscribeDesktopSession } from "./lib/realtime";
import "./styles.css";

type TabName = "summary" | "output" | "activity";
type PairingInfo = { sessionId: string };
type DesktopStatus = { status: string };
type DesktopSettings = {
  autoEnter: boolean;
  autoTab: boolean;
  prefix: string;
  suffix: string;
  historyEnabled: boolean;
  historyLimit: number;
};
type HistoryItem = {
  barcode: string;
  symbology?: string | null;
  receivedAt: string;
  typed: boolean;
  message?: string | null;
};

const byId = <T extends HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
const statusEl = byId<HTMLSpanElement>("status");
const relayStatusEl = byId<HTMLElement>("relay-status");
const mobileStatusEl = byId<HTMLElement>("mobile-status");
const lastEventEl = byId<HTMLElement>("last-event");
const lastScanEl = byId<HTMLElement>("last-scan");
const sessionStateEl = byId<HTMLElement>("session-state");
const pairingCodeEl = byId<HTMLElement>("pairing-code");
const pairingUrlEl = byId<HTMLElement>("pairing-url");
const summaryMessageEl = byId<HTMLElement>("summary-message");
const outputMessageEl = byId<HTMLElement>("output-message");
const autoEnterEl = byId<HTMLInputElement>("auto-enter");
const autoTabEl = byId<HTMLInputElement>("auto-tab");
const historyEnabledEl = byId<HTMLInputElement>("history-enabled");
const prefixEl = byId<HTMLInputElement>("prefix");
const suffixEl = byId<HTMLInputElement>("suffix");
const testBarcodeEl = byId<HTMLInputElement>("test-barcode");
const activityListEl = byId<HTMLElement>("activity-list");
const activityCountEl = byId<HTMLElement>("activity-count");

let activeChannel: Awaited<ReturnType<typeof subscribeDesktopSession>> | null = null;
let heartbeatTimer: number | null = null;
let autoHidden = false;
let currentPairing: PairingInfo | null = null;

function setMessage(element: HTMLElement, message: string, state: "idle" | "success" | "error" = "idle") {
  element.textContent = message;
  element.dataset.state = state;
}

function activateTab(tab: TabName) {
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll<HTMLElement>("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === tab;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
  if (tab === "activity") void loadHistory();
}

async function loadPairing() {
  currentPairing = await invoke<PairingInfo>("get_pairing_info");
  const formatted = formatPairingCode(currentPairing.sessionId);
  pairingCodeEl.textContent = formatted;
  pairingUrlEl.textContent = `kode sesi: ${formatted}`;
}

function formatPairingCode(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean;
}

async function broadcastDesktopStatus() {
  if (!activeChannel || !currentPairing) return;
  try {
    const currentStatus = await invoke<DesktopStatus>("get_status");
    await activeChannel.send({
      type: "broadcast",
      event: "desktop_status",
      payload: {
        type: "desktop_status",
        sessionId: currentPairing.sessionId,
        status: currentStatus.status === "connected" ? "connected" : "waiting_pairing",
        deviceCount: currentStatus.status === "connected" ? 1 : 0,
        timestamp: new Date().toISOString()
      }
    });
  } catch {
    // The mobile watchdog handles a relay or desktop connection that goes silent.
  }
}

function startDesktopHeartbeat() {
  if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
  void broadcastDesktopStatus();
  heartbeatTimer = window.setInterval(() => {
    void broadcastDesktopStatus();
  }, 4000);
}

async function loadStatus(allowAutoHide = true) {
  const result = await invoke<DesktopStatus>("get_status");
  const connected = result.status === "connected";
  statusEl.textContent = connected ? "[x] terhubung" : "[ ] menunggu";
  statusEl.dataset.state = connected ? "active" : "idle";
  sessionStateEl.textContent = connected ? "session.connected" : "session.active";
  if (connected && allowAutoHide && !autoHidden) {
    autoHidden = true;
    await invoke("hide_main_window");
  }
}

async function startRealtime() {
  const pairing = currentPairing ?? (await invoke<PairingInfo>("get_pairing_info"));
  const supabase = createSupabaseDesktopClient();
  if (!supabase) {
    relayStatusEl.textContent = "env belum diatur";
    relayStatusEl.dataset.state = "error";
    mobileStatusEl.textContent = "tidak terhubung";
    mobileStatusEl.dataset.state = "error";
    statusEl.textContent = "[!] konfigurasi";
    statusEl.dataset.state = "error";
    setMessage(
      summaryMessageEl,
      "Supabase env belum tersedia. Atur VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY, lalu restart.",
      "error"
    );
    return;
  }

  try {
    relayStatusEl.textContent = "menghubungkan";
    relayStatusEl.dataset.state = "loading";
    activeChannel = await subscribeDesktopSession(
      supabase,
      pairing.sessionId,
      async (event) => {
        lastEventEl.textContent = event.type;
        if (event.type !== "scan") return;

        lastScanEl.textContent = event.barcode;
        try {
          const ack = await invoke<{ success: boolean; message: string }>("receive_scan", { event });
          setMessage(summaryMessageEl, `scan.berhasil / ${ack.message}`, "success");
        } catch (error) {
          setMessage(summaryMessageEl, errorMessage(error, "Gagal mengetik barcode."), "error");
        }
      },
      async () => {
        mobileStatusEl.textContent = "terhubung";
        mobileStatusEl.dataset.state = "active";
        lastEventEl.textContent = "client_joined";
        await invoke("mark_connected");
        await loadStatus();
        await broadcastDesktopStatus();
      },
      async () => {
        mobileStatusEl.textContent = "menunggu";
        mobileStatusEl.dataset.state = "idle";
        lastEventEl.textContent = "client_left";
        autoHidden = false;
        await invoke("mark_disconnected");
        await loadStatus(false);
        setMessage(summaryMessageEl, "mobile.terputus / siap untuk pairing", "idle");
      },
      async () => {
        relayStatusEl.textContent = "aktif";
        relayStatusEl.dataset.state = "active";
        setMessage(summaryMessageEl, "relay.siap / masukkan kode pairing di mobile", "success");
      }
    );
    startDesktopHeartbeat();
  } catch (error) {
    relayStatusEl.textContent = "gagal";
    relayStatusEl.dataset.state = "error";
    mobileStatusEl.textContent = "tidak terhubung";
    mobileStatusEl.dataset.state = "error";
    statusEl.textContent = "[!] relay gagal";
    statusEl.dataset.state = "error";
    setMessage(summaryMessageEl, errorMessage(error, "Koneksi realtime gagal."), "error");
  }
}

async function loadSettings() {
  const settings = await invoke<DesktopSettings>("get_settings");
  autoEnterEl.checked = settings.autoEnter;
  autoTabEl.checked = settings.autoTab;
  historyEnabledEl.checked = settings.historyEnabled;
  prefixEl.value = settings.prefix;
  suffixEl.value = settings.suffix;
}

async function saveSettings() {
  try {
    await invoke("update_settings", {
      settings: {
        autoEnter: autoEnterEl.checked,
        autoTab: autoTabEl.checked,
        prefix: prefixEl.value,
        suffix: suffixEl.value,
        historyEnabled: historyEnabledEl.checked,
        historyLimit: 100
      }
    });
    setMessage(outputMessageEl, "pengaturan.tersimpan", "success");
  } catch (error) {
    setMessage(outputMessageEl, errorMessage(error, "Pengaturan gagal disimpan."), "error");
  }
}

async function sendTestScan() {
  if (!currentPairing) await loadPairing();
  try {
    const ack = await invoke<{ success: boolean; message: string }>("receive_scan", {
      event: {
        type: "scan",
        sessionId: currentPairing!.sessionId,
        barcode: testBarcodeEl.value,
        timestamp: new Date().toISOString(),
        source: "mobile"
      }
    });
    setMessage(outputMessageEl, `uji.berhasil / ${ack.message}`, "success");
  } catch (error) {
    setMessage(outputMessageEl, errorMessage(error, "Uji output gagal."), "error");
  }
}

async function loadHistory() {
  try {
    const items = await invoke<HistoryItem[]>("get_history");
    renderHistory(items);
  } catch (error) {
    activityCountEl.textContent = "gagal memuat";
    activityListEl.innerHTML = `<div class="empty-state">[!] ${escapeHtml(errorMessage(error, "Riwayat gagal dimuat."))}</div>`;
  }
}

function renderHistory(items: HistoryItem[]) {
  activityCountEl.textContent = `${items.length} dari maksimal 100 scan`;
  if (items.length === 0) {
    activityListEl.innerHTML = '<div class="empty-state">[ ] Belum ada aktivitas scan.</div>';
    return;
  }
  activityListEl.innerHTML = items
    .map((item) => {
      const status = item.typed ? "[x] typed" : "[!] failed";
      const statusClass = item.typed ? "activity-status" : "activity-status failed";
      const metadata = `${formatTimestamp(item.receivedAt)} / ${item.symbology ?? "UNKNOWN"}`;
      const message = item.message
        ? `<div class="activity-message">${escapeHtml(item.message)}</div>`
        : "";
      return `<article class="activity-item">
        <div class="activity-barcode">${escapeHtml(item.barcode)}</div>
        <div class="${statusClass}">${status}</div>
        <div class="activity-meta">${escapeHtml(metadata)}</div>
        ${message}
      </article>`;
    })
    .join("");
}

async function clearHistory() {
  if (!window.confirm("Hapus seluruh riwayat scan lokal? Tindakan ini tidak dapat dibatalkan.")) return;
  try {
    await invoke("clear_history");
    renderHistory([]);
  } catch (error) {
    activityListEl.innerHTML = `<div class="empty-state">[!] ${escapeHtml(errorMessage(error, "Riwayat gagal dihapus."))}</div>`;
  }
}

async function disconnectSession() {
  const pairing = currentPairing ?? (await invoke<PairingInfo>("get_pairing_info"));
  if (activeChannel) {
    await activeChannel.send({
      type: "broadcast",
      event: "desktop_status",
      payload: {
        type: "desktop_status",
        sessionId: pairing.sessionId,
        status: "idle",
        deviceCount: 0,
        timestamp: new Date().toISOString()
      }
    });
  }
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  await invoke("reset_pairing_code");
  window.location.reload();
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) return error;
  return error instanceof Error ? error.message : fallback;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[character];
  });
}

document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab as TabName));
});
byId<HTMLButtonElement>("save-settings").addEventListener("click", () => void saveSettings());
byId<HTMLButtonElement>("send-test").addEventListener("click", () => void sendTestScan());
byId<HTMLButtonElement>("clear-history").addEventListener("click", () => void clearHistory());
byId<HTMLButtonElement>("copy-code").addEventListener("click", async () => {
  const pairing = currentPairing ?? (await invoke<PairingInfo>("get_pairing_info"));
  await navigator.clipboard.writeText(pairing.sessionId);
  setMessage(summaryMessageEl, `kode.disalin / ${formatPairingCode(pairing.sessionId)}`, "success");
});
byId<HTMLButtonElement>("new-code").addEventListener("click", async () => {
  await invoke("reset_pairing_code");
  window.location.reload();
});
byId<HTMLButtonElement>("disconnect-session").addEventListener("click", () => void disconnectSession());
autoEnterEl.addEventListener("change", () => {
  if (autoEnterEl.checked) autoTabEl.checked = false;
});
autoTabEl.addEventListener("change", () => {
  if (autoTabEl.checked) autoEnterEl.checked = false;
});

void listen("tray-opened", () => {
  activateTab("summary");
  void loadStatus(false);
  void loadHistory();
});

async function initialize() {
  try {
    await Promise.all([loadPairing(), loadStatus(false), loadSettings(), loadHistory()]);
    await startRealtime();
  } catch (error) {
    statusEl.textContent = "[!] gagal memuat";
    statusEl.dataset.state = "error";
    setMessage(summaryMessageEl, errorMessage(error, "Aplikasi gagal dimuat."), "error");
  }
}

void initialize();

window.setInterval(() => {
  void loadStatus(false);
}, 2000);
