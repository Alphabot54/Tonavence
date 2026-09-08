import { Text, View, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import PolygonMetronome from "../components/PolygonMetronome";

export default function MetronomeScreen() {
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

        <Text style={styles.headerTitle}>Metronome</Text>
      </View>
      <PolygonMetronome
        initialBpm={100}
        initialTimeSignature="4/4"
      />
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