# Tonavence

Tonavence is a guitar practice companion app built with React Native and Expo. It provides tools for guitarists to improve their playing, including a tuner, metronome, and a collection of practice exercises.

The app is currently under active development with the help of my good friend Chat and professor Claude.

## Features

### 🎸 Guitar Tuner

A real-time guitar tuner using the device microphone.

- Detects the pitch of a played note
- Displays the detected note
- Shows tuning accuracy relative to the target frequency
- Adjustable reference pitch
  - Default: **A4 = 440 Hz**
  - Adjustable from **432–452 Hz**
- Octave display
- Microphone permission handling
- Real-time audio analysis

> The tuner is currently focused on single-note pitch detection. Polyphonic tuning for multiple strings at once may be added in the future.

### 🥁 Metronome

A customizable metronome for practicing rhythm and timing.

- Adjustable BPM
- Default: **100 BPM**
- BPM range up to **300**
- Time signatures:
  - 2/4
  - 3/4
  - 4/4
  - 6/8
  - 8/8
- Tap tempo
- Visual beat indicator
- Polygon-based visual representation
- Training mode with configurable maximum BPM

### 🎯 Exercises

A dedicated section for guitar practice exercises.

Planned exercises include areas such as:

- Technique
- Warm-ups
- Speed
- Chords
- Scales
- Rhythm
- Ear training

The exercise library is still being expanded.

## Tech Stack

- **React Native**
- **Expo SDK 57**
- **Expo Router**
- **TypeScript**
- **JavaScript**
- **React 19**
- **React Native 0.86**
- **expo-audio**
- **expo-stream-audio**
- **Expo Asset**
- **React Native Community Slider**
- **@expo/vector-icons**

## Project Structure

```text
Tonavence/
├── app/
│   ├── index.tsx
│   ├── tuner.tsx
│   ├── metronome.tsx
│   └── exercises.tsx
│
├── assets/
│   ├── DownClick.m4a
│   ├── UpClick.m4a
│   └── icon.png
│
├── components/
│   ├── Tuner/
│   └── ...
│
├── utils/
│   └── ...
│
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
└── README.md