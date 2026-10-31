export type IntervalDirection = "ascending" | "descending" | "both";

export type IntervalOption = {
  id: string;
  name: string;
  semitones: number;
};

export const INTERVALS: IntervalOption[] = [
  { id: "unison", name: "Perfect Unison", semitones: 0 },
  { id: "m2", name: "Minor 2nd", semitones: 1 },
  { id: "M2", name: "Major 2nd", semitones: 2 },
  { id: "m3", name: "Minor 3rd", semitones: 3 },
  { id: "M3", name: "Major 3rd", semitones: 4 },
  { id: "P4", name: "Perfect 4th", semitones: 5 },
  { id: "TT", name: "Tritone", semitones: 6 },
  { id: "P5", name: "Perfect 5th", semitones: 7 },
  { id: "m6", name: "Minor 6th", semitones: 8 },
  { id: "M6", name: "Major 6th", semitones: 9 },
  { id: "m7", name: "Minor 7th", semitones: 10 },
  { id: "M7", name: "Major 7th", semitones: 11 },
  { id: "octave", name: "Octave", semitones: 12 },
];

export type IntervalSettings = {
  selectedIntervals: string[];
  direction: IntervalDirection;
};

const DEFAULT_SETTINGS: IntervalSettings = {
  selectedIntervals: INTERVALS.map((interval) => interval.id),
  direction: "ascending",
};

let currentSettings: IntervalSettings = {
  selectedIntervals: [...DEFAULT_SETTINGS.selectedIntervals],
  direction: DEFAULT_SETTINGS.direction,
};

export function getIntervalSettings(): IntervalSettings {
  return {
    selectedIntervals: [...currentSettings.selectedIntervals],
    direction: currentSettings.direction,
  };
}

export function saveIntervalSettings(settings: IntervalSettings): void {
  currentSettings = {
    selectedIntervals: [...settings.selectedIntervals],
    direction: settings.direction,
  };
}