import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check as checkUpdate } from "@tauri-apps/plugin-updater";
import QRCode from "qrcode";
import { createSupabaseDesktopClient, subscribeDesktopSession } from "./lib/realtime";
import { HEARTBEAT_INTERVAL_MS, PEER_TIMEOUT_MS } from "../../shared/realtime-session";
import "./styles.css";

type TabName = "summary" | "output" | "activity";
type PairingInfo = { sessionId: string; pairingUrl: string; hasTrustedClient: boolean };
type DesktopStatus = { status: string; clientId?: string };
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
const pairingQrEl = byId<HTMLImageElement>("pairing-qr");
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
const clearHistoryDialogEl = byId<HTMLDialogElement>("clear-history-dialog");
const cancelClearHistoryEl = byId<HTMLButtonElement>("cancel-clear-history");
const confirmClearHistoryEl = byId<HTMLButtonElement>("confirm-clear-history");
const updateBannerEl = byId<HTMLElement>("update-banner");
const updateMessageEl = byId<HTMLElement>("update-message");
const updateInstallEl = byId<HTMLButtonElement>("update-install");
const updateDismissEl = byId<HTMLButtonElement>("update-dismiss");
const overviewEl = byId<HTMLElement>("connection-overview");
const connectionTitleEl = byId<HTMLElement>("connection-title");
const connectionDescriptionEl = byId<HTMLElement>("connection-description");
const retryConnectionEl = byId<HTMLButtonElement>("retry-connection");
const resetPairingDialogEl = byId<HTMLDialogElement>("reset-pairing-dialog");
const cancelResetPairingEl = byId<HTMLButtonElement>("cancel-reset-pairing");
const confirmResetPairingEl = byId<HTMLButtonElement>("confirm-reset-pairing");
const historySearchEl = byId<HTMLInputElement>("history-search");
const checkUpdateEl = byId<HTMLButtonElement>("check-update");
const updateStatusEl = byId<HTMLElement>("update-status");

let activeChannel: Awaited<ReturnType<typeof subscribeDesktopSession>> | null = null;
let heartbeatEnabled = false;
let watchdogEnabled = false;
let lastDesktopBroadcastAt = 0;
let relayOnline = false;
let mobileOnline = false;
let startingRealtime = false;
let stoppingRealtime = false;
let retryRealtimeAt = 0;
let desktopSupabase: ReturnType<typeof createSupabaseDesktopClient> = null;
let lastMobileSeenAt = 0;
let autoHidden = false;
let currentPairing: PairingInfo | null = null;
let activeClientId: string | null = null;
let settingsHistoryLimit = 100;
let pendingUpdate: Awaited<ReturnType<typeof checkUpdate>> | null = null;
let lastContactAt = 0;
let configurationMissing = false;
let savedSettings: DesktopSettings | null = null;
let historyItems: HistoryItem[] = [];
let historyFilter = "all";
let latestScan: HistoryItem | null = null;
let testInProgress = false;

function setMessage(element: HTMLElement, message: string, state: "idle" | "success" | "error" = "idle") {
  element.textContent = message;
  element.dataset.state = state;
}

function activateTab(tab: TabName) {
  const content = document.querySelector<HTMLElement>(".tab-content");
  if (content) content.scrollTop = 0;
  document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
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
  renderConnectionOverview();
  try {
    pairingQrEl.src = await QRCode.toDataURL(currentPairing.pairingUrl, {
      width: 180,
      margin: 1,
      color: { dark: "#201d1d", light: "#fdfcfc" }
    });
    pairingQrEl.hidden = false;
  } catch {
    pairingQrEl.hidden = true;
  }
}

function renderConnectionOverview() {
  const hasPairing = Boolean(currentPairing?.hasTrustedClient || activeClientId);
  const connected = relayOnline && mobileOnline;
  const reconnecting = !relayOnline && Boolean(retryRealtimeAt);
  let title = "Menyiapkan koneksi";
  let description = "Memeriksa koneksi dan perangkat tersimpan…";
  let badge = "Menghubungkan";
  let state = "loading";
  if (configurationMissing) {
    title = "Koneksi belum dikonfigurasi";
    description = "Aplikasi belum dapat mengakses layanan koneksi. Hubungi pengelola aplikasi.";
    badge = "Konfigurasi diperlukan";
    state = "error";
  } else if (connected) {
    title = "Siap menerima barcode";
    description = "Klik kolom tujuan di Excel, aplikasi kasir, atau aplikasi lain. Lalu pindai dari ponsel.";
    badge = "Siap memindai";
    state = "active";
  } else if (relayOnline) {
    title = hasPairing ? "Menunggu ponsel kembali" : "Hubungkan ponsel Anda";
    description = hasPairing
      ? "Pairing tetap tersimpan. Buka kembali ScanBridge Mobile dan pastikan ponsel terhubung ke internet."
      : "Pindai QR di bawah dengan ScanBridge Mobile, atau salin kode pairing ke ponsel.";
    badge = hasPairing ? "Ponsel belum tersambung" : "Menunggu ponsel";
    state = hasPairing && lastContactAt ? "error" : "idle";
  } else if (reconnecting || (!startingRealtime && heartbeatEnabled)) {
    title = "Koneksi server terputus";
    const seconds = Math.max(0, Math.ceil((retryRealtimeAt - Date.now()) / 1000));
    description = navigator.onLine === false
      ? "Komputer sedang offline. Koneksi akan dilanjutkan saat internet tersedia kembali."
      : `Periksa internet komputer. ${seconds > 0 ? `Mencoba kembali dalam ${seconds} detik.` : "Menyambungkan kembali…"} Pairing tetap tersimpan.`;
    badge = "Menyambungkan ulang";
    state = "error";
  }
  overviewEl.dataset.state = state;
  byId("app-frame").dataset.connected = String(connected);
  byId("app-frame").dataset.paired = String(hasPairing);
  byId("live-caption").dataset.state = relayOnline ? "active" : "idle";
  byId("live-caption-text").textContent = relayOnline ? "Pembaruan langsung" : "Menunggu koneksi";
  byId("pairing-heading").textContent = hasPairing ? "Pairing perangkat" : "Hubungkan ponsel";
  byId("pairing-instruction").textContent = connected
    ? "Ponsel sudah terhubung. Pairing ini tetap tersedia saat aplikasi dibuka kembali."
    : hasPairing ? "Buka kembali ScanBridge Mobile. Anda bisa memakai kode pairing yang sama."
    : "Pindai QR dengan kamera ponsel. ScanBridge Mobile akan terbuka otomatis.";
  connectionTitleEl.textContent = title;
  connectionDescriptionEl.textContent = description;
  if (statusEl.textContent !== badge) statusEl.textContent = badge;
  statusEl.dataset.state = state;
  relayStatusEl.textContent = relayOnline ? "aktif" : configurationMissing ? "belum dikonfigurasi" : startingRealtime ? "menghubungkan" : reconnecting ? "terputus" : "menyiapkan";
  relayStatusEl.dataset.state = relayOnline ? "active" : state === "error" ? "error" : "loading";
  mobileStatusEl.textContent = connected ? "terhubung" : hasPairing ? "terputus" : "belum terhubung";
  mobileStatusEl.dataset.state = connected ? "active" : hasPairing ? "error" : "idle";
  sessionStateEl.textContent = hasPairing ? "Pairing tersimpan" : "Sesi baru";
  pairingUrlEl.textContent = hasPairing ? "Pairing tersimpan. Gunakan kode baru hanya untuk mengganti perangkat." : "Kode ini menghubungkan ponsel ke komputer Anda.";
  byId("device-label").textContent = activeClientId ? `ID …${activeClientId.slice(-6)}` : hasPairing ? "Perangkat tersimpan" : "Belum dipasangkan";
  byId("output-status").textContent = connected ? "Siap mengetik" : relayOnline ? "Menunggu ponsel" : "Menunggu koneksi";
  byId("output-status").dataset.state = connected ? "active" : "idle";
  byId("last-seen").textContent = lastContactAt ? relativeContact(lastContactAt) : "Belum ada kontak";
  retryConnectionEl.hidden = relayOnline || configurationMissing || !reconnecting;
  retryConnectionEl.disabled = startingRealtime || navigator.onLine === false;
  byId<HTMLButtonElement>("disconnect-session").disabled = !hasPairing;
}

function relativeContact(timestamp: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 3) return "Baru saja";
  if (seconds < 60) return `${seconds} detik lalu`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} menit lalu` : `${Math.floor(minutes / 60)} jam lalu`;
}

function formatPairingCode(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 32);
  return clean.match(/.{1,8}/g)?.join(" ") ?? clean;
}

async function broadcastDesktopStatus() {
  const connection = activeChannel;
  const pairing = currentPairing;
  if (!connection || !pairing || !relayOnline) return;
  try {
    const currentStatus = await invoke<DesktopStatus>("get_status");
    if (connection !== activeChannel || !relayOnline) return;
    await connection.publish({
      type: "desktop_status",
      sessionId: pairing.sessionId,
      status: currentStatus.status === "connected" ? "connected" : "waiting_pairing",
      deviceCount: currentStatus.status === "connected" ? 1 : 0,
      clientId: currentStatus.clientId,
      timestamp: new Date().toISOString()
    });
  } catch {
    if (connection === activeChannel) handleRelayLoss();
  }
}

function startDesktopHeartbeat() {
  heartbeatEnabled = true;
  lastDesktopBroadcastAt = Date.now();
  void broadcastDesktopStatus();
}

function markMobileSeen() {
  lastMobileSeenAt = Date.now();
  lastContactAt = lastMobileSeenAt;
}

function startMobileWatchdog() {
  watchdogEnabled = true;
}

async function markMobileOffline(message: string) {
  const wasOnline = mobileOnline;
  mobileOnline = false;
  lastMobileSeenAt = 0;
  autoHidden = false;
  mobileStatusEl.textContent = "terputus";
  mobileStatusEl.dataset.state = "error";
  lastEventEl.textContent = "Ponsel terputus";
  setMessage(summaryMessageEl, message, "error");
  renderConnectionOverview();
  await invoke("mark_disconnected");
  await loadStatus(false);
  if (wasOnline) await invoke("show_main_window");
}

function handleRelayLoss() {
  if (!relayOnline && retryRealtimeAt) return;
  relayOnline = false;
  relayStatusEl.textContent = "terputus / mencoba ulang";
  relayStatusEl.dataset.state = "error";
  retryRealtimeAt = Date.now() + 3000;
  void markMobileOffline("Koneksi relay terputus. Menyambungkan ulang; pairing tetap tersimpan.")
    .catch((error) => setMessage(summaryMessageEl, errorMessage(error, "Gagal memperbarui status."), "error"));
}

function connectionTick() {
  const now = Date.now();
  if (retryRealtimeAt && now >= retryRealtimeAt && navigator.onLine !== false) void startRealtime();
  if (heartbeatEnabled && now - lastDesktopBroadcastAt >= HEARTBEAT_INTERVAL_MS) {
    lastDesktopBroadcastAt = now;
    void broadcastDesktopStatus();
  }
  if (watchdogEnabled && mobileOnline && lastMobileSeenAt && now - lastMobileSeenAt >= PEER_TIMEOUT_MS) {
    void markMobileOffline("Mobile tidak merespons. Pairing tersimpan; menunggu mobile aktif kembali.")
      .catch((error) => setMessage(summaryMessageEl, errorMessage(error, "Gagal memperbarui status."), "error"));
  }
  renderConnectionOverview();
}

async function loadStatus(allowAutoHide = true) {
  const result = await invoke<DesktopStatus>("get_status");
  const connected = result.status === "connected" && relayOnline && mobileOnline;
  renderConnectionOverview();
  if (connected && allowAutoHide && !autoHidden) {
    autoHidden = true;
    await invoke("hide_main_window");
  }
}

async function startRealtime() {
  if (startingRealtime || stoppingRealtime) return;
  startingRealtime = true;
  retryRealtimeAt = 0;
  const pairing = currentPairing ?? (await invoke<PairingInfo>("get_pairing_info"));
  const supabase = desktopSupabase ??= createSupabaseDesktopClient();
  if (!supabase) {
    configurationMissing = true;
    startingRealtime = false;
    relayStatusEl.textContent = "env belum diatur";
    relayStatusEl.dataset.state = "error";
    mobileStatusEl.textContent = "tidak terhubung";
    mobileStatusEl.dataset.state = "error";
    statusEl.textContent = "[!] konfigurasi";
    statusEl.dataset.state = "error";
    setMessage(
      summaryMessageEl,
      "Konfigurasi koneksi belum tersedia. Hubungi pengelola aplikasi untuk mendapatkan installer yang sesuai.",
      "error"
    );
    renderConnectionOverview();
    return;
  }

  try {
    renderConnectionOverview();
    const previous = activeChannel;
    activeChannel = null;
    await previous?.disconnect();
    relayStatusEl.textContent = "menghubungkan";
    relayStatusEl.dataset.state = "loading";
    activeChannel = await subscribeDesktopSession(
      supabase,
      pairing.sessionId,
      async (event) => {
        if (!mobileOnline || event.type !== "scan" || event.clientId !== activeClientId) return null;
        markMobileSeen();
        lastEventEl.textContent = "Barcode diterima";

        try {
          const ack = await invoke<{
            type: "scan_ack";
            scanId: string;
            sessionId: string;
            barcode: string;
            success: boolean;
            message: string;
            timestamp: string;
          }>("receive_scan", { event });
          latestScan = { barcode: ack.barcode, symbology: event.symbology, receivedAt: ack.timestamp, typed: ack.success, message: ack.success ? null : ack.message };
          renderLatestScan();
          void loadHistory();
          setMessage(
            summaryMessageEl,
            ack.success ? "Barcode berhasil diketik ke aplikasi tujuan." : `Barcode gagal diketik: ${ack.message}`,
            ack.success ? "success" : "error"
          );
          return ack;
        } catch (error) {
          const message = errorMessage(error, "Gagal mengetik barcode.");
          latestScan = { barcode: event.barcode, symbology: event.symbology, receivedAt: new Date().toISOString(), typed: false, message };
          renderLatestScan();
          setMessage(summaryMessageEl, message, "error");
          return null;
        }
      },
      async (clientId) => {
        try {
          await invoke("mark_connected", { clientId });
          activeClientId = clientId;
          if (currentPairing) currentPairing.hasTrustedClient = true;
          mobileOnline = true;
          markMobileSeen();
          mobileStatusEl.textContent = "terhubung";
          mobileStatusEl.dataset.state = "active";
          lastEventEl.textContent = "Ponsel terhubung";
          setMessage(summaryMessageEl, "Ponsel terhubung. Pilih kolom tujuan di komputer untuk mulai memindai.", "success");
          await loadStatus();
          await broadcastDesktopStatus();
        } catch {
          setMessage(summaryMessageEl, "Ponsel lain mencoba terhubung. Putus dan reset pairing jika ingin mengganti perangkat.", "error");
        }
      },
      async (clientId) => {
        if (activeClientId !== clientId) return;
        lastMobileSeenAt = 0;
        mobileOnline = false;
        activeClientId = null;
        mobileStatusEl.textContent = "menunggu";
        mobileStatusEl.dataset.state = "idle";
        lastEventEl.textContent = "Pairing diputus dari ponsel";
        autoHidden = false;
        await invoke("reset_pairing_code");
        await invoke("show_main_window");
        window.location.reload();
      },
      async (clientId) => {
        if (activeClientId !== clientId) return;
        if (!mobileOnline) {
          await invoke("mark_connected", { clientId });
          mobileOnline = true;
          mobileStatusEl.textContent = "terhubung";
          mobileStatusEl.dataset.state = "active";
          await loadStatus(false);
          await broadcastDesktopStatus();
        }
        markMobileSeen();
      },
      async () => {
        relayStatusEl.textContent = "aktif";
        relayStatusEl.dataset.state = "active";
        if (!mobileOnline) setMessage(summaryMessageEl, "Server terhubung. Hubungkan ponsel untuk mulai memindai.", "success");
      },
      async (clientId) => {
        if (activeClientId !== clientId) return;
        await markMobileOffline("Mobile terputus. Pairing tersimpan; buka kembali aplikasi di ponsel.");
      },
      (state) => {
        if (state === "connected") {
          relayOnline = true;
          retryRealtimeAt = 0;
        } else if (state === "disconnected") {
          handleRelayLoss();
        }
      }
    );
    startDesktopHeartbeat();
    startMobileWatchdog();
  } catch (error) {
    handleRelayLoss();
    relayStatusEl.textContent = "gagal";
    relayStatusEl.dataset.state = "error";
    mobileStatusEl.textContent = "tidak terhubung";
    mobileStatusEl.dataset.state = "error";
    statusEl.textContent = "[!] relay gagal";
    statusEl.dataset.state = "error";
    setMessage(summaryMessageEl, errorMessage(error, "Koneksi realtime gagal."), "error");
  } finally {
    startingRealtime = false;
    renderConnectionOverview();
  }
}

async function loadSettings() {
  const settings = await invoke<DesktopSettings>("get_settings");
  applySettings(settings);
}

function applySettings(settings: DesktopSettings) {
  savedSettings = settings;
  autoEnterEl.checked = settings.autoEnter;
  autoTabEl.checked = settings.autoTab;
  historyEnabledEl.checked = settings.historyEnabled;
  prefixEl.value = settings.prefix;
  suffixEl.value = settings.suffix;
  settingsHistoryLimit = settings.historyLimit;
  byId("history-limit-note").textContent = `Menyimpan hingga ${settingsHistoryLimit} scan terbaru secara lokal.`;
  byId("output-mode").textContent = settings.autoEnter ? "Barcode + Enter" : settings.autoTab ? "Barcode + Tab" : "Barcode saja";
  renderOutputPreview();
  renderStatistics();
}

function readSettings(): DesktopSettings {
  return { autoEnter: autoEnterEl.checked, autoTab: autoTabEl.checked, prefix: prefixEl.value,
    suffix: suffixEl.value, historyEnabled: historyEnabledEl.checked, historyLimit: settingsHistoryLimit };
}

function renderOutputPreview() {
  const draft = readSettings();
  byId("preview-prefix").textContent = draft.prefix;
  byId("preview-suffix").textContent = draft.suffix;
  const key = byId("preview-key");
  key.hidden = !draft.autoEnter && !draft.autoTab;
  key.textContent = draft.autoEnter ? "Enter ↵" : "Tab ⇥";
  const dirty = Boolean(savedSettings && JSON.stringify(draft) !== JSON.stringify({
    autoEnter: savedSettings.autoEnter, autoTab: savedSettings.autoTab, prefix: savedSettings.prefix,
    suffix: savedSettings.suffix, historyEnabled: savedSettings.historyEnabled, historyLimit: savedSettings.historyLimit
  }));
  byId("settings-state").textContent = dirty ? "Belum disimpan" : "Tersimpan";
  byId("settings-state").dataset.state = dirty ? "pending" : "saved";
  byId<HTMLButtonElement>("save-settings").disabled = !dirty;
  byId("settings-save-hint").textContent = dirty ? "Simpan untuk menerapkan perubahan." : "Berlaku untuk scan berikutnya.";
}

async function saveSettings() {
  const button = byId<HTMLButtonElement>("save-settings");
  button.disabled = true;
  try {
    const settings = await invoke<DesktopSettings>("update_settings", { settings: readSettings() });
    applySettings(settings);
    await loadHistory();
    setMessage(outputMessageEl, "Pengaturan tersimpan. Scan berikutnya menggunakan format ini.", "success");
  } catch (error) {
    setMessage(outputMessageEl, errorMessage(error, "Pengaturan gagal disimpan."), "error");
    button.disabled = false;
  }
}

async function sendTestScan() {
  if (testInProgress) return;
  const value = testBarcodeEl.value.trim();
  if (!value) {
    setMessage(outputMessageEl, "Masukkan barcode uji terlebih dahulu.", "error");
    testBarcodeEl.focus();
    return;
  }
  testInProgress = true;
  const button = byId<HTMLButtonElement>("send-test");
  button.disabled = true;
  try {
    for (let seconds = 3; seconds > 0; seconds--) {
      button.textContent = `Mengetik dalam ${seconds} detik…`;
      setMessage(outputMessageEl, `Pindah ke kolom tujuan sekarang. Pengetikan dimulai dalam ${seconds} detik, menggunakan pengaturan yang sudah disimpan.`);
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1000));
    }
    const typed = await invoke<string>("test_scan", { barcode: value });
    setMessage(outputMessageEl, `Uji selesai. Teks dikirim ke kolom aktif: ${typed}`, "success");
  } catch (error) {
    setMessage(outputMessageEl, errorMessage(error, "Uji output gagal."), "error");
  } finally {
    testInProgress = false;
    button.disabled = false;
    button.textContent = "Mulai uji pengetikan";
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
  historyItems = items;
  if (!latestScan && items.length) latestScan = items[0];
  renderLatestScan();
  renderStatistics();
  renderHistoryList();
}

function renderStatistics() {
  byId("scan-total").textContent = String(historyItems.length);
  byId("scan-success").textContent = String(historyItems.filter(item => item.typed).length);
  byId("scan-failed").textContent = String(historyItems.filter(item => !item.typed).length);
  byId("history-tab-count").textContent = String(historyItems.length);
  byId<HTMLButtonElement>("clear-history").disabled = historyItems.length === 0;
  byId("history-summary-note").textContent = savedSettings?.historyEnabled === false
    ? "Penyimpanan riwayat dinonaktifkan. Jumlah di atas berasal dari riwayat yang masih tersimpan."
    : `Jumlah berdasarkan riwayat lokal, maksimal ${settingsHistoryLimit} scan terbaru.`;
}

function renderLatestScan() {
  const result = byId("last-scan-result");
  lastScanEl.textContent = latestScan?.barcode ?? "—";
  result.textContent = latestScan ? latestScan.typed ? "Berhasil diketik" : "Gagal diketik" : "Belum ada scan";
  result.dataset.state = latestScan ? latestScan.typed ? "active" : "error" : "idle";
  byId("last-scan-detail").textContent = latestScan
    ? `${latestScan.symbology || "Format tidak diketahui"} · ${formatTimestamp(latestScan.receivedAt)}${latestScan.message ? ` · ${latestScan.message}` : ""}`
    : "Hasil dan waktu scan akan tampil di sini.";
}

function renderHistoryList() {
  const search = historySearchEl.value.trim().toLocaleLowerCase("id-ID");
  const items = historyItems.filter(item =>
    (historyFilter === "all" || (historyFilter === "success" ? item.typed : !item.typed)) &&
    `${item.barcode} ${item.symbology ?? ""} ${item.message ?? ""}`.toLocaleLowerCase("id-ID").includes(search)
  );
  activityCountEl.textContent = `${items.length} dari ${historyItems.length} scan tersimpan · maksimal ${settingsHistoryLimit} terbaru`;
  if (!items.length) {
    activityListEl.innerHTML = historyItems.length
      ? '<div class="empty-state"><strong>Tidak ada hasil yang cocok</strong><span>Coba kata pencarian atau filter lain.</span></div>'
      : `<div class="empty-state"><strong>Belum ada scan tersimpan</strong><span>${savedSettings?.historyEnabled === false ? "Aktifkan penyimpanan riwayat di Pengaturan untuk mencatat scan berikutnya." : "Hubungkan ponsel dan pindai barcode. Riwayat akan muncul di sini."}</span></div>`;
    return;
  }
  const rows = items
    .map((item) => {
      const message = item.message
        ? `<div class="activity-message">${escapeHtml(item.message)}</div>`
        : "";
      return `<tr><td><div class="activity-barcode">${escapeHtml(item.barcode)}</div>${message}</td>
        <td>${escapeHtml(item.symbology || "—")}</td><td>${escapeHtml(formatTimestamp(item.receivedAt))}</td>
        <td><span class="result-tag" data-state="${item.typed ? "active" : "error"}">${item.typed ? "Diketik" : "Gagal"}</span></td></tr>`;
    })
    .join("");
  activityListEl.innerHTML = `<table class="history-table"><thead><tr><th scope="col">Barcode</th><th scope="col">Format</th><th scope="col">Waktu scan</th><th scope="col">Hasil</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function clearHistory() {
  confirmClearHistoryEl.disabled = true;
  confirmClearHistoryEl.textContent = "Menghapus…";
  try {
    await invoke("clear_history");
    latestScan = null;
    renderHistory([]);
    clearHistoryDialogEl.close();
  } catch (error) {
    activityListEl.innerHTML = `<div class="empty-state">[!] ${escapeHtml(errorMessage(error, "Riwayat gagal dihapus."))}</div>`;
    clearHistoryDialogEl.close();
  } finally {
    confirmClearHistoryEl.disabled = false;
    confirmClearHistoryEl.textContent = "Hapus riwayat";
  }
}

function openClearHistoryDialog() {
  if (clearHistoryDialogEl.open) return;
  clearHistoryDialogEl.showModal();
  cancelClearHistoryEl.focus();
}

async function disconnectSession() {
  stoppingRealtime = true;
  const pairing = currentPairing ?? (await invoke<PairingInfo>("get_pairing_info"));
  try {
    if (activeChannel) await activeChannel.publish({
        type: "desktop_status",
        sessionId: pairing.sessionId,
        status: "idle",
        deviceCount: 0,
        timestamp: new Date().toISOString()
    });
  } catch {
    // Reset still completes when the relay is unavailable.
  }
  heartbeatEnabled = false;
  watchdogEnabled = false;
  retryRealtimeAt = 0;
  relayOnline = false;
  await activeChannel?.disconnect();
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

async function checkForUpdates() {
  if (checkUpdateEl.disabled) return;
  checkUpdateEl.disabled = true;
  updateStatusEl.textContent = "Memeriksa pembaruan…";
  try {
    const update = await checkUpdate();
    if (!update) {
      updateStatusEl.textContent = "Tidak ada pembaruan";
      return;
    }
    pendingUpdate = update;
    updateInstallEl.hidden = false;
    updateMessageEl.textContent = `Versi baru tersedia: ${update.version}`;
    updateStatusEl.textContent = `Versi ${update.version} tersedia`;
    updateBannerEl.hidden = false;
  } catch (error) {
    updateStatusEl.textContent = "Pembaruan belum dapat diperiksa";
    updateStatusEl.title = errorMessage(error, "Layanan pembaruan belum dapat dihubungi.");
    if (!pendingUpdate) updateBannerEl.hidden = true;
  } finally {
    checkUpdateEl.disabled = false;
  }
}

document.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab as TabName));
  button.addEventListener("keydown", (event) => {
    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-tab]"));
    const index = tabs.indexOf(button);
    const offset = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 0;
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : offset ? (index + offset + tabs.length) % tabs.length : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    activateTab(tabs[nextIndex].dataset.tab as TabName);
    tabs[nextIndex].focus();
  });
});
byId<HTMLButtonElement>("save-settings").addEventListener("click", () => void saveSettings());
byId<HTMLButtonElement>("send-test").addEventListener("click", () => void sendTestScan());
byId<HTMLButtonElement>("clear-history").addEventListener("click", openClearHistoryDialog);
cancelClearHistoryEl.addEventListener("click", () => clearHistoryDialogEl.close());
confirmClearHistoryEl.addEventListener("click", () => void clearHistory());
clearHistoryDialogEl.addEventListener("click", (event) => {
  if (event.target === clearHistoryDialogEl) clearHistoryDialogEl.close();
});
byId<HTMLButtonElement>("copy-code").addEventListener("click", async () => {
  try {
    const pairing = currentPairing ?? (await invoke<PairingInfo>("get_pairing_info"));
    await navigator.clipboard.writeText(pairing.sessionId);
    setMessage(summaryMessageEl, "Kode pairing disalin. Tempelkan di ScanBridge Mobile untuk menghubungkan ponsel.", "success");
  } catch {
    setMessage(summaryMessageEl, "Kode belum dapat disalin. Masukkan kode yang tampil secara manual di ponsel.", "error");
  }
});
function openResetPairingDialog() {
  if (resetPairingDialogEl.open) return;
  resetPairingDialogEl.showModal();
  cancelResetPairingEl.focus();
}
byId<HTMLButtonElement>("new-code").addEventListener("click", openResetPairingDialog);
byId<HTMLButtonElement>("disconnect-session").addEventListener("click", openResetPairingDialog);
cancelResetPairingEl.addEventListener("click", () => resetPairingDialogEl.close());
resetPairingDialogEl.addEventListener("click", event => {
  if (event.target === resetPairingDialogEl) resetPairingDialogEl.close();
});
confirmResetPairingEl.addEventListener("click", async () => {
  confirmResetPairingEl.disabled = true;
  try {
    await disconnectSession();
  } catch (error) {
    stoppingRealtime = false;
    handleRelayLoss();
    resetPairingDialogEl.close();
    setMessage(summaryMessageEl, errorMessage(error, "Pairing belum dapat direset. Coba kembali."), "error");
  } finally {
    confirmResetPairingEl.disabled = false;
  }
});
retryConnectionEl.addEventListener("click", () => void startRealtime());
checkUpdateEl.addEventListener("click", () => void checkForUpdates());
historySearchEl.addEventListener("input", renderHistoryList);
document.querySelectorAll<HTMLButtonElement>("[data-history-filter]").forEach(button => {
  button.addEventListener("click", () => {
    historyFilter = button.dataset.historyFilter ?? "all";
    document.querySelectorAll<HTMLButtonElement>("[data-history-filter]").forEach(filter => {
      const active = filter === button;
      filter.classList.toggle("active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    renderHistoryList();
  });
});
updateInstallEl.addEventListener("click", async () => {
  if (!pendingUpdate) return;
  updateInstallEl.disabled = true;
  updateInstallEl.textContent = "Mengunduh…";
  updateMessageEl.textContent = "Mengunduh pembaruan...";
  let downloaded = 0;
  let total: number | undefined;
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  try {
    await pendingUpdate.downloadAndInstall((event) => {
      if (event.event === "Started") {
        total = event.data.contentLength;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
      } else if (event.event === "Finished") {
        updateMessageEl.textContent = "Unduhan selesai. Memasang...";
        return;
      }
      const totalMb = total ? mb(total) : 0;
      updateMessageEl.textContent =
        totalMb > 0
          ? `Mengunduh pembaruan: ${mb(downloaded)}/${totalMb} MB...`
          : `Mengunduh pembaruan: ${mb(downloaded)} MB...`;
    });
    updateMessageEl.textContent = "Pembaruan terpasang. Memulai ulang...";
    updateInstallEl.textContent = "Memulai ulang…";
    await relaunch();
  } catch (error) {
    updateMessageEl.textContent = `Gagal memasang: ${errorMessage(error, "pembaruan gagal")}`;
    updateInstallEl.disabled = false;
    updateInstallEl.textContent = "Coba pasang kembali";
  }
});
updateDismissEl.addEventListener("click", () => {
  updateBannerEl.hidden = true;
  pendingUpdate = null;
});
autoEnterEl.addEventListener("change", () => {
  if (autoEnterEl.checked) autoTabEl.checked = false;
  renderOutputPreview();
});
autoTabEl.addEventListener("change", () => {
  if (autoTabEl.checked) autoEnterEl.checked = false;
  renderOutputPreview();
});
historyEnabledEl.addEventListener("change", renderOutputPreview);
prefixEl.addEventListener("input", renderOutputPreview);
suffixEl.addEventListener("input", renderOutputPreview);

void listen("tray-opened", () => {
  activateTab("summary");
  void loadStatus(false);
  void loadHistory();
});

async function initialize() {
  try {
    await listen("connection-tick", connectionTick);
    window.addEventListener("offline", handleRelayLoss);
    window.addEventListener("online", () => {
      if (!relayOnline) void startRealtime();
    });
    await Promise.all([loadPairing(), loadStatus(false), loadSettings(), loadHistory()]);
    byId("app-version").textContent = `v${await getVersion()}`;
    await startRealtime();
    void checkForUpdates();
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
