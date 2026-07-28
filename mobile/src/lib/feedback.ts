let audioContext: AudioContext | null = null;

export function scannerSuccessSound(): void {
  const AudioContextCtor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return;
  }

  audioContext ??= new AudioContextCtor();
  const context = audioContext;
  void context.resume();

  const gain = context.createGain();
  const firstTone = context.createOscillator();
  const secondTone = context.createOscillator();
  const start = context.currentTime;
  const firstEnd = start + 0.045;
  const secondEnd = start + 0.115;

  firstTone.type = "triangle";
  firstTone.frequency.setValueAtTime(1850, start);
  secondTone.type = "triangle";
  secondTone.frequency.setValueAtTime(1450, firstEnd);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.12, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, firstEnd);
  gain.gain.exponentialRampToValueAtTime(0.1, firstEnd + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, secondEnd);

  firstTone.connect(gain);
  secondTone.connect(gain);
  gain.connect(context.destination);
  firstTone.start(start);
  firstTone.stop(firstEnd);
  secondTone.start(firstEnd);
  secondTone.stop(secondEnd);
}

export function vibrate(pattern: number | number[] = 120): void {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}
