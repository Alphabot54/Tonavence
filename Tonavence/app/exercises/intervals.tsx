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
  getIntervalSettings,
  INTERVALS,
  type IntervalOption,
  type IntervalSettings,
} from "../../utils/intervalSettings";
import { playTones } from "../../utils/playTones";

const ACCENT = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";
const CORRECT = "#66BB6A";
const INCORRECT = "#EF5350";
const CORRECT_FEEDBACK_MS = 750;

type Question = {
  interval: IntervalOption;
  rootFrequency: number;
  ascending: boolean;
};

function createQuestion(settings: IntervalSettings): Question {
  const available = INTERVALS.filter((interval) =>
    settings.selectedIntervals.includes(interval.id),
  );

  const interval =
    available[Math.floor(Math.random() * available.length)] ?? INTERVALS[2];

  const ascending =
    settings.direction === "both"
      ? Math.random() < 0.5
      : settings.direction === "ascending";

  // Keep the generated notes in a comfortable listening range.
  const midi = 48 + Math.floor(Math.random() * (72 - interval.semitones - 48));
  const rootFrequency = 440 * Math.pow(2, (midi - 69) / 12);

  return { interval, rootFrequency, ascending };
}

function playQuestion(question: Question) {
  const first = question.ascending
    ? question.rootFrequency
    : question.rootFrequency * Math.pow(2, question.interval.semitones / 12);

  const second = question.ascending
    ? question.rootFrequency * Math.pow(2, question.interval.semitones / 12)
    : question.rootFrequency;

  playTones([first, second], 0.75, 0.9);
}

export default function IntervalsScreen() {
  const [settings, setSettings] = useState<IntervalSettings>(
    getIntervalSettings(),
  );
  const [question, setQuestion] = useState<Question>(() =>
    createQuestion(getIntervalSettings()),
  );
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(
    null,
  );
  const advanceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      const updatedSettings = getIntervalSettings();
      if (advanceTimeout.current) {
        clearTimeout(advanceTimeout.current);
        advanceTimeout.current = null;
      }

      const firstQuestion = createQuestion(updatedSettings);
      setSettings(updatedSettings);
      setQuestion(firstQuestion);
      setSelectedAnswer(null);
      setFeedback(null);

      // Play the first interval as soon as the exercise screen is focused.
      playQuestion(firstQuestion);

      return () => {
        if (advanceTimeout.current) {
          clearTimeout(advanceTimeout.current);
          advanceTimeout.current = null;
        }
      };
    }, []),
  );

  const replay = () => playQuestion(question);

  const nextQuestion = () => {
    if (advanceTimeout.current) {
      clearTimeout(advanceTimeout.current);
      advanceTimeout.current = null;
    }

    const next = createQuestion(settings);
    setQuestion(next);
    setSelectedAnswer(null);
    setFeedback(null);
    playQuestion(next);
  };

  const answerQuestion = (intervalId: string) => {
    // Prevent additional answers while showing correct feedback.
    if (feedback === "correct") return;

    setSelectedAnswer(intervalId);
    setAnswered((previous) => previous + 1);

    if (intervalId === question.interval.id) {
      setFeedback("correct");
      setScore((previous) => previous + 1);
      setStreak((previous) => previous + 1);

      advanceTimeout.current = setTimeout(() => {
        nextQuestion();
        advanceTimeout.current = null;
      }, CORRECT_FEEDBACK_MS);
    } else {
      // Show only the selected wrong answer in red.
      setFeedback("incorrect");
      setStreak(0);
    }
};

  const enabledIntervals = INTERVALS.filter((interval) =>
    settings.selectedIntervals.includes(interval.id),
  );

  const accuracy =
    answered === 0 ? 0 : Math.round((score / answered) * 100);

  return (
    <View style={styles.gradientContainer}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.headerButton}
              hitSlop={10}
            >
              <Ionicons name="chevron-back" size={28} color={TEXT} />
            </Pressable>

            <Text style={styles.headerTitle}>Interval Recognition</Text>

            <Pressable
              onPress={() => router.push("/exercises/intervals-settings")}
              style={styles.headerButton}
              hitSlop={10}
            >
              <Ionicons name="settings-outline" size={23} color={TEXT} />
            </Pressable>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{score}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{accuracy}%</Text>
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>

          <View style={styles.listenCard}>
            <Pressable
              onPress={replay}
              style={({ pressed }) => [
                styles.playButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="play" size={23} color={BACKGROUND} />
              <Text style={styles.playButtonText}>Play interval</Text>
            </Pressable>
          </View>

          <View style={styles.answerSection}>
            <View style={styles.answerHeader}>
              <Text style={styles.sectionTitle}>Choose the interval</Text>
              <Text style={styles.answerCount}>
                {enabledIntervals.length} options
              </Text>
            </View>

            <View style={styles.answerGrid}>
              {enabledIntervals.map((interval) => {
                const isCorrectAnswer =
                  feedback === "correct" &&
                  interval.id === question.interval.id;

                const isWrongSelection =
                  selectedAnswer === interval.id &&
                  feedback === "incorrect";

                return (
                  <Pressable
                    key={interval.id}
                    disabled={feedback === "correct"}
                    onPress={() => answerQuestion(interval.id)}
                    style={({ pressed }) => [
                      styles.answerButton,
                      pressed && feedback === null && styles.pressed,
                      isCorrectAnswer && styles.correctAnswer,
                      isWrongSelection && styles.incorrectAnswer,
                    ]}
                  >
                    <Text
                      style={[
                        styles.answerText,
                        isCorrectAnswer && styles.feedbackText,
                        isWrongSelection && styles.feedbackText,
                      ]}
                    >
                      {interval.name}
                    </Text>

                    {isCorrectAnswer && (
                      <Ionicons
                        name="checkmark-circle"
                        size={19}
                        color={TEXT}
                      />
                    )}

                    {isWrongSelection && (
                      <Ionicons
                        name="close-circle"
                        size={19}
                        color={TEXT}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.settingsSummary}>
            <Ionicons name="options-outline" size={18} color={MUTED} />
            <Text style={styles.settingsSummaryText}>
              {settings.direction === "both"
                ? "Ascending & descending"
                : settings.direction === "ascending"
                  ? "Ascending intervals"
                  : "Descending intervals"}
              {"  ·  "}
              {enabledIntervals.length} intervals enabled
            </Text>

            <Pressable
              onPress={() => router.push("/exercises/intervals-settings")}
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
    paddingBottom: 10,
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: "center",
  },
  soundIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#1C3035",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 290,
  },
  playButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: ACCENT,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 22,
    marginTop: 5,
    minWidth: 190,
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
    marginTop: 10,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  answerCount: {
    color: MUTED,
    fontSize: 12,
  },
  answerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  answerButton: {
    width: "48%",
    flexGrow: 1,
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  answerText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  correctAnswer: {
    backgroundColor: "#24442D",
    borderColor: CORRECT,
  },
  incorrectAnswer: {
    backgroundColor: "#482528",
    borderColor: INCORRECT,
  },
  feedbackText: {
    color: TEXT,
  },
  feedbackCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 15,
    padding: 12,
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
    fontSize: 18,
    fontWeight: "800",
  },
  feedbackDescription: {
    color: MUTED,
    fontSize: 14,
    marginTop: 10,
  },
  nextButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 13,
    paddingVertical: 13,
    marginTop: 18,
  },
  nextButtonText: {
    color: BACKGROUND,
    fontSize: 15,
    fontWeight: "800",
  },
  tryAgainText: {
    color: MUTED,
    fontSize: 12,
    marginTop: 8,
  },
  settingsSummary: {
    marginTop: 12,
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