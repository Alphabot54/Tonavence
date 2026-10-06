import { AudioContext } from 'react-native-audio-api';

const ctx = new AudioContext();

export function playTones(
  freqs: number[],
  duration: number = 1,
  startOffset: number = 0, // seconds between each note (0 = chord)
): void {
  const t = ctx.currentTime;
  const volume = 0.5 / freqs.length;

  freqs.forEach((freq, i) => {
    const start = t + i * startOffset;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'triangle';
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.start(start);
    osc.stop(start + duration);
  });
}