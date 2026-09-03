import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Audio } from "expo-av";
import Slider from "@react-native-community/slider";

export default function MetronomeScreen() {
  const [bpm, setBpm] = useState(120);
  const [isPlaying, setIsPlaying] = useState(false);
  const [beat, setBeat] = useState(0);
  const [beatsPerMeasure, setBeatsPerMeasure] = useState(4);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const highClick = useRef<any>(null);
  const lowClick = useRef<any>(null);

  // Load sounds
  useEffect(() => {
    loadSounds();

    return () => {
      unloadSounds();
      stopMetronome();
    };
  }, []);

  const loadSounds = async () => {
    const high = new Audio.Sound();
    const low = new Audio.Sound();

    await high.loadAsync(require("../assets/sounds/high-click.mp3"));
    await low.loadAsync(require("../assets/sounds/high-click.mp3"));

    highClick.current = high;
    lowClick.current = low;
  };

  const unloadSounds = async () => {
    await highClick.current?.unloadAsync();
    await lowClick.current?.unloadAsync();
  };

  const playClick = async (currentBeat: number) => {
    try {
      if (currentBeat === 0) {
        await highClick.current?.replayAsync();
      } else {
        await lowClick.current?.replayAsync();
      }
    } catch (err) {
      console.log(err);
    }
  };

  const startMetronome = () => {
    if (intervalRef.current) return;

    const interval = (60 / bpm) * 1000;

    let currentBeat = beat;

    playClick(currentBeat);

    intervalRef.current = setInterval(() => {
      currentBeat = (currentBeat + 1) % beatsPerMeasure;

      setBeat(currentBeat);

      playClick(currentBeat);
    }, interval);

    setIsPlaying(true);
  };

  const stopMetronome = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsPlaying(false);
    setBeat(0);
  };

  // Restart metronome if BPM changes while playing
  useEffect(() => {
    if (isPlaying) {
      stopMetronome();

      setTimeout(() => {
        startMetronome();
      }, 50);
    }
  }, [bpm, beatsPerMeasure]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Metronome</Text>

      <Text style={styles.bpmText}>{bpm} BPM</Text>

      <Slider
        style={{ width: "100%" }}
        minimumValue={40}
        maximumValue={240}
        step={1}
        value={bpm}
        onValueChange={setBpm}
        minimumTrackTintColor="#4CAF50"
        maximumTrackTintColor="#444"
      />

      <View style={styles.timeSignatureContainer}>
        {[2, 3, 4, 5, 6].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.signatureButton,
              beatsPerMeasure === num && styles.signatureButtonActive,
            ]}
            onPress={() => setBeatsPerMeasure(num)}
          >
            <Text style={styles.signatureText}>{num}/4</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.beatContainer}>
        {Array.from({ length: beatsPerMeasure }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.beatCircle,
              beat === index && styles.activeBeat,
              beat === index &&
                index === 0 &&
                styles.accentBeat,
            ]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          isPlaying ? styles.stopButton : styles.startButton,
        ]}
        onPress={isPlaying ? stopMetronome : startMetronome}
      >
        <Text style={styles.buttonText}>
          {isPlaying ? "STOP" : "START"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: "white",
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 40,
  },
  bpmText: {
    color: "white",
    fontSize: 48,
    textAlign: "center",
    marginBottom: 20,
    fontWeight: "bold",
  },
  button: {
    marginTop: 40,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#E53935",
  },
  buttonText: {
    color: "white",
    fontSize: 22,
    fontWeight: "700",
  },
  beatContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 40,
    gap: 12,
  },
  beatCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#444",
  },
  activeBeat: {
    backgroundColor: "#FFFFFF",
    transform: [{ scale: 1.4 }],
  },
  accentBeat: {
    backgroundColor: "#4CAF50",
  },
  timeSignatureContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 30,
  },
  signatureButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#2A2A2A",
  },
  signatureButtonActive: {
    backgroundColor: "#4CAF50",
  },
  signatureText: {
    color: "white",
    fontWeight: "600",
  },
});