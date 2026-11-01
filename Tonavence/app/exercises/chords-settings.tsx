
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
  CHORD_KEYS,
  CHORD_QUALITIES,
  getChordSettings,
  saveChordSettings,
  type ChordSettings,
  type ChordQuality,
} from "../../utils/chordSettings";

const ACCENT = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";

const CHORD_COUNTS = [2, 3, 4, 5, 6, 8];

export default function ChordsSettingsScreen() {
  const [settings, setSettings] = useState<ChordSettings>(
    getChordSettings(),
  );

  const updateSettings = (
    updates: Partial<ChordSettings>,
  ) => {
    setSettings((previous) => ({
      ...previous,
      ...updates,
    }));
  };

  const toggleQuality = (quality: ChordQuality) => {
    setSettings((previous) => {
      const enabled = previous.enabledQualities.includes(
        quality,
      );

      // Always require at least one chord quality.
      if (
        enabled &&
        previous.enabledQualities.length === 1
      ) {
        return previous;
      }

      return {
        ...previous,
        enabledQualities: enabled
          ? previous.enabledQualities.filter(
              (item) => item !== quality,
            )
          : [...previous.enabledQualities, quality],
      };
    });
  };

  const handleSave = () => {
    saveChordSettings(settings);
    router.back();
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
              Chord Settings
            </Text>

            <View style={styles.headerButton} />
          </View>

          {/* Number of chords */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Number of chords
            </Text>

            <Text style={styles.sectionDescription}>
              Choose how many chords each progression contains.
            </Text>

            <View style={styles.countGrid}>
              {CHORD_COUNTS.map((count) => {
                const selected =
                  settings.chordCount === count;

                return (
                  <Pressable
                    key={count}
                    onPress={() =>
                      updateSettings({ chordCount: count })
                    }
                    style={[
                      styles.countButton,
                      selected && styles.selectedButton,
                    ]}
                  >
                    <Text
                      style={[
                        styles.countText,
                        selected && styles.selectedText,
                      ]}
                    >
                      {count}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Key selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Key selection
            </Text>

            <Text style={styles.sectionDescription}>
              Practice in different keys or focus on one key.
            </Text>

            <View style={styles.keyModeContainer}>
              <Pressable
                onPress={() =>
                  updateSettings({ randomKey: true })
                }
                style={[
                  styles.keyModeButton,
                  settings.randomKey && styles.selectedButton,
                ]}
              >
                <Ionicons
                  name="shuffle"
                  size={18}
                  color={
                    settings.randomKey ? BACKGROUND : MUTED
                  }
                />

                <Text
                  style={[
                    styles.keyModeText,
                    settings.randomKey && styles.selectedText,
                  ]}
                >
                  Random key
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  updateSettings({ randomKey: false })
                }
                style={[
                  styles.keyModeButton,
                  !settings.randomKey && styles.selectedButton,
                ]}
              >
                <Ionicons
                  name="musical-note"
                  size={18}
                  color={
                    !settings.randomKey ? BACKGROUND : MUTED
                  }
                />

                <Text
                  style={[
                    styles.keyModeText,
                    !settings.randomKey && styles.selectedText,
                  ]}
                >
                  Fixed key
                </Text>
              </Pressable>
            </View>

            {!settings.randomKey && (
              <View style={styles.keyGrid}>
                {CHORD_KEYS.map((key) => {
                  const selected = settings.key === key;

                  return (
                    <Pressable
                      key={key}
                      onPress={() => updateSettings({ key })}
                      style={[
                        styles.keyButton,
                        selected && styles.selectedButton,
                      ]}
                    >
                      <Text
                        style={[
                          styles.keyText,
                          selected && styles.selectedText,
                        ]}
                      >
                        {key}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Chord qualities */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Allowed chord types
            </Text>

            <Text style={styles.sectionDescription}>
              Select which chord qualities can appear in a progression.
            </Text>

            {CHORD_QUALITIES.map((quality) => {
              const selected =
                settings.enabledQualities.includes(
                  quality.id,
                );

              return (
                <Pressable
                  key={quality.id}
                  onPress={() => toggleQuality(quality.id)}
                  style={styles.qualityRow}
                >
                  <View style={styles.qualityInfo}>
                    <Text style={styles.qualityName}>
                      {quality.name}
                    </Text>

                    <Text style={styles.qualityDescription}>
                      {quality.description}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.checkbox,
                      selected && styles.checkboxSelected,
                    ]}
                  >
                    {selected && (
                      <Ionicons
                        name="checkmark"
                        size={17}
                        color={BACKGROUND}
                      />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={ACCENT}
            />

            <Text style={styles.summaryText}>
              {settings.chordCount} chords per progression
              {"\n"}
              {settings.randomKey
                ? "A new random key for each question"
                : `Always in ${settings.key}`}
              {"\n"}
              {settings.enabledQualities.length} chord types enabled
            </Text>
          </View>

          {/* Save */}
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.saveButtonText}>
              Save settings
            </Text>

            <Ionicons
              name="checkmark"
              size={20}
              color={BACKGROUND}
            />
          </Pressable>
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
    paddingBottom: 25,
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
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: TEXT,
    fontSize: 19,
    fontWeight: "700",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
  },
  sectionDescription: {
    color: MUTED,
    fontSize: 13,
    marginTop: 5,
    marginBottom: 15,
    lineHeight: 19,
  },
  countGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  countButton: {
    flex: 1,
    minWidth: "27%",
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },
  countText: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
  selectedButton: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  selectedText: {
    color: BACKGROUND,
  },
  keyModeContainer: {
    flexDirection: "row",
    gap: 10,
  },
  keyModeButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },
  keyModeText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "700",
  },
  keyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 15,
  },
  keyButton: {
    width: "21%",
    flexGrow: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },
  keyText: {
    color: TEXT,
    fontWeight: "700",
    fontSize: 14,
  },
  qualityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_2,
  },
  qualityInfo: {
    flex: 1,
    gap: 4,
  },
  qualityName: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "600",
  },
  qualityDescription: {
    color: MUTED,
    fontSize: 12,
  },
  checkbox: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: MUTED,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  summaryCard: {
    marginHorizontal: 20,
    marginTop: 25,
    padding: 14,
    borderRadius: 13,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summaryText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 21,
    flex: 1,
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ACCENT,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  saveButtonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
