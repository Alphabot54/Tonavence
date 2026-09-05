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
// Component
// ─────────────────────────────────────────────

export default function Tuner() {
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

        const result = analyzePitch(
          samples,
          frame.sampleRate,
          referenceFrequencyRef.current
        );

        if (!result) {
          setNote(null);
          setOctave(null);
          setCents(null);

          return;
        }

        setNote(result.note);
        setOctave(result.octave);
        setCents(result.cents);
      } catch (error) {
        console.warn(
          "Error processing tuner audio:",
          error
        );
      }
    },
    []
  );

  // ─────────────────────────────────────────────
  // Microphone setup
  // ─────────────────────────────────────────────

  useEffect(() => {
    let frameSubscription:
      | { remove: () => void }
      | undefined;

    let errorSubscription:
      | { remove: () => void }
      | undefined;

    let mounted = true;

    const setupMicrophone =
      async () => {
        try {
          const permission =
            await requestPermission();

          if (!mounted) {
            return;
          }

          if (permission !== "granted") {
            setHasPermission(false);
            return;
          }

          setHasPermission(true);

          /*
           * Subscribe BEFORE starting the microphone
           * so we don't miss the first frames.
           */
          frameSubscription =
            addFrameListener(
              processAudioFrame
            );

          errorSubscription =
            addErrorListener(
              (error: {
                message: string;
              }) => {
                console.warn(
                  "Tuner audio error:",
                  error.message
                );
              }
            );

          await start({
            sampleRate: 44100,
            frameDurationMs: 50,
            channels: 1,
            enableLevelMeter: true,
          });
        } catch (error) {
          console.warn(
            "Unable to start tuner:",
            error
          );

          if (mounted) {
            setHasPermission(false);
          }
        }
      };

    void setupMicrophone();

    return () => {
      mounted = false;

      frameSubscription?.remove();
      errorSubscription?.remove();

      void stop();
    };
  }, [processAudioFrame]);

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
      (heightIndex, index) => ({
        heightIndex,
        active: index < barLevel,
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

      {/* ─────────────────────────────── */}
      {/* Main tuner */}
      {/* ─────────────────────────────── */}

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

        {/* Bars */}

        <View style={styles.barRow}>

          {/* Left */}

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

          {/* Right */}

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
        style={styles.bottomControls}
      >

        {/* Reference */}

        <Pressable
          onPress={() =>
            setShowReferenceModal(
              true
            )
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

        {/* Octave */}

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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },

  referenceButtonPressed: {
    backgroundColor: SURFACE_2,
  },

  referenceText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "500",
  },

  octaveButton: {
    backgroundColor: SURFACE,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },

  octaveButtonPressed: {
    backgroundColor: SURFACE_2,
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
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  referenceModal: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },

  modalTitle: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },

  modalSubtitle: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
  },

  frequencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
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
    fontVariant: ["tabular-nums"],
  },

  rangeText: {
    color: MUTED,
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
  },

  doneButton: {
    marginTop: 24,
    backgroundColor:
      DEFAULT_ACCENT_COLOR,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
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
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 80,
    backgroundColor: SURFACE,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: SURFACE_2,
  },

  permissionText: {
    color: MUTED,
    fontSize: 14,
    textAlign: "center",
  },
});