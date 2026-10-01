import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const DEFAULT_ACCENT_COLOR = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";

const exercises = [
  "Chromatic",
  "Scales",
  "Intervals",
  "Chords",
  "Arpeggios",
  "Ear Training",
  "Rhythm",
  "Technique",
];

export default function ExercisesScreen() {
  return (
    <View style={styles.gradientContainer}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={28} color={TEXT} />
          </Pressable>

          <Text style={styles.title}>Exercises</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.body}>
          <View style={styles.grid}>
            {exercises.map((exercise) => (
              <Pressable
                key={exercise}
                style={({ pressed }) => [
                  styles.exerciseCard,
                  pressed && styles.exerciseCardPressed,
                ]}
                onPress={() => {
                  // Individual exercise navigation will go here
                }}
              >
                <View style={styles.cardShape} />

                <Text style={styles.exerciseText}>{exercise}</Text>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={MUTED}
                  style={styles.cardArrow}
                />
              </Pressable>
            ))}
          </View>
        </View>
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
    experimental_backgroundImage: `linear-gradient(0deg, ${DEFAULT_ACCENT_COLOR}, ${BACKGROUND})`
  },

  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpacer: {
    width: 44,
  },

  title: {
    flex: 1,
    textAlign: "center",
    color: TEXT,
    fontSize: 24,
    fontWeight: "700",
  },

  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },

  exerciseCard: {
    width: (width - 46) / 2,
    height: 125,
    backgroundColor: SURFACE,
    borderRadius: 22,
    padding: 18,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: SURFACE_2,
  },

  exerciseCardPressed: {
    backgroundColor: SURFACE_2,
    transform: [{ scale: 0.98 }],
  },

  cardShape: {
    position: "absolute",
    width: 75,
    height: 75,
    borderRadius: 20,
    backgroundColor: SURFACE_2,
    top: -25,
    right: -20,
    transform: [{ rotate: "25deg" }],
  },

  exerciseText: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "600",
  },

  cardArrow: {
    position: "absolute",
    right: 15,
    bottom: 15,
  },
});