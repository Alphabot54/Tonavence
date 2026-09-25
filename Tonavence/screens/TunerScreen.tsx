import { Text, View, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Tuner from "../components/Tuner";
import { router } from "expo-router";

export default function TunerScreen() {
  console.log("TUNER SCREEN LOADED");

  return (
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
            color="#111"
          />
        </Pressable>

        <Text style={styles.headerTitle}>Tuner</Text>
      </View>

      <Tuner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
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
    color: "#111",
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