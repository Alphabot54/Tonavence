import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  getIntervalSettings,
  saveIntervalSettings,
  INTERVALS,
  type IntervalDirection,
} from "../../utils/intervalSettings";

const ACCENT = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";

const DIRECTIONS: {
  value: IntervalDirection;
  title: string;
  description: string;
}[] = [
  {
    value: "ascending",
    title: "Ascending",
    description: "Lower note first",
  },
  {
    value: "descending",
    title: "Descending",
    description: "Higher note first",
  },
  {
    value: "both",
    title: "Both",
    description: "Mix both directions",
  },
];

export default function IntervalSettingsScreen() {
  const initialSettings = getIntervalSettings();

  const [selectedIntervals, setSelectedIntervals] = useState<string[]>(
    initialSettings.selectedIntervals,
  );
  const [direction, setDirection] = useState<IntervalDirection>(
    initialSettings.direction,
  );

  const toggleInterval = (id: string) => {
    setSelectedIntervals((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  };

  const selectAll = () => {
    setSelectedIntervals(INTERVALS.map((interval) => interval.id));
  };

  const clearAll = () => {
    setSelectedIntervals([]);
  };

  const handleSave = () => {
    if (selectedIntervals.length === 0) return;

    saveIntervalSettings({
      selectedIntervals,
      direction,
    });

    router.back();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.headerButton}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={28} color={TEXT} />
          </Pressable>

          <Text style={styles.headerTitle}>Exercise Settings</Text>

          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Interval Recognition</Text>
          <Text style={styles.pageDescription}>
            Customize which intervals you want to hear and practice.
          </Text>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Playback direction</Text>
          </View>

          <View style={styles.directionList}>
            {DIRECTIONS.map((option) => {
              const active = direction === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDirection(option.value)}
                  style={[
                    styles.directionCard,
                    active && styles.directionCardActive,
                  ]}
                >
                  <View style={styles.directionTextContainer}>
                    <Text style={styles.directionTitle}>
                      {option.title}
                    </Text>
                    <Text style={styles.directionDescription}>
                      {option.description}
                    </Text>
                  </View>

                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={active ? ACCENT : MUTED}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Intervals</Text>
              <Text style={styles.sectionSubtitle}>
                {selectedIntervals.length} of {INTERVALS.length} selected
              </Text>
            </View>

            <View style={styles.selectionActions}>
              <Pressable onPress={selectAll} hitSlop={8}>
                <Text style={styles.actionText}>All</Text>
              </Pressable>

              <Text style={styles.actionSeparator}>/</Text>

              <Pressable onPress={clearAll} hitSlop={8}>
                <Text style={styles.actionText}>None</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.intervalList}>
            {INTERVALS.map((interval) => {
              const active = selectedIntervals.includes(interval.id);

              return (
                <Pressable
                  key={interval.id}
                  onPress={() => toggleInterval(interval.id)}
                  style={[
                    styles.intervalRow,
                    active && styles.intervalRowActive,
                  ]}
                >
                  <View style={styles.intervalInfo}>
                    <Text style={styles.intervalName}>
                      {interval.name}
                    </Text>
                    <Text style={styles.intervalSemitones}>
                      {interval.semitones} semitone
                      {interval.semitones === 1 ? "" : "s"}
                    </Text>
                  </View>

                  <Ionicons
                    name={active ? "checkbox" : "square-outline"}
                    size={23}
                    color={active ? ACCENT : MUTED}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.tipCard}>
            <Ionicons
              name="bulb-outline"
              size={20}
              color={ACCENT}
            />
            <Text style={styles.tipText}>
              Start with a few familiar intervals, then add more as your ear
              improves.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {selectedIntervals.length === 0 && (
            <Text style={styles.errorText}>
              Select at least one interval to continue.
            </Text>
          )}

          <Pressable
            onPress={handleSave}
            disabled={selectedIntervals.length === 0}
            style={({ pressed }) => [
              styles.saveButton,
              selectedIntervals.length === 0 && styles.saveButtonDisabled,
              pressed && selectedIntervals.length > 0 && styles.pressed,
            ]}
          >
            <Text style={styles.saveButtonText}>Save settings</Text>
            <Ionicons name="checkmark" size={21} color={BACKGROUND} />
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    height: 64,
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  pageTitle: {
    color: TEXT,
    fontSize: 25,
    fontWeight: "800",
    marginTop: 14,
  },
  pageDescription: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "700",
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  directionList: {
    gap: 9,
    marginBottom: 25,
  },
  directionCard: {
    minHeight: 66,
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },
  directionCardActive: {
    borderColor: ACCENT,
    backgroundColor: "#18272B",
  },
  directionTextContainer: {
    flex: 1,
  },
  directionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
  },
  directionDescription: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  actionText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: "700",
  },
  actionSeparator: {
    color: MUTED,
  },
  intervalList: {
    gap: 8,
  },
  intervalRow: {
    minHeight: 58,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
    flexDirection: "row",
    alignItems: "center",
  },
  intervalRowActive: {
    borderColor: "#31535A",
  },
  intervalInfo: {
    flex: 1,
  },
  intervalName: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "600",
  },
  intervalSemitones: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    backgroundColor: SURFACE,
    borderRadius: 15,
    padding: 15,
    marginTop: 22,
    marginBottom: 10,
  },
  tipText: {
    color: MUTED,
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: SURFACE_2,
    backgroundColor: BACKGROUND,
  },
  errorText: {
    color: "#EF5350",
    fontSize: 12,
    marginBottom: 9,
    textAlign: "center",
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: ACCENT,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: BACKGROUND,
    fontSize: 15,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});