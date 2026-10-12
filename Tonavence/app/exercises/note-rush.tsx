
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addErrorListener,
  addFrameListener,
  requestPermission,
  start,
  stop,
} from 'expo-stream-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  analyzePitch,
  type PitchResult,
} from '../../utils/pitchDetection';

// Tonavence color palette
const DEFAULT_ACCENT_COLOR = '#4DD0E1';
const BACKGROUND = '#0D0F12';
const SURFACE = '#171A1F';
const SURFACE_2 = '#20242A';
const TEXT = '#F2F4F7';
const MUTED = '#8D96A3';
const POLYGON_GREY = '#69717D';
const TUNED_COLOR = '#66BB6A';
const CLOSE_COLOR = '#D6C95C';
const FAR_COLOR = '#EF5350';

type GameMode = '1min' | '3min' | 'survival';
type Screen = 'select' | 'playing' | 'results';
type EndReason = 'time' | 'lives' | 'quit';

type TargetNote = {
  name: string;
  midi: number;
  frequency: number;
};

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

const NOTE_DISPLAY: Record<string, string> = {
  'C#': 'C♯',
  'D#': 'D♯',
  'F#': 'F♯',
  'G#': 'G♯',
  'A#': 'A♯',
};

const NOTE_TIMEOUT_MS = 8000;
const PITCH_TOLERANCE_CENTS = 80;
const REQUIRED_STABLE_FRAMES = 2;

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function displayNote(note: string): string {
  return NOTE_DISPLAY[note] ?? note;
}

/**
 * Converts base64 PCM16 little-endian mono audio into
 * normalized Float32Array samples.
 *
 * Avoids relying on Node's Buffer API in React Native.
 */
function pcmBase64ToFloat32(base64: string): Float32Array {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < base64.length; i++) {
    const char = base64[i];

    if (char === '=') {
      break;
    }

    const value = alphabet.indexOf(char);

    if (value < 0) {
      continue;
    }

    buffer = (buffer << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  const sampleCount = Math.floor(bytes.length / 2);
  const samples = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const unsigned = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
    const signed = unsigned >= 32768 ? unsigned - 65536 : unsigned;

    samples[i] = signed / 32768;
  }

  return samples;
}

/**
 * Returns true if the detected pitch matches the target's
 * pitch class, ignoring octave.
 *
 * Also checks harmonics 2 through 5 to compensate for common
 * overtone detections. This is deliberately lenient for gameplay.
 */
function matchesTarget(
  pitch: PitchResult,
  target: TargetNote,
): boolean {
  const targetPitchClass = ((target.midi % 12) + 12) % 12;

  // First, use the detected note name directly.
  if (pitch.note === target.name && Math.abs(pitch.cents) <= PITCH_TOLERANCE_CENTS) {
    return true;
  }

  // Try the target note in other octaves, then test common harmonics.
  for (let midi = 24; midi <= 95; midi++) {
    if (midi % 12 !== targetPitchClass) {
      continue;
    }

    const baseFrequency = midiToFrequency(midi);

    for (let harmonic = 1; harmonic <= 5; harmonic++) {
      const expectedFrequency = baseFrequency * harmonic;

      const centsDifference =
        1200 * Math.log2(pitch.frequency / expectedFrequency);

      if (Math.abs(centsDifference) <= PITCH_TOLERANCE_CENTS) {
        return true;
      }
    }
  }

  return false;
}

function createTarget(previousName?: string, level = 1): TargetNote {
  // Progressively expand the register as the player levels up.
  const minMidi = 40;
  const maxMidi = Math.min(83, 64 + (level - 1) * 5);

  let midi = minMidi + Math.floor(Math.random() * (maxMidi - minMidi + 1));
  let name = NOTE_NAMES[midi % 12];

  // Avoid repeating the same note name when possible.
  for (let attempt = 0; attempt < 12 && name === previousName; attempt++) {
    midi = minMidi + Math.floor(Math.random() * (maxMidi - minMidi + 1));
    name = NOTE_NAMES[midi % 12];
  }

  return {
    name,
    midi,
    frequency: midiToFrequency(midi),
  };
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function NoteRushScreen() {
  const [screen, setScreen] = useState<Screen>('select');
  const [mode, setMode] = useState<GameMode>('survival');

  const [target, setTarget] = useState<TargetNote>(() => createTarget());
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [remainingMs, setRemainingMs] = useState(0);
  const [detectedNote, setDetectedNote] = useState('');
  const [feedback, setFeedback] = useState('Play the note!');
  const [micError, setMicError] = useState('');
  const [endReason, setEndReason] = useState<EndReason>('lives');

  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const livesRef = useRef(3);
  const targetRef = useRef<TargetNote>(target);
  const playingRef = useRef(false);
  const resolvedTargetRef = useRef(false);
  const targetStartedAtRef = useRef(0);
  const gameStartedAtRef = useRef(0);
  const remainingMsRef = useRef(0);
  const modeRef = useRef<GameMode>('survival');
  const lastCandidateRef = useRef(false);
  const stableFramesRef = useRef(0);
  const previousTargetNameRef = useRef<string | undefined>(undefined);

  const frameSubRef = useRef<{ remove: () => void } | null>(null);
  const errorSubRef = useRef<{ remove: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const level = Math.floor(score / 500) + 1;
  const multiplier = Math.min(5, 1 + Math.floor(streak / 3));

  const clearAudio = useCallback(() => {
    frameSubRef.current?.remove();
    frameSubRef.current = null;

    errorSubRef.current?.remove();
    errorSubRef.current = null;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    stop().catch(() => {});
  }, []);

  const endGame = useCallback(
    (reason: EndReason) => {
      if (!playingRef.current) {
        return;
      }

      playingRef.current = false;
      setEndReason(reason);
      setScreen('results');
      clearAudio();
    },
    [clearAudio],
  );

  const nextTarget = useCallback(() => {
    const next = createTarget(
      previousTargetNameRef.current,
      Math.floor(scoreRef.current / 500) + 1,
    );

    targetRef.current = next;
    previousTargetNameRef.current = next.name;

    setTarget(next);

    targetStartedAtRef.current = Date.now();
    resolvedTargetRef.current = false;
    lastCandidateRef.current = false;
    stableFramesRef.current = 0;
    setDetectedNote('');
  }, []);

  const handleCorrect = useCallback(() => {
    if (!playingRef.current || resolvedTargetRef.current) {
      return;
    }

    resolvedTargetRef.current = true;

    const newStreak = streakRef.current + 1;
    const newMultiplier = Math.min(5, 1 + Math.floor(newStreak / 3));
    const points = 100 * newMultiplier;

    streakRef.current = newStreak;
    scoreRef.current += points;

    setStreak(newStreak);
    setScore(scoreRef.current);
    setFeedback(`CORRECT! +${points}`);

    nextTarget();
  }, [nextTarget]);

  const handleMiss = useCallback(() => {
    if (!playingRef.current) {
      return;
    }

    const newLives = livesRef.current - 1;

    livesRef.current = newLives;
    streakRef.current = 0;

    setLives(newLives);
    setStreak(0);
    setFeedback('MISSED!');

    if (newLives <= 0) {
      endGame('lives');
      return;
    }

    nextTarget();
  }, [endGame, nextTarget]);

  const startGame = useCallback(async () => {
    setMicError('');

    try {
      let permission = await requestPermission();

      if (Platform.OS === 'android' && permission !== 'granted') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );

        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          permission = 'granted';
        }
      }

      if (permission !== 'granted') {
        setMicError('Microphone permission is required to play.');
        return;
      }

      clearAudio();

      scoreRef.current = 0;
      streakRef.current = 0;
      livesRef.current = 3;
      modeRef.current = mode;
      remainingMsRef.current =
        mode === '1min' ? 60_000 : mode === '3min' ? 180_000 : 0;

      setScore(0);
      setStreak(0);
      setLives(3);
      setRemainingMs(remainingMsRef.current);
      setDetectedNote('');
      setFeedback('Listen to your guitar and play!');
      setScreen('playing');

      playingRef.current = true;
      gameStartedAtRef.current = Date.now();

      nextTarget();

      frameSubRef.current = addFrameListener((frame) => {
        if (!playingRef.current) {
          return;
        }

        const samples = pcmBase64ToFloat32(frame.pcmBase64);
        const pitch = analyzePitch(samples, frame.sampleRate);

        if (!pitch) {
          return;
        }

        setDetectedNote(`${pitch.note}${pitch.octave}`);

        const matched = matchesTarget(pitch, targetRef.current);

        if (matched) {
          stableFramesRef.current = lastCandidateRef.current
            ? stableFramesRef.current + 1
            : 1;

          lastCandidateRef.current = true;

          if (stableFramesRef.current >= REQUIRED_STABLE_FRAMES) {
            handleCorrect();
          }
        } else {
          lastCandidateRef.current = false;
          stableFramesRef.current = 0;
        }
      });

      errorSubRef.current = addErrorListener((event) => {
        setMicError(event.message);
      });

      await start({
        sampleRate: 44100,
        frameDurationMs: 50,
        channels: 1,
        enableLevelMeter: true,
      });

      timerRef.current = setInterval(() => {
        if (!playingRef.current) {
          return;
        }

        if (modeRef.current !== 'survival') {
          const duration = modeRef.current === '1min' ? 60_000 : 180_000;
          const remaining = Math.max(
            0,
            duration - (Date.now() - gameStartedAtRef.current),
          );

          remainingMsRef.current = remaining;
          setRemainingMs(remaining);

          if (remaining <= 0) {
            endGame('time');
            return;
          }
        }

        const currentLevel = Math.floor(scoreRef.current / 500) + 1;
        const targetTimeout = Math.max(
          4500,
          NOTE_TIMEOUT_MS - (currentLevel - 1) * 350,
        );

        if (Date.now() - targetStartedAtRef.current >= targetTimeout) {
          handleMiss();
        }
      }, 200);
    } catch (error) {
      playingRef.current = false;
      clearAudio();
      setScreen('select');

      setMicError(
        error instanceof Error
          ? error.message
          : 'Could not start the microphone. Please try again.',
      );
    }
  }, [clearAudio, endGame, handleCorrect, handleMiss, mode, nextTarget]);

  useEffect(() => {
    return () => {
      playingRef.current = false;
      frameSubRef.current?.remove();
      errorSubRef.current?.remove();

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      stop().catch(() => {});
    };
  }, []);

  const goBack = () => {
    if (screen === 'playing') {
      endGame('quit');
    } else if (screen === 'results') {
      setScreen('select');
    } else {
      router.back();
    }
  };

  const currentLevel = Math.floor(score / 500) + 1;
  const nextLevelProgress = (score % 500) / 500;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={goBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={TEXT} />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>NOTE RUSH</Text>
            <Text style={styles.headerSubtitle}>GUITAR ARCADE</Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="musical-notes" size={22} color={DEFAULT_ACCENT_COLOR} />
          </View>
        </View>

        {screen === 'select' && (
          <ScrollView
            contentContainerStyle={styles.selectContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons name="flash" size={32} color={DEFAULT_ACCENT_COLOR} />
              </View>

              <Text style={styles.heroTitle}>Ready to shred?</Text>
              <Text style={styles.heroDescription}>
                Play the note. Build your streak. Beat your high score.
              </Text>
            </View>

            <Text style={styles.sectionLabel}>CHOOSE YOUR MODE</Text>

            <ModeCard
              icon="timer-outline"
              title="60 SECONDS"
              description="Score as many points as possible."
              selected={mode === '1min'}
              onPress={() => setMode('1min')}
              accent={DEFAULT_ACCENT_COLOR}
            />

            <ModeCard
              icon="hourglass-outline"
              title="3 MINUTES"
              description="A longer run to climb the leaderboard."
              selected={mode === '3min'}
              onPress={() => setMode('3min')}
              accent={DEFAULT_ACCENT_COLOR}
            />

            <ModeCard
              icon="flame-outline"
              title="SURVIVAL"
              description="Endless notes. Three lives. How far can you go?"
              selected={mode === 'survival'}
              onPress={() => setMode('survival')}
              accent={FAR_COLOR}
            />

            <View style={styles.rulesCard}>
              <View style={styles.ruleRow}>
                <Ionicons name="heart" size={18} color={FAR_COLOR} />
                <Text style={styles.ruleText}>3 lives per run</Text>
              </View>
              <View style={styles.ruleRow}>
                <Ionicons name="flash" size={18} color={CLOSE_COLOR} />
                <Text style={styles.ruleText}>Every 500 points unlocks a level</Text>
              </View>
              <View style={styles.ruleRow}>
                <Ionicons name="trending-up" size={18} color={TUNED_COLOR} />
                <Text style={styles.ruleText}>Build combos for up to 5× points</Text>
              </View>
            </View>

            {micError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={FAR_COLOR} />
                <Text style={styles.errorText}>{micError}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={startGame}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="play" size={20} color={BACKGROUND} />
              <Text style={styles.primaryButtonText}>START GAME</Text>
            </Pressable>

            <Text style={styles.bottomHint}>
              Grab your guitar. Make sure your surroundings are quiet.
            </Text>
          </ScrollView>
        )}

        {screen === 'playing' && (
          <View style={styles.gameContent}>
            <View style={styles.statsRow}>
              <StatCard
                label="SCORE"
                value={String(score)}
                color={DEFAULT_ACCENT_COLOR}
              />
              <StatCard
                label="LEVEL"
                value={String(currentLevel)}
                color={CLOSE_COLOR}
              />
              <StatCard
                label="COMBO"
                value={`${streak}×`}
                color={TUNED_COLOR}
              />
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${nextLevelProgress * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>
              {500 - (score % 500)} points to level {currentLevel + 1}
            </Text>

            <View style={styles.livesRow}>
              <View style={styles.livesContainer}>
                {[0, 1, 2].map((index) => (
                  <Ionicons
                    key={index}
                    name={index < lives ? 'heart' : 'heart-outline'}
                    size={24}
                    color={index < lives ? FAR_COLOR : POLYGON_GREY}
                  />
                ))}
              </View>

              <View style={styles.timerPill}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={mode === 'survival' ? CLOSE_COLOR : DEFAULT_ACCENT_COLOR}
                />
                <Text style={styles.timerText}>
                  {mode === 'survival'
                    ? 'SURVIVAL'
                    : formatTime(remainingMs)}
                </Text>
              </View>
            </View>

            <View style={styles.targetCard}>
              <Text style={styles.targetEyebrow}>PLAY THIS NOTE</Text>

              <View style={styles.targetGlow}>
                <View style={styles.targetCircle}>
                  <Text style={styles.targetNote}>
                    {displayNote(target.name)}
                  </Text>
                </View>
              </View>

              <Text style={styles.targetInstruction}>
                Play it anywhere on your guitar
              </Text>

              <View style={styles.comboPill}>
                <Ionicons name="flash" size={16} color={CLOSE_COLOR} />
                <Text style={styles.comboText}>
                  {multiplier}× MULTIPLIER
                </Text>
              </View>
            </View>

            <View style={styles.detectionCard}>
              <View
                style={[
                  styles.micIndicator,
                  { backgroundColor: micError ? FAR_COLOR : TUNED_COLOR },
                ]}
              >
                <Ionicons name="mic" size={21} color={BACKGROUND} />
              </View>

              <View style={styles.detectionTextContainer}>
                <Text style={styles.detectionLabel}>MICROPHONE</Text>
                <Text style={styles.detectedNote}>
                  {detectedNote || 'Listening...'}
                </Text>
              </View>

              <View style={styles.listeningIndicator}>
                <View style={styles.listeningDot} />
                <Text style={styles.listeningText}>LIVE</Text>
              </View>
            </View>

            <View style={styles.feedbackContainer}>
              <Text
                style={[
                  styles.feedbackText,
                  feedback.startsWith('CORRECT')
                    ? { color: TUNED_COLOR }
                    : feedback.startsWith('MISSED')
                      ? { color: FAR_COLOR }
                      : { color: TEXT },
                ]}
              >
                {feedback}
              </Text>
            </View>

            {micError ? (
              <Text style={styles.inlineError}>{micError}</Text>
            ) : null}

            <View style={styles.gameFooter}>
              <Ionicons name="ear-outline" size={16} color={MUTED} />
              <Text style={styles.footerText}>
                Play clearly and let each note ring out
              </Text>
            </View>

            <Pressable
              onPress={() => endGame('quit')}
              style={styles.quitButton}
            >
              <Text style={styles.quitButtonText}>END RUN</Text>
            </Pressable>
          </View>
        )}

        {screen === 'results' && (
          <ScrollView contentContainerStyle={styles.resultsContent}>
            <View style={styles.resultsIcon}>
              <Ionicons
                name={endReason === 'time' ? 'trophy' : 'flash'}
                size={40}
                color={CLOSE_COLOR}
              />
            </View>

            <Text style={styles.resultsEyebrow}>
              {endReason === 'quit' ? 'RUN ENDED' : 'CHALLENGE COMPLETE'}
            </Text>

            <Text style={styles.resultsTitle}>
              {endReason === 'time'
                ? "TIME'S UP!"
                : endReason === 'quit'
                  ? 'NICE RUN!'
                  : 'GAME OVER'}
            </Text>

            <View style={styles.finalScoreCard}>
              <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
              <Text style={styles.finalScore}>{score}</Text>

              <View style={styles.resultsDivider} />

              <View style={styles.resultsStatsRow}>
                <View style={styles.resultsStat}>
                  <Text style={styles.resultsStatValue}>{level}</Text>
                  <Text style={styles.resultsStatLabel}>LEVEL</Text>
                </View>
                <View style={styles.resultsStat}>
                  <Text style={styles.resultsStatValue}>{streak}</Text>
                  <Text style={styles.resultsStatLabel}>FINAL STREAK</Text>
                </View>
                <View style={styles.resultsStat}>
                  <Text style={styles.resultsStatValue}>{lives}</Text>
                  <Text style={styles.resultsStatLabel}>LIVES LEFT</Text>
                </View>
              </View>
            </View>

            <View style={styles.resultMessageCard}>
              <Ionicons name="sparkles" size={20} color={DEFAULT_ACCENT_COLOR} />
              <Text style={styles.resultMessage}>
                {score >= 2000
                  ? 'Incredible run! Your note recognition is on fire.'
                  : score >= 1000
                    ? 'Great work! Keep practicing to beat your record.'
                    : 'Every run builds your skills. Ready for another?'}
              </Text>
            </View>

            <Pressable
              onPress={startGame}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="refresh" size={20} color={BACKGROUND} />
              <Text style={styles.primaryButtonText}>PLAY AGAIN</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setScreen('select');
                setMicError('');
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>CHANGE MODE</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function ModeCard({
  icon,
  title,
  description,
  selected,
  onPress,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.modeCard,
        selected && {
          borderColor: accent,
          backgroundColor: SURFACE_2,
        },
      ]}
    >
      <View
        style={[
          styles.modeIcon,
          { backgroundColor: selected ? `${accent}20` : SURFACE_2 },
        ]}
      >
        <Ionicons name={icon} size={24} color={accent} />
      </View>

      <View style={styles.modeTextContainer}>
        <Text style={styles.modeTitle}>{title}</Text>
        <Text style={styles.modeDescription}>{description}</Text>
      </View>

      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? accent : POLYGON_GREY}
      />
    </Pressable>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  page: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_2,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: SURFACE,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 3,
  },
  headerIcon: {
    width: 40,
    alignItems: 'center',
  },
  selectContent: {
    padding: 22,
    paddingBottom: 36,
    gap: 14,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 22,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: '#30474B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  heroTitle: {
    color: TEXT,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroDescription: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 2,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    padding: 15,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTextContainer: {
    flex: 1,
    gap: 5,
  },
  modeTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modeDescription: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
  },
  rulesCard: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 15,
    gap: 13,
    marginTop: 2,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleText: {
    color: TEXT,
    fontSize: 12,
  },
  primaryButton: {
    minHeight: 54,
    backgroundColor: DEFAULT_ACCENT_COLOR,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  primaryButtonText: {
    color: BACKGROUND,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.985 }],
  },
  bottomHint: {
    color: MUTED,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 17,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#321C20',
    borderRadius: 12,
  },
  errorText: {
    color: TEXT,
    fontSize: 12,
    flex: 1,
  },
  gameContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minHeight: 76,
    backgroundColor: SURFACE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },
  statLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statValue: {
    fontSize: 23,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 5,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: SURFACE_2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: DEFAULT_ACCENT_COLOR,
    borderRadius: 5,
  },
  progressLabel: {
    color: MUTED,
    fontSize: 10,
    textAlign: 'right',
    marginTop: -6,
  },
  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  livesContainer: {
    flexDirection: 'row',
    gap: 7,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: SURFACE,
  },
  timerText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  targetCard: {
    flex: 1,
    minHeight: 240,
    maxHeight: 360,
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    gap: 10,
  },
  targetEyebrow: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  targetGlow: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#14272A',
    borderWidth: 1,
    borderColor: '#285158',
  },
  targetCircle: {
    width: 126,
    height: 126,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE_2,
    borderWidth: 2,
    borderColor: DEFAULT_ACCENT_COLOR,
  },
  targetNote: {
    color: DEFAULT_ACCENT_COLOR,
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1,
  },
  targetInstruction: {
    color: MUTED,
    fontSize: 12,
    textAlign: 'center',
  },
  comboPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#302D1D',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 2,
  },
  comboText: {
    color: CLOSE_COLOR,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  detectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },
  micIndicator: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectionTextContainer: {
    flex: 1,
    gap: 4,
  },
  detectionLabel: {
    color: MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  detectedNote: {
    color: TEXT,
    fontSize: 17,
    fontWeight: '800',
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  listeningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TUNED_COLOR,
  },
  listeningText: {
    color: TUNED_COLOR,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  feedbackContainer: {
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  inlineError: {
    color: FAR_COLOR,
    fontSize: 11,
    textAlign: 'center',
  },
  gameFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  footerText: {
    color: MUTED,
    fontSize: 11,
  },
  quitButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitButtonText: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  resultsContent: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 36,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 18,
  },
  resultsIcon: {
    alignSelf: 'center',
    width: 82,
    height: 82,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: '#4B4530',
  },
  resultsEyebrow: {
    color: DEFAULT_ACCENT_COLOR,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  resultsTitle: {
    color: TEXT,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: -12,
  },
  finalScoreCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SURFACE_2,
    padding: 24,
    alignItems: 'center',
  },
  finalScoreLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  finalScore: {
    color: DEFAULT_ACCENT_COLOR,
    fontSize: 58,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 5,
  },
  resultsDivider: {
    height: 1,
    backgroundColor: SURFACE_2,
    alignSelf: 'stretch',
    marginVertical: 18,
  },
  resultsStatsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  resultsStat: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  resultsStatValue: {
    color: TEXT,
    fontSize: 21,
    fontWeight: '900',
  },
  resultsStatLabel: {
    color: MUTED,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  resultMessageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: SURFACE,
    borderRadius: 15,
  },
  resultMessage: {
    color: TEXT,
    fontSize: 12,
    lineHeight: 19,
    flex: 1,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SURFACE_2,
    backgroundColor: SURFACE,
  },
  secondaryButtonText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
