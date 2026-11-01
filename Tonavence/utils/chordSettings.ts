
export type ChordQuality =
  | "major"
  | "minor"
  | "diminished"
  | "dominant7"
  | "major7"
  | "minor7";

export type ChordSettings = {
  chordCount: number;
  randomKey: boolean;
  key: string;
  enabledQualities: ChordQuality[];
};

export const CHORD_KEYS = [
  "C", "Db", "D", "Eb", "E", "F",
  "Gb", "G", "Ab", "A", "Bb", "B",
];

export const CHORD_QUALITIES: {
  id: ChordQuality;
  name: string;
  description: string;
}[] = [
  {
    id: "major",
    name: "Major",
    description: "1, 4, 5",
  },
  {
    id: "minor",
    name: "Minor",
    description: "2m, 3m, 6m",
  },
  {
    id: "diminished",
    name: "Diminished",
    description: "7dim",
  },
  {
    id: "dominant7",
    name: "Dominant 7th",
    description: "5⁷",
  },
  {
    id: "major7",
    name: "Major 7th",
    description: "1maj7, 4maj7",
  },
  {
    id: "minor7",
    name: "Minor 7th",
    description: "2m7, 3m7, 6m7",
  },
];

export const DEFAULT_CHORD_SETTINGS: ChordSettings = {
  chordCount: 4,
  randomKey: true,
  key: "C",
  enabledQualities: [
    "major",
    "minor",
    "diminished",
  ],
};

let currentSettings: ChordSettings = {
  ...DEFAULT_CHORD_SETTINGS,
  enabledQualities: [...DEFAULT_CHORD_SETTINGS.enabledQualities],
};

export function getChordSettings(): ChordSettings {
  return {
    ...currentSettings,
    enabledQualities: [...currentSettings.enabledQualities],
  };
}

export function saveChordSettings(settings: ChordSettings): void {
  currentSettings = {
    ...settings,
    enabledQualities: [...settings.enabledQualities],
  };
}
