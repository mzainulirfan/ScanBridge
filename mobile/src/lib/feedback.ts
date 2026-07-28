let scannerAudio: HTMLAudioElement | null = null;

export function scannerSuccessSound(): void {
  scannerAudio ??= new Audio("/scanner-beep.mp3");
  scannerAudio.preload = "auto";
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
