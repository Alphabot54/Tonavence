// utils/pitchDetection.ts

export type PitchResult = {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
};

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

/**
 * Converts a frequency into the closest musical note.
 *
 * referenceFrequency is the frequency of A4.
 * 440 Hz is the standard default.
 */
export function frequencyToNote(
  frequency: number,
  referenceFrequency = 440
): PitchResult | null {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    return null;
  }

  const semitonesFromA4 =
    12 * Math.log2(frequency / referenceFrequency);

  const roundedSemitones = Math.round(semitonesFromA4);

  const exactNoteFrequency =
    referenceFrequency *
    Math.pow(2, roundedSemitones / 12);

  const cents =
    1200 * Math.log2(frequency / exactNoteFrequency);

  // A4 is MIDI note 69.
  const midi = 69 + roundedSemitones;

  const noteIndex = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;

  return {
    frequency,
    note: NOTE_NAMES[noteIndex],
    octave,
    cents,
  };
}

/**
 * Detects the fundamental frequency of a PCM buffer.
 *
 * Uses normalized autocorrelation.
 *
 * Designed for monophonic instruments such as guitar,
 * bass, voice, etc.
 */
export function detectPitch(
  samples: Float32Array,
  sampleRate: number
): number | null {
  if (!samples.length || sampleRate <= 0) {
    return null;
  }

  // Remove DC offset.
  let mean = 0;

  for (let i = 0; i < samples.length; i++) {
    mean += samples[i];
  }

  mean /= samples.length;

  const buffer = new Float32Array(samples.length);

  let rms = 0;

  for (let i = 0; i < samples.length; i++) {
    buffer[i] = samples[i] - mean;
    rms += buffer[i] * buffer[i];
  }

  rms = Math.sqrt(rms / samples.length);

  // Ignore extremely quiet input.
  if (rms < 0.008) {
    return null;
  }

  const minFrequency = 60;
  const maxFrequency = 1000;

  const minLag = Math.floor(sampleRate / maxFrequency);
  const maxLag = Math.floor(sampleRate / minFrequency);

  if (maxLag >= buffer.length) {
    return null;
  }

  // Normalized correlation at a single lag.
  // This is the expensive O(N) operation we want to
  // call as few times as possible.
  const normalizedCorrelationAt = (lag: number): number => {
    let correlation = 0;
    let energyA = 0;
    let energyB = 0;

    for (let i = 0; i < buffer.length - lag; i++) {
      const a = buffer[i];
      const b = buffer[i + lag];

      correlation += a * b;
      energyA += a * a;
      energyB += b * b;
    }

    if (energyA === 0 || energyB === 0) {
      return 0;
    }

    return correlation / Math.sqrt(energyA * energyB);
  };

  // ── Pass 1: coarse search ──
  // Sample every COARSE_STEP-th lag to cheaply find
  // roughly where the true peak lives.
  const COARSE_STEP = 6;

  let coarseBestLag = -1;
  let coarseBestCorrelation = 0;

  for (
    let lag = minLag;
    lag <= maxLag;
    lag += COARSE_STEP
  ) {
    const normalized = normalizedCorrelationAt(lag);

    if (normalized > coarseBestCorrelation) {
      coarseBestCorrelation = normalized;
      coarseBestLag = lag;
    }
  }

  if (coarseBestLag === -1) {
    return null;
  }

  // ── Pass 2: fine search ──
  // Sweep every lag in a small window around the coarse
  // peak, at full resolution.
  const fineStart = Math.max(
    minLag,
    coarseBestLag - COARSE_STEP
  );

  const fineEnd = Math.min(
    maxLag,
    coarseBestLag + COARSE_STEP
  );

  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = fineStart; lag <= fineEnd; lag++) {
    const normalized = normalizedCorrelationAt(lag);

    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  // Reject weak correlations.
  if (bestLag === -1 || bestCorrelation < 0.65) {
    return null;
  }

  /*
   * Parabolic interpolation improves frequency accuracy
   * beyond the integer sample lag.
   */
  let refinedLag = bestLag;

  if (bestLag > minLag && bestLag < maxLag) {
    const correlationAt = (lag: number) => {
      let correlation = 0;

      for (let i = 0; i < buffer.length - lag; i++) {
        correlation += buffer[i] * buffer[i + lag];
      }

      return correlation;
    };

    const left = correlationAt(bestLag - 1);
    const center = correlationAt(bestLag);
    const right = correlationAt(bestLag + 1);

    const denominator = 2 * (2 * center - left - right);

    if (denominator !== 0) {
      refinedLag += (left - right) / denominator;
    }
  }

  if (refinedLag <= 0) {
    return null;
  }

  return sampleRate / refinedLag;
}

/**
 * Convenience function used by the tuner.
 */
export function analyzePitch(
  samples: Float32Array,
  sampleRate: number,
  referenceFrequency = 440
): PitchResult | null {
  const frequency = detectPitch(
    samples,
    sampleRate
  );

  if (!frequency) {
    return null;
  }

  return frequencyToNote(
    frequency,
    referenceFrequency
  );
}