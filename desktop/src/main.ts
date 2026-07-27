import { invoke } from "@tauri-apps/api/core";
import { createSupabaseDesktopClient, subscribeDesktopSession } from "./lib/realtime";
import "./styles.css";

type PairingInfo = {
  sessionId: string;
  channelName: string;
  pairingUrl: string;
  qrPlaceholder: string;
};

type DesktopSettings = {
  autoEnter: boolean;
  autoTab: boolean;
  prefix: string;
  suffix: string;
  historyEnabled: boolean;
  historyLimit: number;
};

const statusEl = document.querySelector<HTMLSpanElement>("#status")!;
const relayStatusEl = document.querySelector<HTMLElement>("#relay-status")!;
const mobileStatusEl = document.querySelector<HTMLElement>("#mobile-status")!;
const lastEventEl = document.querySelector<HTMLElement>("#last-event")!;
const lastScanEl = document.querySelector<HTMLElement>("#last-scan")!;
const pairingCodeEl = document.querySelector<HTMLElement>("#pairing-code")!;
const pairingUrlEl = document.querySelector<HTMLParagraphElement>("#pairing-url")!;
const copyCodeEl = document.querySelector<HTMLButtonElement>("#copy-code")!;
const newCodeEl = document.querySelector<HTMLButtonElement>("#new-code")!;
const autoEnterEl = document.querySelector<HTMLInputElement>("#auto-enter")!;
const autoTabEl = document.querySelector<HTMLInputElement>("#auto-tab")!;
const prefixEl = document.querySelector<HTMLInputElement>("#prefix")!;
const suffixEl = document.querySelector<HTMLInputElement>("#suffix")!;
const saveSettingsEl = document.querySelector<HTMLButtonElement>("#save-settings")!;
const barcodeEl = document.querySelector<HTMLInputElement>("#test-barcode")!;
const sendTestEl = document.querySelector<HTMLButtonElement>("#send-test")!;
const ackEl = document.querySelector<HTMLParagraphElement>("#ack")!;
let statusPoll: number | null = null;
let autoHidden = false;

async function loadPairing() {
  const pairing = await invoke<PairingInfo>("get_pairing_info");
  pairingCodeEl.textContent = formatPairingCode(pairing.sessionId);
  pairingUrlEl.textContent = `Enter this code on mobile: ${formatPairingCode(pairing.sessionId)}`;
}

function formatPairingCode(value: string): string {
  const clean = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6);
  return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean;
}

async function loadStatus() {
  const status = await invoke<{ status: string }>("get_status");
  statusEl.textContent = status.status;
  statusEl.dataset.state = status.status === "connected" ? "active" : "idle";
  if (status.status === "connected" && !autoHidden) {
    autoHidden = true;
    await invoke("hide_main_window");
  }
}

async function startRealtime() {
  const pairing = await invoke<PairingInfo>("get_pairing_info");
  const supabase = createSupabaseDesktopClient();
  if (!supabase) {
    relayStatusEl.textContent = "Missing Supabase env";
    relayStatusEl.dataset.state = "error";
    mobileStatusEl.textContent = "Not connected";
    mobileStatusEl.dataset.state = "error";
    ackEl.textContent = "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in desktop/.env.local, then restart desktop.";
    return;
  }

  try {
    relayStatusEl.textContent = "Connecting";
    relayStatusEl.dataset.state = "idle";
    await subscribeDesktopSession(
      supabase,
      pairing.sessionId,
      async (event) => {
        lastEventEl.textContent = event.type;
        if (event.type !== "scan") {
          return;
        }

        lastScanEl.textContent = event.barcode;
        const ack = await invoke<{ success: boolean; message: string }>("receive_scan", {
          event
        });
        ackEl.textContent = `${ack.success ? "OK" : "Failed"}: ${ack.message}`;
      },
      async () => {
        mobileStatusEl.textContent = "Joined";
        mobileStatusEl.dataset.state = "active";
        lastEventEl.textContent = "client_joined";
        await invoke("mark_connected");
        await loadStatus();
        await invoke("hide_main_window");
      },
      async () => {
        relayStatusEl.textContent = "Subscribed";
        relayStatusEl.dataset.state = "active";
        ackEl.textContent = "relay.ready / enter pairing code on mobile";
      }
    );
  } catch (error) {
    relayStatusEl.textContent = "Failed";
    relayStatusEl.dataset.state = "error";
    mobileStatusEl.textContent = "Not connected";
    mobileStatusEl.dataset.state = "error";
    ackEl.textContent = error instanceof Error ? error.message : "Realtime connection failed";
  }
}

async function loadSettings() {
  const settings = await invoke<DesktopSettings>("get_settings");
  autoEnterEl.checked = settings.autoEnter;
  autoTabEl.checked = settings.autoTab;
  prefixEl.value = settings.prefix;
  suffixEl.value = settings.suffix;
}

saveSettingsEl.addEventListener("click", async () => {
  try {
    await invoke("update_settings", {
      settings: {
        autoEnter: autoEnterEl.checked,
        autoTab: autoTabEl.checked,
        prefix: prefixEl.value,
        suffix: suffixEl.value,
        historyEnabled: true,
        historyLimit: 100
      }
    });
    ackEl.textContent = "settings.saved";
  } catch (error) {
    ackEl.textContent = error instanceof Error ? error.message : "settings.save_failed";
  }
});

sendTestEl.addEventListener("click", async () => {
  const pairing = await invoke<PairingInfo>("get_pairing_info");
  const ack = await invoke<{ success: boolean; message: string }>("receive_scan", {
    event: {
      type: "scan",
      sessionId: pairing.sessionId,
      barcode: barcodeEl.value,
      timestamp: new Date().toISOString(),
      source: "mobile"
    }
  });
  ackEl.textContent = `${ack.success ? "OK" : "Failed"}: ${ack.message}`;
});

copyCodeEl.addEventListener("click", async () => {
  const pairing = await invoke<PairingInfo>("get_pairing_info");
  await navigator.clipboard.writeText(pairing.sessionId);
  ackEl.textContent = `Copied code ${formatPairingCode(pairing.sessionId)}`;
});

newCodeEl.addEventListener("click", async () => {
  await invoke("reset_pairing_code");
  window.location.reload();
});

void loadPairing();
void loadStatus();
void loadSettings();
void startRealtime();

statusPoll = window.setInterval(() => {
  void loadStatus();
}, 2000);
