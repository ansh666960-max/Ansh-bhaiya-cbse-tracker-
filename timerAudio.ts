/**
 * Web Audio API synthesizer for study timer chime & notification trigger
 */

export function playTimerCompletionChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const startTime = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime + idx * 0.16);

      gain.gain.setValueAtTime(0, startTime + idx * 0.16);
      gain.gain.linearRampToValueAtTime(0.3, startTime + idx * 0.16 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + idx * 0.16 + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime + idx * 0.16);
      osc.stop(startTime + idx * 0.16 + 0.85);
    });
  } catch (e) {
    console.warn('Audio chime could not play:', e);
  }
}

export function playLapChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // ignore
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
}

export function sendTimerCompletionNotification(subjectName: string, durationMinutes: number) {
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification('⏰ Study Session Completed!', {
        body: `Awesome job! You completed ${durationMinutes} minutes of focused ${subjectName} revision.`,
        icon: '/logo.png',
        badge: '/pwa-192x192.png',
      });
    } catch {
      // ignore
    }
  }
}
