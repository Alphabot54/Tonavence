import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, type AudioSource } from "expo-audio";

const DOWNBEAT_SOUND: AudioSource = require("../assets/sounds/Prec_MetronomeQuartz_lo.wav");
const UPBEAT_SOUND: AudioSource = require("../assets/sounds/Perc_MetronomeQuartz_hi.wav");

const MIN_BPM = 20;
const MAX_BPM = 300;
const MIN_NUMERATOR = 2;
const MAX_NUMERATOR = 12;
const DENOMINATORS = [2, 3, 4, 6, 8] as const;

type Denominator = (typeof DENOMINATORS)[number];
type TimeSignature = {
  numerator: number;
  denominator: Denominator;
};

type Popup = "bpm" | "signature" | "training" | null;

type TrainingSettings = {
  increaseBy: number;
  intervalValue: number;
  intervalUnit: "seconds" | "beats";
  maxBpm: number;
};

type MetronomeProps = {
  initialBpm?: number;
  initialTimeSignature?: string;
  initialAccentPattern?: boolean[];
  accentColor?: string;
};

type Point = {
  x: number;
  y: number;
};

const DEFAULT_ACCENT_COLOR = "#4DD0E1";
const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";
const POLYGON_GREY = "#69717D";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseTimeSignature(value: string): TimeSignature {
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);

  if (!match) {
    return { numerator: 4, denominator: 4 };
  }

  const numerator = clamp(
    Number.parseInt(match[1], 10) || 4,
    MIN_NUMERATOR,
    MAX_NUMERATOR
  );

  const denominatorNumber = Number.parseInt(match[2], 10);
  const denominator = DENOMINATORS.includes(
    denominatorNumber as Denominator
  )
    ? (denominatorNumber as Denominator)
    : 4;

  return { numerator, denominator };
}

function getPolygonPoints(
  sides: number,
  centerX: number,
  centerY: number,
  radius: number
): Point[] {
  // Start at the top and rotate clockwise.
  const startAngle = -Math.PI / 2;

  if (sides === 2) {
    return [0, 1].map((i) => {
      const angle = startAngle + i * Math.PI;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  }

  return Array.from({ length: sides }, (_, i) => {
    const angle = startAngle + (i * 2 * Math.PI) / sides;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
}

function pointOnSegment(a: Point, b: Point, progress: number): Point {
  return {
    x: a.x + (b.x - a.x) * progress,
    y: a.y + (b.y - a.y) * progress,
  };
}

function polygonPath(points: Point[]) {
  if (points.length === 0) return "";

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  return (
    points
      .map((point, index) =>
        index === 0
          ? `M ${point.x} ${point.y}`
          : `L ${point.x} ${point.y}`
      )
      .join(" ") + " Z"
  );
}

/**
 * SVG is intentionally implemented with react-native-svg.
 * If it is not already in the Expo project:
 *
 *   npx expo install react-native-svg
 */
export default function PolygonMetronome({
  initialBpm = 100,
  initialTimeSignature = "4/4",
  initialAccentPattern,
  accentColor = DEFAULT_ACCENT_COLOR,
}: MetronomeProps) {
  const initialSignature = useMemo(
    () => parseTimeSignature(initialTimeSignature),
    [initialTimeSignature]
  );

  const [bpm, setBpm] = useState(() => clamp(initialBpm, MIN_BPM, MAX_BPM));
  const [timeSignature, setTimeSignature] =
    useState<TimeSignature>(initialSignature);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [beatProgress, setBeatProgress] = useState(0);
  const [accentPattern, setAccentPattern] = useState<boolean[]>(
    () =>
      initialAccentPattern?.length === initialSignature.numerator
        ? initialAccentPattern
        : Array(initialSignature.numerator).fill(true)
  );

  const [popup, setPopup] = useState<Popup>(null);
  const [bpmInput, setBpmInput] = useState(String(bpm));
  const [numeratorInput, setNumeratorInput] = useState(
    String(initialSignature.numerator)
  );
  const [denominatorInput, setDenominatorInput] = useState(
    String(initialSignature.denominator)
  );

  const [training, setTraining] = useState<TrainingSettings>({
    increaseBy: 5,
    intervalValue: 30,
    intervalUnit: "seconds",
    maxBpm: Math.min(160, MAX_BPM),
  });

  const [trainingActive, setTrainingActive] = useState(false);

  const lastTapTimes = useRef<number[]>([]);
  // Audio timing is deliberately independent from the animation loop.
  // requestAnimationFrame is only used to draw the moving dot.
  const nextBeatTime = useRef<number | null>(null);
  const lastBeatTime = useRef<number | null>(null);
  const currentBeatRef = useRef(0);
  const schedulerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrame = useRef<number | null>(null);
  const trainingBeatCounter = useRef(0);

  // Dedicated players keep downbeats and upbeats independent.
  const downbeatPlayer = useAudioPlayer(DOWNBEAT_SOUND);
  const upbeatPlayer = useAudioPlayer(UPBEAT_SOUND);

  const polygonSize = Math.min(Dimensions.get("window").width * 0.68, 310);
  const radius = polygonSize / 2;

  const playBeatSound = useCallback(
    (isDownbeat: boolean) => {
      const player = isDownbeat ? downbeatPlayer : upbeatPlayer;
      const source = isDownbeat ? DOWNBEAT_SOUND : UPBEAT_SOUND;

      // Leave this silent until the corresponding MP3 source is supplied.
      if (!source) return;

      player.seekTo(0);
      player.play();
    },
    [downbeatPlayer, upbeatPlayer]
  );

  const beatIntervalMs = useMemo(() => 60000 / bpm, [bpm]);

  const stopAnimation = useCallback(() => {
    if (animationFrame.current !== null) {
      cancelAnimationFrame(animationFrame.current);
      animationFrame.current = null;
    }
  }, []);

  const triggerBeat = useCallback(
    (beatIndex: number) => {
      const beat = beatIndex % timeSignature.numerator;
      setCurrentBeat(beat);
      setBeatProgress(0);

      const isUpbeat = accentPattern[beat] ?? true;
      playBeatSound(!isUpbeat);

      // Beat-based training advances only when an actual metronome beat fires.
      if (trainingActive && training.intervalUnit === "beats") {
        trainingBeatCounter.current += 1;

        if (trainingBeatCounter.current >= training.intervalValue) {
          trainingBeatCounter.current = 0;
          setBpm((previousBpm) =>
            Math.min(training.maxBpm, previousBpm + training.increaseBy)
          );
        }
      }
    },
    [
      accentPattern,
      playBeatSound,
      timeSignature.numerator,
      trainingActive,
      training.intervalUnit,
      training.intervalValue,
      training.maxBpm,
      training.increaseBy,
    ]
  );

  const startMetronome = useCallback(() => {
    stopAnimation();

    // Always restart from beat 1.
    const startTime = performance.now();
    currentBeatRef.current = 0;
    lastBeatTime.current = startTime;
    nextBeatTime.current = startTime + beatIntervalMs;

    setCurrentBeat(0);
    setBeatProgress(0);
    setIsPlaying(true);

    // Beat 1 is fired immediately, then future beats are handled by the
    // look-ahead scheduler below rather than by requestAnimationFrame.
    triggerBeat(0);
  }, [beatIntervalMs, stopAnimation, triggerBeat]);

  const stopMetronome = useCallback(() => {
    setIsPlaying(false);
    stopAnimation();

    if (schedulerInterval.current !== null) {
      clearInterval(schedulerInterval.current);
      schedulerInterval.current = null;
    }

    nextBeatTime.current = null;
    lastBeatTime.current = null;
    setBeatProgress(0);
    setCurrentBeat(0);
    currentBeatRef.current = 0;
  }, [stopAnimation]);

  // Audio scheduler: checks frequently and fires beats from a monotonic clock.
  // It is intentionally separate from the visual requestAnimationFrame loop.
  useEffect(() => {
    if (!isPlaying) return;

    const scheduleDueBeats = () => {
      const now = performance.now();
      const interval = 60000 / bpm;

      if (nextBeatTime.current === null) {
        nextBeatTime.current = now + interval;
      }

      // Catch up if the JS thread was briefly delayed. We advance the beat
      // clock from the scheduled time instead of "now", avoiding accumulated
      // drift.
      while (nextBeatTime.current !== null && now >= nextBeatTime.current) {
        const scheduledTime : number = nextBeatTime.current;
        const nextBeat =
          (currentBeatRef.current + 1) % timeSignature.numerator;

        currentBeatRef.current = nextBeat;
        lastBeatTime.current = scheduledTime;
        nextBeatTime.current = scheduledTime + interval;

        triggerBeat(nextBeat);
      }
    };

    // A short look-ahead poll keeps audio dispatch independent of rendering.
    schedulerInterval.current = setInterval(scheduleDueBeats, 15);
    scheduleDueBeats();

    return () => {
      if (schedulerInterval.current !== null) {
        clearInterval(schedulerInterval.current);
        schedulerInterval.current = null;
      }
    };
  }, [bpm, isPlaying, timeSignature.numerator, triggerBeat]);

  // Visual animation only. It never triggers audio.
  useEffect(() => {
    if (!isPlaying) return;

    let frame: number;

    const animate = (now: number) => {
      const beatStart = lastBeatTime.current;
      const interval = 60000 / bpm;

      if (beatStart !== null) {
        setBeatProgress(clamp((now - beatStart) / interval, 0, 1));
      }

      frame = requestAnimationFrame(animate);
      animationFrame.current = frame;
    };

    frame = requestAnimationFrame(animate);
    animationFrame.current = frame;

    return () => {
      cancelAnimationFrame(frame);
      if (animationFrame.current === frame) {
        animationFrame.current = null;
      }
    };
  }, [bpm, isPlaying]);

  // If BPM changes while playing, keep the current beat and retime the next
  // beat from the most recent beat rather than restarting the metronome.
  useEffect(() => {
    if (!isPlaying || lastBeatTime.current === null) return;

    const interval = 60000 / bpm;
    const next = lastBeatTime.current + interval;

    if (nextBeatTime.current !== null) {
      nextBeatTime.current = next;
    }
  }, [bpm, isPlaying]);

  // Time-based BPM training. Beat-based training is handled directly
  // when triggerBeat() fires, so it follows the actual metronome clock.
  useEffect(() => {
    if (
      !trainingActive ||
      !isPlaying ||
      training.intervalUnit !== "seconds"
    ) {
      return;
    }

    let elapsed = 0;

    const interval = setInterval(() => {
      elapsed += 1;

      if (elapsed >= training.intervalValue) {
        elapsed = 0;
        setBpm((previousBpm) =>
          Math.min(training.maxBpm, previousBpm + training.increaseBy)
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isPlaying,
    trainingActive,
    training.intervalUnit,
    training.intervalValue,
    training.maxBpm,
    training.increaseBy,
  ]);

  useEffect(() => {
    if (trainingActive && bpm >= training.maxBpm) {
      setTrainingActive(false);
    }
  }, [bpm, training.maxBpm, trainingActive]);

  // Keep the accent pattern aligned with the selected numerator.
  useEffect(() => {
    setAccentPattern((previous) =>
      Array.from(
        { length: timeSignature.numerator },
        (_, index) => previous[index] ?? true
      )
    );
    setCurrentBeat(0);
  }, [timeSignature.numerator]);

  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  const toggleBeatAccent = (beatIndex: number) => {
    setAccentPattern((previous) =>
      previous.map((value, index) =>
        index === beatIndex ? !value : value
      )
    );
  };

  const changeBpm = (delta: number) => {
    setBpm((previous) => {
      const next = clamp(previous + delta, MIN_BPM, MAX_BPM);
      setBpmInput(String(next));
      return next;
    });
  };

  const applyBpmInput = () => {
    const parsed = Number.parseInt(bpmInput, 10);

    if (!Number.isNaN(parsed)) {
      const next = clamp(parsed, MIN_BPM, MAX_BPM);
      setBpm(next);
      setBpmInput(String(next));
    } else {
      setBpmInput(String(bpm));
    }

    setPopup(null);
  };

  const applySignature = () => {
    const nextSignature = parseTimeSignature(
      `${numeratorInput}/${denominatorInput}`
    );

    setTimeSignature(nextSignature);
    setNumeratorInput(String(nextSignature.numerator));
    setDenominatorInput(String(nextSignature.denominator));
    setPopup(null);
  };

  const handleTap = () => {
    const now = Date.now();

    lastTapTimes.current = [
      ...lastTapTimes.current.filter((time) => now - time < 2500),
      now,
    ].slice(-6);

    if (lastTapTimes.current.length < 2) return;

    const intervals = lastTapTimes.current
      .slice(1)
      .map((time, index) => time - lastTapTimes.current[index]);

    const average =
      intervals.reduce((sum, value) => sum + value, 0) /
      intervals.length;

    const tappedBpm = clamp(Math.round(60000 / average), MIN_BPM, MAX_BPM);
    setBpm(tappedBpm);
    setBpmInput(String(tappedBpm));
  };

  const openBpmPopup = () => {
    setBpmInput(String(bpm));
    setPopup("bpm");
  };

  const openSignaturePopup = () => {
    setNumeratorInput(String(timeSignature.numerator));
    setDenominatorInput(String(timeSignature.denominator));
    setPopup("signature");
  };

  const openTrainingPopup = () => {
    setPopup("training");
  };

  const startTraining = () => {
    const increaseBy = clamp(Math.round(training.increaseBy), 1, 100);
    const intervalValue = Math.max(1, Math.round(training.intervalValue));
    const maxBpm = clamp(
      Math.round(training.maxBpm),
      Math.max(MIN_BPM, bpm),
      MAX_BPM
    );

    setTraining({
      ...training,
      maxBpm,
      increaseBy,
      intervalValue,
    });

    trainingBeatCounter.current = 0;
    setTrainingActive(true);
    setPopup(null);

    if (!isPlaying) {
      startMetronome();
    }
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  };

  const polygonLayers = useMemo(
    () =>
      Array.from({ length: 11 }, (_, index) => {
        const sides = index + 2;
        return {
          sides,
          points: getPolygonPoints(sides, radius, radius, radius - 8),
        };
      }),
    [radius]
  );

  const selectedPolygon = polygonLayers.find(
    (polygon) => polygon.sides === timeSignature.numerator
  );

  const currentPoints =
    selectedPolygon?.points ??
    getPolygonPoints(
      timeSignature.numerator,
      radius,
      radius,
      radius - 8
    );

  const getBeatPosition = (beatIndex: number, progress: number) => {
    if (currentPoints.length === 1) return currentPoints[0];

    if (currentPoints.length === 2) {
      const from = currentPoints[beatIndex % 2];
      const to = currentPoints[(beatIndex + 1) % 2];

      return pointOnSegment(from, to, progress);
    }

    const from = currentPoints[beatIndex % currentPoints.length];
    const to =
      currentPoints[(beatIndex + 1) % currentPoints.length];

    return pointOnSegment(from, to, progress);
  };

  const movingBeat = getBeatPosition(currentBeat, beatProgress);

  return (
    <View style={styles.container}>
      {/* Information row */}
      <View style={styles.infoRow}>
        <Pressable
          style={styles.infoItem}
          onPress={openTrainingPopup}
          accessibilityRole="button"
          accessibilityLabel="BPM training"
        >
          <Ionicons
            name="trending-up-outline"
            size={25}
            color={trainingActive ? accentColor : TEXT}
          />
          {trainingActive && (
            <View style={[styles.trainingIndicator, { backgroundColor: accentColor }]} />
          )}
        </Pressable>

        <Pressable
          style={styles.bpmItem}
          onPress={openBpmPopup}
          accessibilityRole="button"
          accessibilityLabel={`BPM ${bpm}`}
        >
          <Text style={styles.bpmValue}>{bpm}</Text>
          <Text style={styles.infoLabel}>BPM</Text>
        </Pressable>

        <Pressable
          style={styles.infoItem}
          onPress={openSignaturePopup}
          accessibilityRole="button"
          accessibilityLabel={`Time signature ${timeSignature.numerator}/${timeSignature.denominator}`}
        >
          <TimeSignatureDisplay
            numerator={timeSignature.numerator}
            denominator={timeSignature.denominator}
            compact
          />
        </Pressable>
      </View>

      {/* Multipolygon */}
      <View style={[styles.metronomeStage, { width: polygonSize, height: polygonSize }]}>
        <View
          style={{
            width: polygonSize,
            height: polygonSize,
            position: "absolute",
          }}
        >
          {/* React Native's built-in views are used for polygon lines so the
              component only needs react-native-svg for the exact geometry below. */}
          <PolygonSvg
            layers={polygonLayers}
            selectedSides={timeSignature.numerator}
            accentColor={accentColor}
            polygonGrey={POLYGON_GREY}
            radius={radius}
          />

          {/* Clickable beat vertices: large = upbeat, small = downbeat */}
          {currentPoints.map((point, index) => {
            const isUpbeat = accentPattern[index] ?? true;
            const isCurrent = index === currentBeat && isPlaying;
            const dotSize = isUpbeat ? 18 : 10;

            return (
              <Pressable
                key={`beat-${index}`}
                onPress={() => toggleBeatAccent(index)}
                hitSlop={10}
                style={[
                  styles.beatButton,
                  {
                    width: dotSize,
                    height: dotSize,
                    borderRadius: dotSize / 2,
                    left: point.x - dotSize / 2,
                    top: point.y - dotSize / 2,
                    backgroundColor: isCurrent
                      ? TEXT
                      : isUpbeat
                        ? accentColor
                        : "#B5BBC4",
                    transform: [{ scale: isCurrent ? 1.25 : 1 }],
                    shadowColor: isCurrent ? TEXT : "transparent",
                    shadowOpacity: isCurrent ? 0.7 : 0,
                    shadowRadius: 8,
                    elevation: isCurrent ? 5 : 0,
                  },
                ]}
              />
            );
          })}

          {/* Animated beat */}
          {isPlaying && (
            <View
              pointerEvents="none"
              style={[
                styles.movingBeat,
                {
                  left: movingBeat.x - 6,
                  top: movingBeat.y - 6,
                  backgroundColor: accentColor,
                },
              ]}
            />
          )}
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <Pressable
          onPress={handlePlayPause}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: accentColor },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={isPlaying ? "stop" : "play"}
            size={24}
            color="#081014"
          />
          <Text style={styles.playButtonText}>
            {isPlaying ? "STOP" : "START"}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleTap}
          style={({ pressed }) => [
            styles.tapButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.tapText}>TAP</Text>
        </Pressable>
      </View>

      {/* BPM popup */}
      <Modal
        visible={popup === "bpm"}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup(null)}
      >
        <PopupBackdrop onClose={() => setPopup(null)}>
          <PopupCard>
            <PopupHeader title="BPM" onClose={() => setPopup(null)} />

            <View style={styles.numberControl}>
              <Pressable
                style={styles.circleButton}
                onPress={() => changeBpm(-1)}
              >
                <Text style={styles.circleButtonText}>−</Text>
              </Pressable>

              <TextInput
                value={bpmInput}
                onChangeText={(value) =>
                  setBpmInput(value.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.bpmInput}
                maxLength={3}
              />

              <Pressable
                style={styles.circleButton}
                onPress={() => changeBpm(1)}
              >
                <Text style={styles.circleButtonText}>+</Text>
              </Pressable>
            </View>

            <Text style={styles.rangeText}>
              {MIN_BPM}–{MAX_BPM} BPM
            </Text>

            <PopupAction label="DONE" onPress={applyBpmInput} />
          </PopupCard>
        </PopupBackdrop>
      </Modal>

      {/* Time signature popup */}
      <Modal
        visible={popup === "signature"}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup(null)}
      >
        <PopupBackdrop onClose={() => setPopup(null)}>
          <PopupCard>
            <PopupHeader
              title="TIME SIGNATURE"
              onClose={() => setPopup(null)}
            />

            <View style={styles.signatureEditor}>
              <TextInput
                value={numeratorInput}
                onChangeText={(value) =>
                  setNumeratorInput(value.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.signaturePartInput}
                maxLength={2}
                onBlur={() => {
                  const parsed = Number.parseInt(numeratorInput, 10);
                  if (!Number.isNaN(parsed)) {
                    setNumeratorInput(
                      String(clamp(parsed, MIN_NUMERATOR, MAX_NUMERATOR))
                    );
                  }
                }}
              />
              <View style={styles.signatureDivider} />
              <TextInput
                value={denominatorInput}
                onChangeText={(value) =>
                  setDenominatorInput(value.replace(/[^0-9]/g, ""))
                }
                keyboardType="number-pad"
                selectTextOnFocus
                style={styles.signaturePartInput}
                maxLength={1}
                onBlur={() => {
                  const parsed = Number.parseInt(denominatorInput, 10);
                  const valid = DENOMINATORS.includes(parsed as Denominator);
                  if (!Number.isNaN(parsed) && valid) {
                    setDenominatorInput(String(parsed));
                  } else {
                    setDenominatorInput(String(timeSignature.denominator));
                  }
                }}
              />
            </View>

            <Text style={styles.helperText}>
              Numerator: 2–12{"\n"}
              Denominator: 2, 3, 4, 6, or 8
            </Text>

            <PopupAction label="APPLY" onPress={applySignature} />
          </PopupCard>
        </PopupBackdrop>
      </Modal>

      {/* Training popup */}
      <Modal
        visible={popup === "training"}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup(null)}
      >
        <PopupBackdrop onClose={() => setPopup(null)}>
          <PopupCard>
            <PopupHeader
              title="BPM TRAINING"
              onClose={() => setPopup(null)}
            />

            <TrainingNumberRow
              label="Start BPM"
              value={bpm}
              min={MIN_BPM}
              max={MAX_BPM}
              onChange={(value) => {
                setBpm(value);
                setBpmInput(String(value));
              }}
            />

            <TrainingNumberRow
              label="Increase by"
              value={training.increaseBy}
              min={1}
              max={100}
              onChange={(value) =>
                setTraining((previous) => ({
                  ...previous,
                  increaseBy: value,
                }))
              }
            />

            <Text style={styles.sectionLabel}>Increase every</Text>

            <View style={styles.trainingModeRow}>
              <TrainingNumberInput
                value={training.intervalValue}
                min={1}
                max={3600}
                onChange={(value) =>
                  setTraining((previous) => ({
                    ...previous,
                    intervalValue: value,
                  }))
                }
              />

              <Pressable
                onPress={() =>
                  setTraining((previous) => ({
                    ...previous,
                    intervalUnit:
                      previous.intervalUnit === "seconds"
                        ? "beats"
                        : "seconds",
                  }))
                }
                style={styles.unitButton}
              >
                <Text style={styles.unitButtonText}>
                  {training.intervalUnit}
                </Text>
                <Ionicons name="swap-vertical" size={16} color={MUTED} />
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Maximum BPM</Text>

            <View style={styles.trainingModeRow}>
              <TrainingNumberInput
                value={training.maxBpm}
                min={MIN_BPM}
                max={MAX_BPM}
                onChange={(value) =>
                  setTraining((previous) => ({
                    ...previous,
                    maxBpm: value,
                  }))
                }
              />
              <Text style={styles.unitText}>20–300 BPM</Text>
            </View>

            {trainingActive && (
              <View style={styles.activeTrainingBox}>
                <View
                  style={[
                    styles.activeDot,
                    { backgroundColor: accentColor },
                  ]}
                />
                <Text style={styles.activeTrainingText}>
                  Training active · {bpm} BPM → {training.maxBpm} BPM
                </Text>
              </View>
            )}

            <PopupAction
              label={trainingActive ? "STOP TRAINING" : "START TRAINING"}
              onPress={() => {
                if (trainingActive) {
                  setTrainingActive(false);
                } else {
                  startTraining();
                }
              }}
            />
          </PopupCard>
        </PopupBackdrop>
      </Modal>
    </View>
  );
}

function PopupBackdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.popupWrapper} onPress={() => {}}>
        {children}
      </Pressable>
    </Pressable>
  );
}

function PopupCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.popupCard}>{children}</View>;
}

function PopupHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <View style={styles.popupHeader}>
      <Text style={styles.popupTitle}>{title}</Text>

      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={24} color={MUTED} />
      </Pressable>
    </View>
  );
}

function PopupAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.popupAction,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.popupActionText}>{label}</Text>
    </Pressable>
  );
}

function TrainingNumberRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <>
      <Text style={styles.sectionLabel}>{label}</Text>
      <TrainingNumberInput
        value={value}
        min={min}
        max={max}
        onChange={onChange}
      />
    </>
  );
}

function TrainingNumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);

    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }

    const committed = clamp(parsed, min, max);
    setDraft(String(committed));
    onChange(committed);
  };

  return (
    <TextInput
      value={draft}
      onChangeText={(value) => setDraft(value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onSubmitEditing={commit}
      keyboardType="number-pad"
      style={styles.smallNumberInput}
      maxLength={4}
    />
  );
}

function TimeSignatureDisplay({
  numerator,
  denominator,
  compact = false,
}: {
  numerator: number;
  denominator: number;
  compact?: boolean;
}) {
  return (
    <View style={[styles.signatureDisplay, compact && styles.signatureDisplayCompact]}>
      <Text style={[styles.signatureDisplayText, compact && styles.signatureDisplayTextCompact]}>
        {numerator}
      </Text>
      <View style={styles.signatureDisplayLine} />
      <Text style={[styles.signatureDisplayText, compact && styles.signatureDisplayTextCompact]}>
        {denominator}
      </Text>
    </View>
  );
}

function PolygonSvg({
  layers,
  selectedSides,
  accentColor,
  polygonGrey,
  radius,
}: {
  layers: { sides: number; points: Point[] }[];
  selectedSides: number;
  accentColor: string;
  polygonGrey: string;
  radius: number;
}) {
  // Kept as a separate component so the main metronome remains readable.
  // react-native-svg is required for the exact multipolygon drawing.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const SvgModule = require("react-native-svg");
  const { Svg, Path } = SvgModule;

  return (
    <Svg
      width={radius * 2}
      height={radius * 2}
      viewBox={`0 0 ${radius * 2} ${radius * 2}`}
    >
      {layers.map(({ sides, points }) => {
        const selected = sides === selectedSides;

        return (
          <Path
            key={`polygon-${sides}`}
            d={polygonPath(points)}
            fill="none"
            stroke={selected ? accentColor : polygonGrey}
            strokeWidth={selected ? 3.2 : 1.15}
            strokeOpacity={selected ? 1 : 0.52}
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: "center",
    paddingHorizontal: 20,
  },

  infoRow: {
    width: "100%",
    maxWidth: 430,
    height: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  infoItem: {
    width: 82,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },

  bpmItem: {
    minWidth: 100,
    alignItems: "center",
    justifyContent: "center",
  },

  bpmValue: {
    color: TEXT,
    fontSize: 28,
    fontWeight: "600",
    letterSpacing: 0.5,
  },

  infoLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginTop: -2,
  },

  signatureDisplay: {
    width: 82,
    alignItems: "center",
    justifyContent: "center",
  },

  signatureDisplayCompact: {
    width: 56,
  },

  signatureDisplayText: {
    color: TEXT,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: "500",
    textAlign: "center",
  },

  signatureDisplayTextCompact: {
    fontSize: 21,
    lineHeight: 21,
  },

  signatureDisplayLine: {
    width: 30,
    height: 2,
    backgroundColor: MUTED,
    marginVertical: 2,
  },

  trainingIndicator: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    bottom: 5,
  },

  metronomeStage: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    marginBottom: 28,
  },

  beatButton: {
    position: "absolute",
    zIndex: 10,
  },

  movingBeat: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    zIndex: 20,
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 6,
  },

  controlsRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingBottom: 50,
  },

  playButton: {
    minWidth: 150,
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  playButtonText: {
    color: "#081014",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  tapButton: {
    height: 54,
    minWidth: 82,
    borderRadius: 14,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: "#303640",
    alignItems: "center",
    justifyContent: "center",
  },

  tapText: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.66)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },

  popupWrapper: {
    width: "100%",
    maxWidth: 390,
  },

  popupCard: {
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2C323A",
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },

  popupHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  popupTitle: {
    color: TEXT,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: SURFACE_2,
  },

  numberControl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },

  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: "#343A43",
    alignItems: "center",
    justifyContent: "center",
  },

  circleButtonText: {
    color: TEXT,
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 30,
  },

  bpmInput: {
    width: 105,
    height: 58,
    color: TEXT,
    backgroundColor: SURFACE_2,
    borderRadius: 12,
    textAlign: "center",
    fontSize: 30,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: "#343A43",
  },

  rangeText: {
    color: MUTED,
    textAlign: "center",
    fontSize: 12,
    marginTop: 10,
  },

  signatureEditor: {
    width: 120,
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: SURFACE_2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#343A43",
    paddingVertical: 6,
    marginBottom: 12,
  },

  signaturePartInput: {
    width: "100%",
    height: 52,
    color: TEXT,
    textAlign: "center",
    fontSize: 30,
    fontWeight: "600",
    padding: 0,
  },

  signatureDivider: {
    width: 74,
    height: 2,
    backgroundColor: MUTED,
  },

  helperText: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 20,
  },

  popupAction: {
    height: 48,
    borderRadius: 12,
    backgroundColor: SURFACE_2,
    borderWidth: 1,
    borderColor: "#343A43",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },

  popupActionText: {
    color: TEXT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
  },

  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 9,
    marginTop: 6,
  },

  trainingValue: {
    width: 105,
    textAlign: "center",
    color: TEXT,
    fontSize: 25,
    fontWeight: "600",
  },

  trainingModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  smallNumberInput: {
    width: 105,
    height: 48,
    color: TEXT,
    backgroundColor: SURFACE_2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#343A43",
    textAlign: "center",
    fontSize: 19,
    fontWeight: "600",
  },

  unitButton: {
    height: 48,
    flex: 1,
    backgroundColor: SURFACE_2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#343A43",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  unitButtonText: {
    color: TEXT,
    fontSize: 14,
    textTransform: "capitalize",
  },

  unitText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  activeTrainingBox: {
    minHeight: 42,
    backgroundColor: "#1A2528",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 10,
  },

  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  activeTrainingText: {
    color: TEXT,
    fontSize: 12,
    flex: 1,
  },
});
