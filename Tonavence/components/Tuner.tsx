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

const BAR_HEIGHTS = [
  18,
  28,
  40,
  56,
  74,
];

// Number of recent valid pitch detections
// used for smoothing.
const PITCH_HISTORY_SIZE = 5;

// Number of matching detections required
// before accepting a note.
const MIN_STABLE_DETECTIONS = 3;

// Number of consecutive detections required
// before switching from one note to another.
const NOTE_SWITCH_DETECTIONS = 2;

// Number of consecutive null frames before
// clearing the tuner display.
const NULL_FRAMES_TO_CLEAR = 8;

// ─────────────────────────────────────────────
// PCM16 → Float32
// ─────────────────────────────────────────────

function pcm16Base64ToFloat32(
  base64: string
): Float32Array {
  /*
   * PCM16 = 2 bytes per sample.
   *
   * The expo-stream-audio package sends:
   *
   * signed 16-bit little-endian PCM
   */

  const binaryString = atob(base64);

  const byteLength = binaryString.length;

  const buffer = new ArrayBuffer(byteLength);

  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const view = new DataView(buffer);

  const sampleCount =
    Math.floor(byteLength / 2);

  const samples =
    new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    const int16 =
      view.getInt16(i * 2, true);

    /*
     * Convert:
     *
     * -32768 → approximately -1
     *      0 → 0
     *  32767 → approximately +1
     */

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

  const middle =
    Math.floor(sorted.length / 2);

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
  // Pitch smoothing refs
  // ─────────────────────────────────────────────

  const pitchHistoryRef =
    useRef<
      {
        note: string;
        octave: number;
        frequency: number;
        cents: number;
      }[]
    >([]);

  const nullFrameCountRef =
    useRef(0);

  const displayedPitchRef =
    useRef<{
      note: string;
      octave: number;
      frequency: number;
      cents: number;
    } | null>(null);

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

  const [referenceFrequency, setReferenceFrequency] =
    useState(440);

  const [showReferenceModal, setShowReferenceModal] =
    useState(false);

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
  // Audio processing
  // ─────────────────────────────────────────────

  const processAudioFrame = useCallback(
    (frame: {
      pcmBase64: string;
      sampleRate: number;
      timestamp: number;
      level?: number;
    }) => {
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

        const result =
          analyzePitch(
            samples,
            frame.sampleRate,
            referenceFrequencyRef.current
          );

        // ─────────────────────────────────────
        // No pitch detected
        // ─────────────────────────────────────

        if (!result) {
          nullFrameCountRef.current += 1;

          /*
           * Do not immediately clear the tuner.
           *
           * Individual audio frames can fail to produce
           * a pitch even while the guitar is still ringing.
           */
          if (
            nullFrameCountRef.current >=
            NULL_FRAMES_TO_CLEAR
          ) {
            displayedPitchRef.current =
              null;

            pitchHistoryRef.current =
              [];

            pendingPitchRef.current =
              null;

            setNote(null);
            setOctave(null);
            setCents(null);
          }

          return;
        }

        // We received a valid pitch.
        nullFrameCountRef.current = 0;

        // ─────────────────────────────────────
        // Add pitch to history
        // ─────────────────────────────────────

        pitchHistoryRef.current.push({
          note: result.note,
          octave: result.octave,
          frequency: result.frequency,
          cents: result.cents,
        });

        /*
         * Keep only the most recent five
         * valid detections.
         */
        if (
          pitchHistoryRef.current.length >
          PITCH_HISTORY_SIZE
        ) {
          pitchHistoryRef.current.shift();
        }

        const history =
          pitchHistoryRef.current;

        // ─────────────────────────────────────
        // Group detections by note + octave
        // ─────────────────────────────────────

        const groups = new Map<
          string,
          {
            note: string;
            octave: number;
            frequency: number;
            cents: number;
          }[]
        >();

        for (const pitch of history) {
          const key =
            `${pitch.note}${pitch.octave}`;

          if (!groups.has(key)) {
            groups.set(key, []);
          }

          groups
            .get(key)!
            .push(pitch);
        }

        // ─────────────────────────────────────
        // Find most common note
        // ─────────────────────────────────────

        let bestGroup:
          | {
              note: string;
              octave: number;
              frequency: number;
              cents: number;
            }[]
          | null = null;

        for (const group of groups.values()) {
          if (
            !bestGroup ||
            group.length >
              bestGroup.length
          ) {
            bestGroup = group;
          }
        }

        /*
         * We need at least three matching
         * detections before accepting the pitch.
         */
        if (
          !bestGroup ||
          bestGroup.length <
            MIN_STABLE_DETECTIONS
        ) {
          return;
        }

        const stableNote =
          bestGroup[0].note;

        const stableOctave =
          bestGroup[0].octave;

        // ─────────────────────────────────────
        // Prevent sudden note jumps
        // ─────────────────────────────────────

        const currentPitch =
          displayedPitchRef.current;

        if (
          currentPitch &&
          (
            currentPitch.note !==
              stableNote ||
            currentPitch.octave !==
              stableOctave
          )
        ) {
          /*
           * We detected a different note.
           *
           * Require it to appear again before
           * switching the displayed note.
           */
          if (
            pendingPitchRef.current &&
            pendingPitchRef.current.note ===
              stableNote &&
            pendingPitchRef.current.octave ===
              stableOctave
          ) {
            pendingPitchRef.current.count += 1;
          } else {
            pendingPitchRef.current = {
              note: stableNote,
              octave: stableOctave,
              count: 1,
            };
          }

          if (
            pendingPitchRef.current.count <
            NOTE_SWITCH_DETECTIONS
          ) {
            return;
          }

          pendingPitchRef.current = null;
        }

        pendingPitchRef.current = null;

        // ─────────────────────────────────────
        // Median frequency
        // ─────────────────────────────────────

        /*
         * Use the median instead of the latest
         * frequency to remove occasional noisy
         * measurements.
         */
        const medianFrequency =
          getMedian(
            bestGroup.map(
              pitch => pitch.frequency
            )
          );

        // ─────────────────────────────────────
        // Calculate target frequency
        // ─────────────────────────────────────

        const noteNames = [
          "C",
          "C#",
          "D",
          "D#",
          "E",
          "F",
          "F#",
          "G",
          "G#",
          "A",
          "A#",
          "B",
        ];

        const noteIndex =
          noteNames.indexOf(
            stableNote
          );

        if (noteIndex === -1) {
          return;
        }

        /*
         * MIDI number:
         *
         * C4 = 60
         * A4 = 69
         */
        const midiNumber =
          (stableOctave + 1) * 12 +
          noteIndex;

        const targetFrequency =
          referenceFrequencyRef.current *
          Math.pow(
            2,
            (midiNumber - 69) / 12
          );

        // ─────────────────────────────────────
        // Calculate smoothed cents
        // ─────────────────────────────────────

        const smoothedCents =
          1200 *
          Math.log2(
            medianFrequency /
              targetFrequency
          );

        const finalPitch = {
          note: stableNote,
          octave: stableOctave,
          frequency:
            medianFrequency,
          cents: smoothedCents,
        };

        // ─────────────────────────────────────
        // Update display
        // ─────────────────────────────────────

        displayedPitchRef.current =
          finalPitch;

        setNote(
          finalPitch.note
        );

        setOctave(
          finalPitch.octave
        );

        setCents(
          finalPitch.cents
        );
      } catch (error) {
        console.warn(
          "ERROR PROCESSING TUNER AUDIO:",
          error
        );
      }
    },
    []
  );

  // ─────────────────────────────────────────────
  // Microphone permission
  // ─────────────────────────────────────────────

  const requestMicrophonePermission =
    async (): Promise<boolean> => {
      try {
        console.log(
          "REQUEST MICROPHONE PERMISSION CALLED"
        );

        console.log(
          "ABOUT TO CALL requestPermission()"
        );

        const permission =
          await requestPermission();

        console.log(
          "requestPermission() RETURNED:",
          permission
        );

        if (
          permission !== "granted"
        ) {
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
    };

  // ─────────────────────────────────────────────
  // Microphone stream
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

      isStartingRef.current =
        true;

      try {
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

        isListeningRef.current =
          true;

        isStartingRef.current =
          false;

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

        isListeningRef.current =
          false;

        isStartingRef.current =
          false;
      }
    }, [processAudioFrame]);

  // ─────────────────────────────────────────────
  // Stop microphone
  // ─────────────────────────────────────────────

  const stopMicrophone =
    useCallback(async () => {
      try {
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

        if (
          isListeningRef.current
        ) {
          await stop();
        }

        isListeningRef.current =
          false;

        isStartingRef.current =
          false;
      } catch (error) {
        console.warn(
          "UNABLE TO STOP TUNER:",
          error
        );
      }
    }, []);

  // ─────────────────────────────────────────────
  // Initial permission request
  // ─────────────────────────────────────────────

  useEffect(() => {
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

        if (granted) {
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
      void stopMicrophone();
    };
  }, [
    startMicrophone,
    stopMicrophone,
  ]);

  // ─────────────────────────────────────────────
  // Tuning calculations
  // ─────────────────────────────────────────────

  const isInTune =
    cents !== null &&
    Math.abs(cents) <=
      TUNED_CENTS;

  const getBarLevel =
    (): number => {
      if (cents === null) {
        return 0;
      }

      const distance =
        Math.abs(cents);

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

  const barLevel =
    getBarLevel();

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

  const buildBars = (
    side: "left" | "right"
  ) => {
    const indexes =
      side === "left"
        ? [0, 1, 2, 3, 4]
        : [4, 3, 2, 1, 0];

    return indexes.map(
      (
        heightIndex,
        index
      ) => ({
        heightIndex,
        active:
          index < barLevel,
        color: getBarColor(
          heightIndex,
          index < barLevel
        ),
      })
    );
  };

  const leftBars =
    buildBars("left");

  const rightBars =
    buildBars("right");

  // ─────────────────────────────────────────────
  // Reference frequency controls
  // ─────────────────────────────────────────────

  const decreaseReference =
    () => {
      setReferenceFrequency(
        current =>
          Math.max(
            MIN_REFERENCE_FREQUENCY,
            current -
              REFERENCE_STEP
          )
      );
    };

  const increaseReference =
    () => {
      setReferenceFrequency(
        current =>
          Math.min(
            MAX_REFERENCE_FREQUENCY,
            current +
              REFERENCE_STEP
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
    <View
      style={styles.container}
    >
      {/* ─────────────────────────────── */}
      {/* Main tuner */}
      {/* ─────────────────────────────── */}

      <View
        style={styles.tunerArea}
      >
        <Text
          style={[
            styles.note,
            isInTune &&
              styles.noteTuned,
          ]}
        >
          {displayedNote}
        </Text>

        {/* Bars */}

        <View
          style={styles.barRow}
        >
          {/* Left */}

          <View
            style={styles.sideBars}
          >
            {leftBars.map(
              (
                bar,
                index
              ) => (
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

          {/* Right */}

          <View
            style={styles.sideBars}
          >
            {rightBars.map(
              (
                bar,
                index
              ) => (
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

        {/* Cents */}

        <View
          style={styles.centsRow}
        >
          <View
            style={styles.centsSide}
          >
            {displayedCents !==
              null &&
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
            {displayedCents !==
              null &&
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

      {/* ─────────────────────────────── */}
      {/* Bottom controls */}
      {/* ─────────────────────────────── */}

      <View
        style={
          styles.bottomControls
        }
      >
        {/* Reference */}

        <Pressable
          onPress={() =>
            setShowReferenceModal(
              true
            )
          }
          style={({
            pressed,
          }) => [
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

        {/* Octave */}

        <Pressable
          onPress={() =>
            setShowOctave(
              current =>
                !current
            )
          }
          style={({
            pressed,
          }) => [
            styles.octaveButton,
            pressed &&
              styles.octaveButtonPressed,
          ]}
        >
          <Text
            style={
              styles.octaveText
            }
          >
            Octave:{" "}
            {showOctave
              ? "On"
              : "Off"}
          </Text>
        </Pressable>
      </View>

      {/* ─────────────────────────────── */}
      {/* Reference modal */}
      {/* ─────────────────────────────── */}

      <Modal
        visible={
          showReferenceModal
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowReferenceModal(
            false
          )
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
                {referenceFrequency}{" "}
                Hz
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
              {MAX_REFERENCE_FREQUENCY}{" "}
              Hz
            </Text>

            <Pressable
              onPress={() =>
                setShowReferenceModal(
                  false
                )
              }
              style={({
                pressed,
              }) => [
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

      {/* ─────────────────────────────── */}
      {/* Permission */}
      {/* ─────────────────────────────── */}

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
            style={({
              pressed,
            }) => [
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

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        BACKGROUND,
    },

    tunerArea: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
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
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 18,
    },

    sideBars: {
      flex: 1,
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
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
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 18,
      marginTop: 18,
    },

    centsSide: {
      flex: 1,
      minHeight: 24,
      alignItems:
        "center",
    },

    centsText: {
      color: MUTED,
      fontSize: 17,
      fontVariant: [
        "tabular-nums",
      ],
    },

    bottomControls: {
      position:
        "absolute",
      left: 0,
      right: 0,
      bottom: 24,
      paddingHorizontal: 20,
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
    },

    referenceButton: {
      backgroundColor:
        SURFACE,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor:
        SURFACE_2,
    },

    referenceButtonPressed: {
      backgroundColor:
        SURFACE_2,
    },

    referenceText: {
      color: TEXT,
      fontSize: 14,
      fontWeight: "500",
    },

    octaveButton: {
      backgroundColor:
        SURFACE,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor:
        SURFACE_2,
    },

    octaveButtonPressed: {
      backgroundColor:
        SURFACE_2,
    },

    octaveText: {
      color: MUTED,
      fontSize: 14,
      fontWeight: "500",
    },

    // ─────────────────────────────────────────────
    // Modal
    // ─────────────────────────────────────────────

    modalOverlay: {
      flex: 1,
      backgroundColor:
        "rgba(0, 0, 0, 0.65)",
      alignItems:
        "center",
      justifyContent:
        "center",
      paddingHorizontal: 28,
    },

    referenceModal: {
      width: "100%",
      maxWidth: 360,
      backgroundColor:
        SURFACE,
      borderRadius: 18,
      padding: 24,
      borderWidth: 1,
      borderColor:
        SURFACE_2,
    },

    modalTitle: {
      color: TEXT,
      fontSize: 22,
      fontWeight: "600",
      textAlign:
        "center",
    },

    modalSubtitle: {
      color: MUTED,
      fontSize: 14,
      textAlign:
        "center",
      marginTop: 6,
    },

    frequencyRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
      marginTop: 28,
    },

    adjustButton: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor:
        SURFACE_2,
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    adjustButtonPressed: {
      opacity: 0.7,
    },

    adjustButtonDisabled: {
      opacity: 0.3,
    },

    adjustText: {
      color: TEXT,
      fontSize: 30,
      fontWeight: "300",
    },

    frequencyValue: {
      color: TEXT,
      fontSize: 28,
      fontWeight: "600",
      fontVariant: [
        "tabular-nums",
      ],
    },

    rangeText: {
      color: MUTED,
      fontSize: 13,
      textAlign:
        "center",
      marginTop: 12,
    },

    doneButton: {
      marginTop: 24,
      backgroundColor:
        DEFAULT_ACCENT_COLOR,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems:
        "center",
    },

    doneButtonPressed: {
      opacity: 0.75,
    },

    doneText: {
      color: BACKGROUND,
      fontSize: 16,
      fontWeight: "700",
    },

    permissionOverlay: {
      position:
        "absolute",
      left: 20,
      right: 20,
      bottom: 80,
      backgroundColor:
        SURFACE,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor:
        SURFACE_2,
    },

    permissionText: {
      color: MUTED,
      fontSize: 14,
      textAlign:
        "center",
    },

    permissionButton: {
      marginTop: 12,
      backgroundColor:
        DEFAULT_ACCENT_COLOR,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems:
        "center",
    },

    permissionButtonPressed: {
      opacity: 0.75,
    },

    permissionButtonText: {
      color: BACKGROUND,
      fontSize: 14,
      fontWeight: "700",
    },
  });