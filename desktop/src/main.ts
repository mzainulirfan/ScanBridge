import { invoke } from "@tauri-apps/api/core";
import QRCode from "qrcode";
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
const qrEl = document.querySelector<HTMLCanvasElement>("#qr")!;
const pairingUrlEl = document.querySelector<HTMLParagraphElement>("#pairing-url")!;
const autoEnterEl = document.querySelector<HTMLInputElement>("#auto-enter")!;
const autoTabEl = document.querySelector<HTMLInputElement>("#auto-tab")!;
const prefixEl = document.querySelector<HTMLInputElement>("#prefix")!;
const suffixEl = document.querySelector<HTMLInputElement>("#suffix")!;
const saveSettingsEl = document.querySelector<HTMLButtonElement>("#save-settings")!;
const barcodeEl = document.querySelector<HTMLInputElement>("#test-barcode")!;
const sendTestEl = document.querySelector<HTMLButtonElement>("#send-test")!;
const ackEl = document.querySelector<HTMLParagraphElement>("#ack")!;

async function loadPairing() {
  const pairing = await invoke<PairingInfo>("get_pairing_info");
  await QRCode.toCanvas(qrEl, pairing.pairingUrl, {
    width: 240,
    margin: 2,
    color: {
      dark: "#0f172a",
      light: "#f8fafc"
    }
  });
  pairingUrlEl.textContent = pairing.pairingUrl;
}

async function loadStatus() {
  const status = await invoke<{ status: string }>("get_status");
  statusEl.textContent = status.status;
}

async function loadSettings() {
  const settings = await invoke<DesktopSettings>("get_settings");
  autoEnterEl.checked = settings.autoEnter;
  autoTabEl.checked = settings.autoTab;
  prefixEl.value = settings.prefix;
  suffixEl.value = settings.suffix;
}

saveSettingsEl.addEventListener("click", () => {
  void invoke("update_settings", {
    settings: {
      autoEnter: autoEnterEl.checked,
      autoTab: autoTabEl.checked,
      prefix: prefixEl.value,
      suffix: suffixEl.value,
      historyEnabled: true,
      historyLimit: 100
    }
  });
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

void loadPairing();
void loadStatus();
void loadSettings();
