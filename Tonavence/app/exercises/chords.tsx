
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getChordSettings,
  type ChordSettings,
} from "../../utils/chordSettings";

import {
  createChordQuestion,
  getEnabledChords,
  getChordFrequencies,
  type ChordQuestion,
} from "../../utils/chordProgressions";

import { playTones } from "../../utils/playTones";

const ACCENT = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";
const CORRECT = "#66BB6A";
const INCORRECT = "#EF5350";

const CHORD_DURATION = 0.85;
const CHORD_GAP = 0.15;
const NEXT_QUESTION_DELAY = 1000;

type Feedback = "correct" | "incorrect" | null;

function clearTimers(
  timers: ReturnType<typeof setTimeout>[],
) {
  timers.forEach(clearTimeout);
  timers.length = 0;
}

function playQuestion(
  question: ChordQuestion,
  timers: ReturnType<typeof setTimeout>[],
) {
  clearTimers(timers);

  question.chords.forEach((chord, index) => {
    const timer = setTimeout(() => {
      const frequencies = getChordFrequencies(
        chord,
        question.key,
      );

      // startOffset = 0 plays all notes simultaneously.
      playTones(frequencies, CHORD_DURATION, 0);
    }, index * (CHORD_DURATION + CHORD_GAP) * 1000);

    timers.push(timer);
  });
}

export default function ChordsScreen() {
  const [settings, setSettings] = useState<ChordSettings>(
    getChordSettings(),
  );

  const [question, setQuestion] = useState<ChordQuestion>(
    () => createChordQuestion(getChordSettings()),
  );

  const [selectedAnswers, setSelectedAnswers] = useState<
    (string | null)[]
  >([]);

  const [activeSlot, setActiveSlot] = useState(0);

  const [feedback, setFeedback] = useState<Feedback>(null);

  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [streak, setStreak] = useState(0);

  const playbackTimers = useRef<
    ReturnType<typeof setTimeout>[]
  >([]);

  const advanceTimeout = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const clearAllTimers = () => {
    clearTimers(playbackTimers.current);

    if (advanceTimeout.current) {
      clearTimeout(advanceTimeout.current);
      advanceTimeout.current = null;
    }
  };

  const startQuestion = (
    updatedSettings: ChordSettings,
  ) => {
    clearAllTimers();

    const next = createChordQuestion(updatedSettings);

    setQuestion(next);
    setSelectedAnswers(
      Array(updatedSettings.chordCount).fill(null),
    );
    setActiveSlot(0);
    setFeedback(null);

    playQuestion(next, playbackTimers.current);
  };

  useFocusEffect(
    useCallback(() => {
      const updatedSettings = getChordSettings();

      setSettings(updatedSettings);
      startQuestion(updatedSettings);

      return () => {
        clearAllTimers();
      };
    }, []),
  );

  const replay = () => {
    playQuestion(question, playbackTimers.current);
  };

  const selectAnswer = (chordId: string) => {
    if (feedback === "correct") return;

    const updated = [...selectedAnswers];
    updated[activeSlot] = chordId;

    setSelectedAnswers(updated);
    setFeedback(null);

    // Automatically select the next unanswered position.
    const nextEmpty = updated.findIndex(
      (answer) => answer === null,
    );

    if (nextEmpty !== -1) {
      setActiveSlot(nextEmpty);
    }
  };

  const checkAnswers = () => {
    if (
      feedback === "correct" ||
      selectedAnswers.some((answer) => answer === null)
    ) {
      return;
    }

    setAnswered((previous) => previous + 1);

    const isCorrect = question.chords.every(
      (chord, index) =>
        selectedAnswers[index] === chord.id,
    );

    if (isCorrect) {
      setFeedback("correct");
      setScore((previous) => previous + 1);
      setStreak((previous) => previous + 1);

      advanceTimeout.current = setTimeout(() => {
        startQuestion(settings);
      }, NEXT_QUESTION_DELAY);
    } else {
      setFeedback("incorrect");
      setStreak(0);
    }
  };

  const enabledChords = getEnabledChords(settings);

  const accuracy =
    answered === 0
      ? 0
      : Math.round((score / answered) * 100);

  const allAnswered = selectedAnswers.length === settings.chordCount &&
    selectedAnswers.every((answer) => answer !== null);

  const getSlotStyle = (index: number) => {
    const answer = selectedAnswers[index];

    if (feedback === "correct") {
      return styles.correctAnswer;
    }

    if (feedback === "incorrect" && answer !== null) {
      return answer === question.chords[index].id
        ? styles.correctAnswer
        : styles.incorrectAnswer;
    }

    if (activeSlot === index) {
      return styles.activeSlot;
    }

    return {};
  };

  return (
    <View style={styles.gradientContainer}>
      <SafeAreaView
        style={styles.container}
        edges={["top", "bottom"]}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.headerButton}
              hitSlop={10}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={TEXT}
              />
            </Pressable>

            <Text style={styles.headerTitle}>
              Chord Recognition
            </Text>

            <Pressable
              onPress={() =>
                router.push("/exercises/chords-settings")
              }
              style={styles.headerButton}
              hitSlop={10}
            >
              <Ionicons
                name="settings-outline"
                size={23}
                color={TEXT}
              />
            </Pressable>
          </View>

          {/* Statistics */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{score}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {accuracy}%
              </Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>

          {/* Listening section */}
          <View style={styles.listenCard}>
            <View style={styles.keyContainer}>
              <Text style={styles.keyLabel}>
                KEY OF
              </Text>

              <Text style={styles.keyText}>
                {question.key}
              </Text>
            </View>

            <Pressable
              onPress={replay}
              style={({ pressed }) => [
                styles.playButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="play"
                size={23}
                color={BACKGROUND}
              />

              <Text style={styles.playButtonText}>
                Replay progression
              </Text>
            </Pressable>

            <Text style={styles.replayHint}>
              Listen to all {settings.chordCount} chords
            </Text>
          </View>

          {/* Answer slots */}
          <View style={styles.answerSection}>
            <View style={styles.answerHeader}>
              <Text style={styles.sectionTitle}>
                Identify the progression
              </Text>

              <Text style={styles.answerCount}>
                {settings.chordCount} chords
              </Text>
            </View>

            <Text style={styles.instruction}>
              Select each position, then choose its Nashville number.
            </Text>

            <View style={styles.slotsContainer}>
              {question.chords.map((_, index) => (
                <Pressable
                  key={index}
                  disabled={feedback === "correct"}
                  onPress={() => setActiveSlot(index)}
                  style={[
                    styles.answerSlot,
                    getSlotStyle(index),
                  ]}
                >
                  <Text style={styles.slotNumber}>
                    {index + 1}
                  </Text>

                  <Text
                    style={[
                      styles.slotAnswer,
                      selectedAnswers[index] === null &&
                        styles.emptyAnswer,
                    ]}
                  >
                    {selectedAnswers[index] ?? "?"}
                  </Text>

                  {feedback === "correct" && (
                    <Ionicons
                      name="checkmark-circle"
                      size={17}
                      color={TEXT}
                    />
                  )}

                  {feedback === "incorrect" &&
                    selectedAnswers[index] !==
                      question.chords[index].id && (
                      <Ionicons
                        name="close-circle"
                        size={17}
                        color={TEXT}
                      />
                    )}
                </Pressable>
              ))}
            </View>

            {/* Chord choices */}
            <View style={styles.choiceHeader}>
              <Text style={styles.choiceTitle}>
                Choose chord {activeSlot + 1}
              </Text>

              <Text style={styles.answerCount}>
                {selectedAnswers.filter(Boolean).length}/
                {settings.chordCount} selected
              </Text>
            </View>

            <View style={styles.answerGrid}>
              {enabledChords.map((chord) => {
                const isSelected =
                  selectedAnswers[activeSlot] === chord.id;

                return (
                  <Pressable
                    key={chord.id}
                    disabled={feedback === "correct"}
                    onPress={() => selectAnswer(chord.id)}
                    style={({ pressed }) => [
                      styles.answerButton,
                      isSelected && styles.selectedAnswer,
                      pressed && feedback === null &&
                        styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.answerText,
                        isSelected && styles.selectedAnswerText,
                      ]}
                    >
                      {chord.label}
                    </Text>

                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={BACKGROUND}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Feedback */}
          {feedback !== null && (
            <View
              style={[
                styles.feedbackCard,
                feedback === "correct"
                  ? styles.feedbackCorrect
                  : styles.feedbackIncorrect,
              ]}
            >
              <View style={styles.feedbackHeading}>
                <Ionicons
                  name={
                    feedback === "correct"
                      ? "checkmark-circle"
                      : "close-circle"
                  }
                  size={23}
                  color={
                    feedback === "correct"
                      ? CORRECT
                      : INCORRECT
                  }
                />

                <Text style={styles.feedbackTitle}>
                  {feedback === "correct"
                    ? "Perfect!"
                    : "Not quite!"}
                </Text>
              </View>

              <Text style={styles.feedbackDescription}>
                {feedback === "correct"
                  ? "You identified the entire progression correctly."
                  : "Some positions are incorrect. Try changing the highlighted answers."}
              </Text>

              {feedback === "incorrect" && (
                <Pressable
                  onPress={() => setActiveSlot(
                    question.chords.findIndex(
                      (chord, index) =>
                        selectedAnswers[index] !== chord.id,
                    ),
                  )}
                  style={styles.tryAgainButton}
                >
                  <Text style={styles.tryAgainText}>
                    Correct my answers
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Check answers */}
          {feedback !== "correct" && (
            <Pressable
              onPress={checkAnswers}
              disabled={!allAnswered}
              style={({ pressed }) => [
                styles.checkButton,
                !allAnswered && styles.disabledButton,
                pressed && allAnswered && styles.pressed,
              ]}
            >
              <Text style={styles.checkButtonText}>
                Check answers
              </Text>

              <Ionicons
                name="arrow-forward"
                size={19}
                color={BACKGROUND}
              />
            </Pressable>
          )}

          {/* Settings summary */}
          <View style={styles.settingsSummary}>
            <Ionicons
              name="options-outline"
              size={18}
              color={MUTED}
            />

            <Text style={styles.settingsSummaryText}>
              {settings.randomKey
                ? "Random keys"
                : `Key of ${settings.key}`}
              {"  ·  "}
              {settings.chordCount} chords
              {"  ·  "}
              {enabledChords.length} options
            </Text>

            <Pressable
              onPress={() =>
                router.push("/exercises/chords-settings")
              }
              hitSlop={8}
            >
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: TEXT,
    fontSize: 19,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  statCard: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
    alignItems: "center",
  },
  statValue: {
    color: ACCENT,
    fontSize: 23,
    fontWeight: "800",
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
    marginTop: 3,
  },
  listenCard: {
    marginHorizontal: 16,
    paddingVertical: 20,
    alignItems: "center",
  },
  keyContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  keyLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  keyText: {
    color: ACCENT,
    fontSize: 30,
    fontWeight: "800",
    marginTop: 3,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: ACCENT,
    borderRadius: 15,
    paddingVertical: 13,
    paddingHorizontal: 22,
    minWidth: 205,
  },
  playButtonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: "800",
  },
  replayHint: {
    color: MUTED,
    fontSize: 12,
    marginTop: 12,
  },
  answerSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  answerCount: {
    color: MUTED,
    fontSize: 12,
  },
  instruction: {
    color: MUTED,
    fontSize: 13,
    marginBottom: 14,
  },
  slotsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 22,
  },
  answerSlot: {
    flexGrow: 1,
    flexBasis: "21%",
    minWidth: 62,
    minHeight: 83,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    padding: 7,
    gap: 4,
  },
  slotNumber: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "600",
  },
  slotAnswer: {
    color: ACCENT,
    fontSize: 20,
    fontWeight: "800",
  },
  emptyAnswer: {
    color: MUTED,
  },
  activeSlot: {
    borderColor: ACCENT,
    backgroundColor: "#1C3035",
  },
  correctAnswer: {
    backgroundColor: "#24442D",
    borderColor: CORRECT,
  },
  incorrectAnswer: {
    backgroundColor: "#482528",
    borderColor: INCORRECT,
  },
  choiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  choiceTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  answerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  answerButton: {
    width: "31%",
    flexGrow: 1,
    minHeight: 47,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  answerText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
  },
  selectedAnswer: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  selectedAnswerText: {
    color: BACKGROUND,
  },
  checkButton: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  checkButtonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.35,
  },
  feedbackCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
  },
  feedbackCorrect: {
    backgroundColor: "#18271D",
    borderColor: "#315C3A",
  },
  feedbackIncorrect: {
    backgroundColor: "#2C1C1F",
    borderColor: "#633238",
  },
  feedbackHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  feedbackTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "800",
  },
  feedbackDescription: {
    color: MUTED,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 19,
  },
  tryAgainButton: {
    marginTop: 12,
    alignSelf: "flex-start",
  },
  tryAgainText: {
    color: ACCENT,
    fontWeight: "700",
    fontSize: 13,
  },
  settingsSummary: {
    marginTop: 17,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  settingsSummaryText: {
    flex: 1,
    color: MUTED,
    fontSize: 12,
  },
  editText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
