let scannerAudio: HTMLAudioElement | null = null;

export function prepareScannerSound(): void {
  scannerAudio ??= new Audio("/scanner-beep.mp3");
  scannerAudio.preload = "auto";
  scannerAudio.load();
}

export function scannerSuccessSound(): void {
  prepareScannerSound();
  if (!scannerAudio) return;
  scannerAudio.currentTime = 0;
  void scannerAudio.play().catch(() => {
    // Some browsers can still block audio until the first user interaction.
  });
}

export function vibrate(pattern: number | number[] = 120): void {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
