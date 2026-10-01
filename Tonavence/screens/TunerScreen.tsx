import { Text, View, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Tuner from "../components/Tuner";
import { router } from "expo-router";

const DEFAULT_ACCENT_COLOR = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const TEXT = "#F2F4F7";

export default function TunerScreen() {

  return (
    <View style={styles.gradientContainer}>
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.headerContainer}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={10}
          >
            <Ionicons 
              name="chevron-back"
              size={28}
              color={TEXT}
            />
          </Pressable>

          <Text style={styles.headerTitle}>Tuner</Text>
        </View>

        <Tuner />
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

  headerContainer: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: TEXT,
  },

  backButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },

  bodyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});