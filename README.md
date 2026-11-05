# Tonavence

Tonavence is a guitar practice companion built with React Native and Expo. The goal is to bring together the tools guitarists regularly use to practice, improve their technique, and develop their musical ear in one place.

The app is currently under active development, with features and exercises being added as the project evolves.

## Features

### Guitar Tuner

A real-time tuner that uses the device's microphone to detect the pitch of a played note.

- Detects the frequency of incoming audio
- Identifies the closest musical note
- Displays how sharp or flat a note is relative to its target frequency
- Adjustable reference pitch:
  - Default: **A4 = 440 Hz**
  - Range: **432–452 Hz**
- Optional octave display
- Microphone permission handling
- Real-time audio analysis

The tuner currently supports single-note pitch detection. Polyphonic tuning (detecting multiple strings simultaneously) is a possible future addition.

### Metronome

A customizable metronome for practicing rhythm and keeping time.

- Adjustable tempo (BPM)
- Default tempo: **100 BPM**
- Tempo range up to **300 BPM**
- Supported time signatures:
  - 2/4
  - 3/4
  - 4/4
  - 6/8
  - 8/8
- Tap tempo
- Visual beat indicator
- Custom audio clicks
- Distinct visual indication for the first beat
- Tempo training mode with a configurable maximum BPM

### Practice Exercises

A dedicated section for exercises to help develop different aspects of guitar playing.

Current and planned exercise categories include:

- Technique and warm-ups
- Speed and accuracy
- Chords and chord progressions
- Scales
- Rhythm
- Ear training

The exercise library is still being developed.

## Tech Stack

- **React Native** – Mobile application framework
- **Expo SDK 57** – Development and build tooling
- **Expo Router** – File-based navigation
- **TypeScript** – Application logic and type safety
- **React 19**
- **React Native 0.86**
- **react-native-audio-api** – Audio processing and sound generation
- **expo-audio** – Audio functionality
- **Expo Asset** – Asset management
- **React Native Community Slider** – UI sliders
- **@expo/vector-icons** – Icons

## Getting Started

### Prerequisites

Before running the project, make sure you have:

- [Node.js](https://nodejs.org/) installed
- npm installed
- [Expo CLI](https://docs.expo.dev/more/expo-cli/) (available through `npx`)
- An Android or iOS device
- A development build of Tonavence installed on your device

**Note:** Tonavence uses native audio functionality, so Expo Go is not sufficient. You need to run the app using an Expo development build.

### 1. Clone the repository

```bash
git clone https://github.com/alphabot54/Tonavence.git
cd Tonavence
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npx expo start --dev-client
```

Make sure your phone has the Tonavence development build installed and is connected to the same network as your computer (or use the appropriate tunnel/network configuration).

Once the server starts, open Tonavence on your device to connect to the development server.

## Building the App

Tonavence uses **EAS Build** to create installable Android and iOS builds.

### 1. Install EAS CLI

```bash
npm install -g eas-cli
```

### 2. Log in to Expo

```bash
eas login
```

### 3. Configure the project

If the project has not already been configured for EAS:

```bash
eas build:configure
```

### 4. Build for Android

To generate an installable Android development build:

```bash
eas build --profile development --platform android
```

To generate a production build:

```bash
eas build --profile production --platform android
```

For an installable APK rather than an Android App Bundle, make sure your `eas.json` production or preview profile has the appropriate Android build configuration.

### 5. Download and install the build

Once the build finishes:

1. Open the build URL provided by EAS in your terminal.
2. Open the build details page.
3. Download the generated APK (if the build profile produces an APK).
4. Transfer the APK to your Android device if necessary.
5. Open the APK on your device and follow the installation instructions.

You can also view your previous builds through the [Expo EAS dashboard](https://expo.dev/).

For iOS, EAS can generate builds as well, but installing them requires an appropriate distribution method, such as TestFlight or an ad hoc development build.

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
```

## Future Improvements

Some ideas for future development include:

- Polyphonic guitar tuning
- More ear-training exercises
- Additional chord and scale exercises
- Customizable practice routines
- Progress tracking and statistics
- More metronome sounds and customization options

## License

This project is currently under development. License information will be added once finalized.
