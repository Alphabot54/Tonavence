
import {
  CHORD_KEYS,
  type ChordSettings,
  type ChordQuality,
} from "./chordSettings";

export type ChordOption = {
  id: string;
  label: string;
  degree: number;
  quality: ChordQuality;
  intervals: number[];
};

export type ChordQuestion = {
  key: string;
  chords: ChordOption[];
};

export const CHORD_OPTIONS: ChordOption[] = [
  { id: "1", label: "1", degree: 0, quality: "major", intervals: [0, 4, 7] },
  { id: "2m", label: "2m", degree: 1, quality: "minor", intervals: [0, 3, 7] },
  { id: "3m", label: "3m", degree: 2, quality: "minor", intervals: [0, 3, 7] },
  { id: "4", label: "4", degree: 3, quality: "major", intervals: [0, 4, 7] },
  { id: "5", label: "5", degree: 4, quality: "major", intervals: [0, 4, 7] },
  { id: "6m", label: "6m", degree: 5, quality: "minor", intervals: [0, 3, 7] },
  { id: "7dim", label: "7dim", degree: 6, quality: "diminished", intervals: [0, 3, 6] },

  { id: "1maj7", label: "1maj7", degree: 0, quality: "major7", intervals: [0, 4, 7, 11] },
  { id: "4maj7", label: "4maj7", degree: 3, quality: "major7", intervals: [0, 4, 7, 11] },

  { id: "5dom7", label: "5⁷", degree: 4, quality: "dominant7", intervals: [0, 4, 7, 10] },

  { id: "2m7", label: "2m7", degree: 1, quality: "minor7", intervals: [0, 3, 7, 10] },
  { id: "3m7", label: "3m7", degree: 2, quality: "minor7", intervals: [0, 3, 7, 10] },
  { id: "6m7", label: "6m7", degree: 5, quality: "minor7", intervals: [0, 3, 7, 10] },
];

const KEY_SEMITONES: Record<string, number> = {
  C: 0,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  Gb: 6,
  G: 7,
  Ab: 8,
  A: 9,
  Bb: 10,
  B: 11,
};

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

export function getEnabledChords(
  settings: ChordSettings,
): ChordOption[] {
  return CHORD_OPTIONS.filter((chord) =>
    settings.enabledQualities.includes(chord.quality),
  );
}

export function createChordQuestion(
  settings: ChordSettings,
): ChordQuestion {
  const available = getEnabledChords(settings);

  const key = settings.randomKey
    ? CHORD_KEYS[Math.floor(Math.random() * CHORD_KEYS.length)]
    : settings.key;

  const chords: ChordOption[] = [];

  for (let i = 0; i < settings.chordCount; i++) {
    let availableChoices = available;

    // Avoid consecutive repetitions of the same chord.
    if (i > 0 && available.length > 1) {
      availableChoices = available.filter(
        (chord) => chord.id !== chords[i - 1].id,
      );
    }

    const selected =
      availableChoices[
        Math.floor(Math.random() * availableChoices.length)
      ];

    chords.push(selected);
  }

  return { key, chords };
}

export function getChordFrequencies(
  chord: ChordOption,
  key: string,
): number[] {
  const keyOffset = KEY_SEMITONES[key] ?? 0;

  // C3 = MIDI 48.
  const rootMidi =
    48 + keyOffset + MAJOR_SCALE[chord.degree];

  return chord.intervals.map((interval) => {
    const midi = rootMidi + interval;

    return 440 * Math.pow(2, (midi - 69) / 12);
  });
}
