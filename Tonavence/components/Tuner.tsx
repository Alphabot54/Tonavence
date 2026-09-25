import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  requestPermission,
  start,
  stop,
  addFrameListener,
  addErrorListener,
} from "expo-stream-audio";

import { analyzePitch } from "../utils/pitchDetection";

// ─────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────

const DEFAULT_ACCENT_COLOR = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";
const POLYGON_GREY = "#69717D";

const TUNED_COLOR = "#66BB6A";
const CLOSE_COLOR = "#D6C95C";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const MIN_REFERENCE_FREQUENCY = 432;
const MAX_REFERENCE_FREQUENCY = 452;
const REFERENCE_STEP = 1;

const TUNED_CENTS = 3;

// Number of recent pitch measurements used
// to smooth the displayed cents value.
const PITCH_HISTORY_SIZE = 5;

// Number of consecutive detections of a new note
// before switching the displayed note.
const NOTE_SWITCH_DETECTIONS = 2;

// Number of null frames before clearing the display.
const NULL_FRAMES_TO_CLEAR = 10;

const BAR_HEIGHTS = [
  18,
  28,
  40,
  56,
  74,
];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type AudioFrame = {
  pcmBase64: string;
  sampleRate: number;
  timestamp: number;
  level?: number;
};

type PitchResult = {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
};

type DisplayedPitch = {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
};

// ─────────────────────────────────────────────
// PCM16 → Float32
// ─────────────────────────────────────────────

function pcm16Base64ToFloat32(
  base64: string
): Float32Array {
  const binaryString = atob(base64);

  const byteLength = binaryString.length;

  const buffer = new ArrayBuffer(byteLength);

  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const view = new DataView(buffer);

  const sampleCount = Math.floor(
    byteLength / 2
  );

  const samples = new Float32Array(
    sampleCount
  );

  for (let i = 0; i < sampleCount; i++) {
    const int16 = view.getInt16(
      i * 2,
      true
    );

    samples[i] = int16 / 32768;
  }

  return samples;
}

// ─────────────────────────────────────────────
// Median helper
// ─────────────────────────────────────────────

function getMedian(
  values: number[]
): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort(
    (a, b) => a - b
  );

  const middle = Math.floor(
    sorted.length / 2
  );

  if (sorted.length % 2 === 0) {
    return (
      (sorted[middle - 1] +
        sorted[middle]) /
      2
    );
  }

  return sorted[middle];
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function Tuner() {
  console.log("TUNER COMPONENT LOADED");

  // ─────────────────────────────────────────────
  // Audio subscriptions
  // ─────────────────────────────────────────────

  const frameSubscriptionRef =
    useRef<{
      remove: () => void;
    } | null>(null);

  const errorSubscriptionRef =
    useRef<{
      remove: () => void;
    } | null>(null);

  const isListeningRef =
    useRef(false);

  const isStartingRef =
    useRef(false);

  // ─────────────────────────────────────────────
  // Pitch processing refs
  // ─────────────────────────────────────────────

  const pitchHistoryRef =
    useRef<PitchResult[]>([]);

  const nullFrameCountRef =
    useRef(0);

  const displayedPitchRef =
    useRef<DisplayedPitch | null>(null);

  const pendingPitchRef =
    useRef<{
      note: string;
      octave: number;
      count: number;
    } | null>(null);

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────

  const [note, setNote] =
    useState<string | null>(null);

  const [octave, setOctave] =
    useState<number | null>(null);

  const [cents, setCents] =
    useState<number | null>(null);

  const [showOctave, setShowOctave] =
    useState(true);

  const [
    referenceFrequency,
    setReferenceFrequency,
  ] = useState(440);

  const [
    showReferenceModal,
    setShowReferenceModal,
  ] = useState(false);

  const [hasPermission, setHasPermission] =
    useState(false);

  // ─────────────────────────────────────────────
  // Reference frequency ref
  // ─────────────────────────────────────────────

  const referenceFrequencyRef =
    useRef(referenceFrequency);

  useEffect(() => {
    referenceFrequencyRef.current =
      referenceFrequency;
  }, [referenceFrequency]);

  // ─────────────────────────────────────────────
  // Update displayed pitch
  // ─────────────────────────────────────────────

  const updateDisplayedPitch = useCallback(
    (result: PitchResult) => {
      const current =
        displayedPitchRef.current;

      // If there is currently no displayed
      // note, show this pitch immediately.
      if (!current) {
        displayedPitchRef.current = {
          note: result.note,
          octave: result.octave,
          frequency: result.frequency,
          cents: result.cents,
        };

        setNote(result.note);
        setOctave(result.octave);
        setCents(result.cents);

        return;
      }

      const sameNote =
        current.note === result.note &&
        current.octave === result.octave;

      // Same note:
      // update the tuning information immediately.
      if (sameNote) {
        pendingPitchRef.current = null;

        pitchHistoryRef.current.push(
          result
        );

        if (
          pitchHistoryRef.current.length >
          PITCH_HISTORY_SIZE
        ) {
          pitchHistoryRef.current.shift();
        }

        const medianFrequency =
          getMedian(
            pitchHistoryRef.current.map(
              pitch => pitch.frequency
            )
          );

        const medianCents =
          getMedian(
            pitchHistoryRef.current.map(
              pitch => pitch.cents
            )
          );

        displayedPitchRef.current = {
          note: result.note,
          octave: result.octave,
          frequency: medianFrequency,
          cents: medianCents,
        };

        setNote(result.note);
        setOctave(result.octave);
        setCents(medianCents);

        return;
      }

      // Different note:
      // don't immediately jump to it.
      if (
        pendingPitchRef.current &&
        pendingPitchRef.current.note ===
          result.note &&
        pendingPitchRef.current.octave ===
          result.octave
      ) {
        pendingPitchRef.current.count += 1;
      } else {
        pendingPitchRef.current = {
          note: result.note,
          octave: result.octave,
          count: 1,
        };
      }

      if (
        pendingPitchRef.current.count <
        NOTE_SWITCH_DETECTIONS
      ) {
        return;
      }

      // Accept the new note.
      displayedPitchRef.current = {
        note: result.note,
        octave: result.octave,
        frequency: result.frequency,
        cents: result.cents,
      };

      pitchHistoryRef.current = [
        result,
      ];

      pendingPitchRef.current = null;

      setNote(result.note);
      setOctave(result.octave);
      setCents(result.cents);
    },
    []
  );

  // ─────────────────────────────────────────────
  // Process audio frame
  // ─────────────────────────────────────────────

  const processAudioFrame = useCallback(
    (frame: AudioFrame) => {
      try {
        if (!frame.pcmBase64) {
          return;
        }

        const samples =
          pcm16Base64ToFloat32(
            frame.pcmBase64
          );

        if (samples.length === 0) {
          return;
        }

        // const t0 = Date.now();

        const result =
          analyzePitch(
            samples,
            frame.sampleRate,
            referenceFrequencyRef.current
          );

        // const dt = Date.now() - t0;

        // if (dt > 20) {
        //   console.log("SLOW FRAME:", dt, "ms");
        // }

        // console.log(
        //   "PITCH RESULT:",
        //   result
        // );

        // ─────────────────────────────────────
        // No pitch detected
        // ─────────────────────────────────────

        if (!result) {
          nullFrameCountRef.current += 1;

          if (
            nullFrameCountRef.current >=
            NULL_FRAMES_TO_CLEAR
          ) {
            displayedPitchRef.current =
              null;

            pitchHistoryRef.current = [];

            pendingPitchRef.current = null;

            setNote(null);
            setOctave(null);
            setCents(null);
          }

          return;
        }

        // ─────────────────────────────────────
        // Valid pitch detected
        // ─────────────────────────────────────

        nullFrameCountRef.current = 0;

        updateDisplayedPitch(result);
      } catch (error) {
        console.warn(
          "ERROR PROCESSING TUNER AUDIO:",
          error
        );
      }
    },
    [updateDisplayedPitch]
  );

  // ─────────────────────────────────────────────
  // Microphone permission
  // ─────────────────────────────────────────────

  const requestMicrophonePermission =
    useCallback(async (): Promise<boolean> => {
      try {
        console.log(
          "REQUEST MICROPHONE PERMISSION CALLED"
        );

        const permission =
          await requestPermission();

        console.log(
          "requestPermission() RETURNED:",
          permission
        );

        if (permission !== "granted") {
          console.log(
            "MICROPHONE PERMISSION DENIED"
          );

          setHasPermission(false);

          return false;
        }

        console.log(
          "MICROPHONE PERMISSION GRANTED"
        );

        setHasPermission(true);

        return true;
      } catch (error) {
        console.warn(
          "Unable to request microphone permission:",
          error
        );

        setHasPermission(false);

        return false;
      }
    }, []);

  // ─────────────────────────────────────────────
  // Start microphone
  // ─────────────────────────────────────────────

  const startMicrophone =
    useCallback(async () => {
      console.log(
        "START MICROPHONE CALLED"
      );

      if (
        isListeningRef.current ||
        isStartingRef.current
      ) {
        console.log(
          "MICROPHONE ALREADY STARTING OR LISTENING"
        );

        return;
      }

      isStartingRef.current = true;

      try {
        // Clean up old listeners first.
        if (
          frameSubscriptionRef.current
        ) {
          frameSubscriptionRef.current.remove();

          frameSubscriptionRef.current =
            null;
        }

        if (
          errorSubscriptionRef.current
        ) {
          errorSubscriptionRef.current.remove();

          errorSubscriptionRef.current =
            null;
        }

        console.log(
          "ADDING FRAME LISTENER"
        );

        frameSubscriptionRef.current =
          addFrameListener(
            processAudioFrame
          );

        console.log(
          "FRAME LISTENER ADDED"
        );

        console.log(
          "ADDING ERROR LISTENER"
        );

        errorSubscriptionRef.current =
          addErrorListener(
            (error: {
              message: string;
            }) => {
              console.error(
                "TUNER AUDIO ERROR:",
                error.message
              );
            }
          );

        console.log(
          "ERROR LISTENER ADDED"
        );

        console.log(
          "CALLING START()"
        );

        await start({
          sampleRate: 44100,
          frameDurationMs: 50,
          channels: 1,
          enableLevelMeter: true,
        });

        console.log(
          "START() COMPLETED"
        );

        isListeningRef.current = true;
        isStartingRef.current = false;

        console.log(
          "MICROPHONE IS NOW LISTENING"
        );
      } catch (error) {
        console.error(
          "UNABLE TO START TUNER:",
          error
        );

        if (
          frameSubscriptionRef.current
        ) {
          frameSubscriptionRef.current.remove();

          frameSubscriptionRef.current =
            null;
        }

        if (
          errorSubscriptionRef.current
        ) {
          errorSubscriptionRef.current.remove();

          errorSubscriptionRef.current =
            null;
        }

        isListeningRef.current = false;
        isStartingRef.current = false;
      }
    }, [processAudioFrame]);

  // ─────────────────────────────────────────────
  // Stop microphone
  // ─────────────────────────────────────────────

  const stopMicrophone =
    useCallback(async () => {
      console.log(
        "STOPPING MICROPHONE"
      );

      try {
        if (
          isListeningRef.current
        ) {
          await stop();
        }
      } catch (error) {
        console.warn(
          "ERROR STOPPING MICROPHONE:",
          error
        );
      }

      if (
        frameSubscriptionRef.current
      ) {
        frameSubscriptionRef.current.remove();

        frameSubscriptionRef.current = null;
      }

      if (
        errorSubscriptionRef.current
      ) {
        errorSubscriptionRef.current.remove();

        errorSubscriptionRef.current = null;
      }

      isListeningRef.current = false;
      isStartingRef.current = false;
    }, []);

  // ─────────────────────────────────────────────
  // Initial microphone setup
  // ─────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    const initializeMicrophone =
      async () => {
        console.log(
          "TUNER USE EFFECT RUNNING"
        );

        const granted =
          await requestMicrophonePermission();

        console.log(
          "PERMISSION FUNCTION RETURNED:",
          granted
        );

        if (
          granted &&
          mounted
        ) {
          console.log(
            "PERMISSION GRANTED — STARTING MICROPHONE"
          );

          await startMicrophone();

          console.log(
            "START MICROPHONE FINISHED"
          );
        }
      };

    void initializeMicrophone();

    return () => {
      mounted = false;

      void stopMicrophone();
    };
  }, [
    requestMicrophonePermission,
    startMicrophone,
    stopMicrophone,
  ]);

  // ─────────────────────────────────────────────
  // Tuning calculations
  // ─────────────────────────────────────────────

  const isInTune =
    cents !== null &&
    Math.abs(cents) <= TUNED_CENTS;

  const getBarLevel = (): number => {
    if (cents === null) {
      return 0;
    }

    const distance = Math.abs(cents);

    if (distance <= 3) {
      return 5;
    }

    if (distance <= 7) {
      return 4;
    }

    if (distance <= 12) {
      return 3;
    }

    if (distance <= 20) {
      return 2;
    }

    if (distance <= 35) {
      return 1;
    }

    return 0;
  };

  const barLevel = getBarLevel();

  const getBarColor = (
    index: number,
    active: boolean
  ): string => {
    if (!active) {
      return POLYGON_GREY;
    }

    if (isInTune) {
      return TUNED_COLOR;
    }

    if (index >= 3) {
      return CLOSE_COLOR;
    }

    return DEFAULT_ACCENT_COLOR;
  };

  // ─────────────────────────────────────────────
  // Build bars
  // ─────────────────────────────────────────────

  const buildBars = (side: "left" | "right") => {
    const indexes = side === "left" ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
    return indexes.map((heightIndex, position) => {
      const distanceFromCenter =
        side === "left" ? indexes.length - 1 - position : position;
      const active = distanceFromCenter < barLevel;
      return { heightIndex, active, color: getBarColor(heightIndex, active) };
    });
  };

  const leftBars =
    buildBars("left");

  const rightBars =
    buildBars("right");

  // ─────────────────────────────────────────────
  // Reference frequency controls
  // ─────────────────────────────────────────────

  const decreaseReference = () => {
    setReferenceFrequency(
      current =>
        Math.max(
          MIN_REFERENCE_FREQUENCY,
          current - REFERENCE_STEP
        )
    );
  };

  const increaseReference = () => {
    setReferenceFrequency(
      current =>
        Math.min(
          MAX_REFERENCE_FREQUENCY,
          current + REFERENCE_STEP
        )
    );
  };

  // ─────────────────────────────────────────────
  // Display
  // ─────────────────────────────────────────────

  const displayedNote =
    note === null
      ? "-"
      : showOctave &&
        octave !== null
      ? `${note}${octave}`
      : note;

  const displayedCents =
    cents === null
      ? null
      : Math.round(cents);

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <View style={styles.container}>

      <View style={styles.tunerArea}>

        <Text
          style={[
            styles.note,
            isInTune &&
              styles.noteTuned,
          ]}
        >
          {displayedNote}
        </Text>

        <View style={styles.barRow}>

          <View style={styles.sideBars}>
            {leftBars.map(
              (bar, index) => (
                <View
                  key={`left-${index}`}
                  style={[
                    styles.bar,
                    {
                      height:
                        BAR_HEIGHTS[
                          bar.heightIndex
                        ],
                      backgroundColor:
                        bar.color,
                      opacity:
                        bar.active
                          ? 1
                          : 0.35,
                    },
                  ]}
                />
              )
            )}
          </View>

          <View
            style={styles.centerSpace}
          />

          <View style={styles.sideBars}>
            {rightBars.map(
              (bar, index) => (
                <View
                  key={`right-${index}`}
                  style={[
                    styles.bar,
                    {
                      height:
                        BAR_HEIGHTS[
                          bar.heightIndex
                        ],
                      backgroundColor:
                        bar.color,
                      opacity:
                        bar.active
                          ? 1
                          : 0.35,
                    },
                  ]}
                />
              )
            )}
          </View>

        </View>

        <View
          style={styles.centsRow}
        >

          <View
            style={styles.centsSide}
          >
            {displayedCents !== null &&
              displayedCents <
                -TUNED_CENTS && (
                <Text
                  style={
                    styles.centsText
                  }
                >
                  {displayedCents}
                </Text>
              )}
          </View>

          <View
            style={styles.centerSpace}
          />

          <View
            style={styles.centsSide}
          >
            {displayedCents !== null &&
              displayedCents >
                TUNED_CENTS && (
                <Text
                  style={
                    styles.centsText
                  }
                >
                  +{displayedCents}
                </Text>
              )}
          </View>

        </View>

      </View>

      {/* Bottom controls */}

      <View
        style={styles.bottomControls}
      >

        <Pressable
          onPress={() =>
            setShowReferenceModal(true)
          }
          style={({ pressed }) => [
            styles.referenceButton,
            pressed &&
              styles.referenceButtonPressed,
          ]}
        >
          <Text
            style={
              styles.referenceText
            }
          >
            {referenceFrequency} Hz
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            setShowOctave(
              current => !current
            )
          }
          style={({ pressed }) => [
            styles.octaveButton,
            pressed &&
              styles.octaveButtonPressed,
          ]}
        >
          <Text
            style={styles.octaveText}
          >
            Octave:{" "}
            {showOctave
              ? "On"
              : "Off"}
          </Text>
        </Pressable>

      </View>

      {/* Reference modal */}

      <Modal
        visible={
          showReferenceModal
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowReferenceModal(false)
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.referenceModal
            }
          >

            <Text
              style={
                styles.modalTitle
              }
            >
              Reference Pitch
            </Text>

            <Text
              style={
                styles.modalSubtitle
              }
            >
              Frequency of A4
            </Text>

            <View
              style={
                styles.frequencyRow
              }
            >

              <Pressable
                onPress={
                  decreaseReference
                }
                disabled={
                  referenceFrequency <=
                  MIN_REFERENCE_FREQUENCY
                }
                style={({
                  pressed,
                }) => [
                  styles.adjustButton,
                  pressed &&
                    styles.adjustButtonPressed,
                  referenceFrequency <=
                    MIN_REFERENCE_FREQUENCY &&
                    styles.adjustButtonDisabled,
                ]}
              >
                <Text
                  style={
                    styles.adjustText
                  }
                >
                  −
                </Text>
              </Pressable>

              <Text
                style={
                  styles.frequencyValue
                }
              >
                {referenceFrequency} Hz
              </Text>

              <Pressable
                onPress={
                  increaseReference
                }
                disabled={
                  referenceFrequency >=
                  MAX_REFERENCE_FREQUENCY
                }
                style={({
                  pressed,
                }) => [
                  styles.adjustButton,
                  pressed &&
                    styles.adjustButtonPressed,
                  referenceFrequency >=
                    MAX_REFERENCE_FREQUENCY &&
                    styles.adjustButtonDisabled,
                ]}
              >
                <Text
                  style={
                    styles.adjustText
                  }
                >
                  +
                </Text>
              </Pressable>

            </View>

            <Text
              style={
                styles.rangeText
              }
            >
              Range:{" "}
              {MIN_REFERENCE_FREQUENCY}
              –
              {MAX_REFERENCE_FREQUENCY} Hz
            </Text>

            <Pressable
              onPress={() =>
                setShowReferenceModal(
                  false
                )
              }
              style={({ pressed }) => [
                styles.doneButton,
                pressed &&
                  styles.doneButtonPressed,
              ]}
            >
              <Text
                style={
                  styles.doneText
                }
              >
                Done
              </Text>
            </Pressable>

          </View>
        </View>
      </Modal>

      {/* Permission overlay */}

      {!hasPermission && (
        <View
          style={
            styles.permissionOverlay
          }
        >
          <Text
            style={
              styles.permissionText
            }
          >
            Microphone permission is
            required to use the tuner.
          </Text>

          <Pressable
            onPress={async () => {
              const granted =
                await requestMicrophonePermission();

              if (granted) {
                await startMicrophone();
              }
            }}
            style={({ pressed }) => [
              styles.permissionButton,
              pressed &&
                styles.permissionButtonPressed,
            ]}
          >
            <Text
              style={
                styles.permissionButtonText
              }
            >
              Grant Permission
            </Text>
          </Pressable>
        </View>
      )}

    </View>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  tunerArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },

  note: {
    fontSize: 72,
    fontWeight: "600",
    color: TEXT,
    letterSpacing: 1,
    marginBottom: 34,
  },

  noteTuned: {
    color: TUNED_COLOR,
  },

  barRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },

  sideBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  centerSpace: {
    width: 18,
  },

  bar: {
    width: 7,
    borderRadius: 4,
  },

  centsRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 18,
  },

  centsSide: {
    flex: 1,
    minHeight: 24,
    alignItems: "center",
  },

  centsText: {
    color: MUTED,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
  },

  bottomControls: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  referenceButton: {
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  referenceButtonPressed: {
    backgroundColor: SURFACE_2,
  },

  referenceText: {
    color: TEXT,
    fontSize: 14,
  },

  octaveButton: {
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },

  octaveButtonPressed: {
    backgroundColor: SURFACE_2,
  },

  octaveText: {
    color: TEXT,
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  referenceModal: {
    width: "82%",
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },

  modalTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "600",
  },

  modalSubtitle: {
    color: MUTED,
    fontSize: 14,
    marginTop: 6,
  },

  frequencyRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
  },

  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
  },

  adjustButtonPressed: {
    opacity: 0.7,
  },

  adjustButtonDisabled: {
    opacity: 0.35,
  },

  adjustText: {
    color: TEXT,
    fontSize: 28,
    fontWeight: "400",
  },

  frequencyValue: {
    color: TEXT,
    fontSize: 20,
    fontWeight: "500",
  },

  rangeText: {
    color: MUTED,
    fontSize: 13,
    marginTop: 14,
  },

  doneButton: {
    width: "100%",
    backgroundColor: DEFAULT_ACCENT_COLOR,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 22,
  },

  doneButtonPressed: {
    opacity: 0.7,
  },

  doneText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: "600",
  },

  permissionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  permissionText: {
    color: TEXT,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 24,
  },

  permissionButton: {
    backgroundColor:
      DEFAULT_ACCENT_COLOR,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },

  permissionButtonPressed: {
    opacity: 0.7,
  },

  permissionButtonText: {
    color: BACKGROUND,
    fontSize: 16,
    fontWeight: "600",
  },
});