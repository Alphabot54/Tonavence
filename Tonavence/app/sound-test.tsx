
import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
} from 'react-native';
import { playTones } from '../utils/playTones';

const COLORS = {
  background: '#0D0F12',
  surface: '#171A1F',
  surfaceLight: '#20242A',
  accent: '#4DD0E1',
  text: '#F2F4F7',
  muted: '#8D96A3',
};

const NOTES = [
  { name: 'C4', frequency: 261.63 },
  { name: 'D4', frequency: 293.66 },
  { name: 'E4', frequency: 329.63 },
  { name: 'F4', frequency: 349.23 },
  { name: 'G4', frequency: 392.0 },
  { name: 'A4', frequency: 440.0 },
  { name: 'B4', frequency: 493.88 },
  { name: 'C5', frequency: 523.25 },
];

export default function SoundTestScreen() {
  const [duration, setDuration] = useState(1);
  const [startOffset, setStartOffset] = useState(0.25);
  const [frequency, setFrequency] = useState('440');

  const play = (frequencies: number[], offset = 0) => {
    playTones(frequencies, duration, offset);
  };

  const playCustomFrequency = () => {
    const value = Number(frequency);

    if (Number.isFinite(value) && value > 0 && value <= 20000) {
      play([value]);
    }
  };

  const playScale = () => {
    play(NOTES.map((note) => note.frequency), startOffset);
  };

  const playChord = (
    frequencies: number[],
  ) => {
    play(frequencies, 0);
  };

  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const ActionButton = ({
    label,
    onPress,
    secondary = false,
  }: {
    label: string;
    onPress: () => void;
    secondary?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          secondary && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Sound Test</Text>
        <Text style={styles.subtitle}>
          Test playTones() and experiment with frequencies,
          durations, chords, and sequences.
        </Text>

        <Section title="1. Individual notes">
          <View style={styles.noteGrid}>
            {NOTES.map((note) => (
              <Pressable
                key={note.name}
                onPress={() => play([note.frequency])}
                style={({ pressed }) => [
                  styles.noteButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.noteName}>{note.name}</Text>
                <Text style={styles.noteFrequency}>
                  {note.frequency} Hz
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="2. Custom frequency">
          <Text style={styles.description}>
            Enter a frequency in Hz.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              value={frequency}
              onChangeText={setFrequency}
              keyboardType="decimal-pad"
              placeholder="440"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              selectTextOnFocus
            />
            <ActionButton
              label="Play"
              onPress={playCustomFrequency}
            />
          </View>
        </Section>

        <Section title="3. Chords">
          <Text style={styles.description}>
            All frequencies start together when the offset is zero.
          </Text>

          <View style={styles.buttonRow}>
            <ActionButton
              label="C major"
              onPress={() =>
                playChord([261.63, 329.63, 392.0])
              }
            />
            <ActionButton
              label="A minor"
              onPress={() =>
                playChord([220.0, 261.63, 329.63])
              }
            />
          </View>

          <View style={styles.buttonRow}>
            <ActionButton
              label="C major 7"
              onPress={() =>
                playChord([261.63, 329.63, 392.0, 493.88])
              }
              secondary
            />
            <ActionButton
              label="Power chord"
              onPress={() =>
                playChord([130.81, 196.0, 261.63])
              }
              secondary
            />
          </View>
        </Section>

        <Section title="4. Sequential notes">
          <Text style={styles.description}>
            Test how startOffset changes the spacing between notes.
          </Text>

          <Text style={styles.controlLabel}>
            Start offset: {startOffset.toFixed(2)} s
          </Text>

          <View style={styles.buttonRow}>
            {[0.1, 0.25, 0.5, 1].map((value) => (
              <ActionButton
                key={value}
                label={`${value}s`}
                secondary={startOffset !== value}
                onPress={() => setStartOffset(value)}
              />
            ))}
          </View>

          <ActionButton
            label="Play C major scale"
            onPress={playScale}
          />

          <ActionButton
            label="Play ascending arpeggio"
            secondary
            onPress={() =>
              play(
                [261.63, 329.63, 392.0, 523.25],
                startOffset,
              )
            }
          />
        </Section>

        <Section title="5. Note duration">
          <Text style={styles.controlLabel}>
            Duration: {duration.toFixed(1)} s
          </Text>

          <View style={styles.buttonRow}>
            {[0.25, 0.5, 1, 2].map((value) => (
              <ActionButton
                key={value}
                label={`${value}s`}
                secondary={duration !== value}
                onPress={() => setDuration(value)}
              />
            ))}
          </View>

          <ActionButton
            label="Test selected settings"
            onPress={() =>
              play([261.63, 329.63, 392.0], startOffset)
            }
          />
        </Section>

        <Text style={styles.footer}>
          Triangle wave · React Native Audio API
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: -14,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  description: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  noteGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  noteButton: {
    width: '23%',
    flexGrow: 1,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  noteName: {
    color: COLORS.accent,
    fontSize: 17,
    fontWeight: '700',
  },
  noteFrequency: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.surfaceLight,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: '#343A43',
  },
  buttonText: {
    color: COLORS.background,
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryButtonText: {
    color: COLORS.text,
  },
  pressed: {
    opacity: 0.65,
  },
  controlLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    color: COLORS.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
