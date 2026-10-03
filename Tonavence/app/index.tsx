import {
  View,
  Text,
  StyleSheet,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import ToolCard from "../components/ToolCard";

const DEFAULT_ACCENT_COLOR = "#4DD0E1";

const BACKGROUND = "#0D0F12";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";
const POLYGON_GREY = "#69717D";

export default function HomeScreen() {

  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.container}>

          {/* Decorative polygons */}
          <View style={styles.backgroundPolygon1} />
          <View style={styles.backgroundPolygon2} />
          <View style={styles.backgroundPolygon3} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.logo}>TONAVENCE</Text>
              <Text style={styles.tagline}>
                TOOLS FOR MUSICIANS
              </Text>
            </View>

            <View style={styles.headerPolygon}>
              <View style={styles.headerPolygonInner} />
            </View>
          </View>

          {/* Main Hero */}
          <View style={styles.hero}>

            {/* Main polygon logo */}
            <View style={styles.logoPolygonOuter}>
              <View style={styles.logoPolygonMiddle}>
                <View style={styles.logoPolygonInner}>
                  <Text style={styles.logoLetter}>T</Text>
                </View>
              </View>
            </View>

            <Text style={styles.welcomeText}>
              PLAY WITH PURPOSE
            </Text>

            <Text style={styles.heroText}>
              Everything you need to tune, practice{"\n"}
              and improve your playing.
            </Text>
          </View>

          {/* Tools */}
          <View style={styles.toolsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>TOOLS</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.toolsGrid}>

              {/* Metronome */}
              <ToolCard
                title="Metronome"
                description="Precision timing"
                icon="pulse-outline"
                accent
                onPress={() => router.push("/metronome")}
              />

              {/* Tuner */}
              <ToolCard
                title="Tuner"
                description="Tune your instrument"
                icon="musical-note-outline"
                accent
                onPress={() => router.push("/tuner")}
              />

              {/* Exercises */}
              <ToolCard
                title="Exercises"
                description="Build your technique"
                icon="fitness-outline"
                wide
                accent
                onPress={() => router.push("/exercise")}
              />

            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <View style={styles.footerPolygon}>
              <View style={styles.footerPolygonInner} />
            </View>

            <Text style={styles.footerText}>
              TONAVENCE
            </Text>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
    paddingHorizontal: 22,
    overflow: "hidden",
  },

  /* ---------------------------------------------------------------------- */
  /* Background polygons                                                    */
  /* ---------------------------------------------------------------------- */

  backgroundPolygon1: {
    position: "absolute",
    width: 190,
    height: 190,
    borderWidth: 1,
    borderColor: POLYGON_GREY,
    opacity: 0.08,
    right: -100,
    top: 100,
    transform: [{ rotate: "45deg" }],
  },

  backgroundPolygon2: {
    position: "absolute",
    width: 130,
    height: 130,
    borderWidth: 1,
    borderColor: DEFAULT_ACCENT_COLOR,
    opacity: 0.05,
    left: -75,
    top: 330,
    transform: [{ rotate: "45deg" }],
  },

  backgroundPolygon3: {
    position: "absolute",
    width: 220,
    height: 220,
    borderWidth: 1,
    borderColor: POLYGON_GREY,
    opacity: 0.05,
    right: -140,
    bottom: -50,
    transform: [{ rotate: "45deg" }],
  },

  /* ---------------------------------------------------------------------- */
  /* Header                                                                 */
  /* ---------------------------------------------------------------------- */

  header: {
    height: 65,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  logo: {
    color: TEXT,
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: 4,
  },

  tagline: {
    color: MUTED,
    fontSize: 8,
    fontWeight: "600",
    letterSpacing: 2,
    marginTop: 4,
  },

  headerPolygon: {
    width: 30,
    height: 30,
    borderWidth: 1,
    borderColor: POLYGON_GREY,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
  },

  headerPolygonInner: {
    width: 13,
    height: 13,
    backgroundColor: DEFAULT_ACCENT_COLOR,
  },

  /* ---------------------------------------------------------------------- */
  /* Hero                                                                   */
  /* ---------------------------------------------------------------------- */

  hero: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    paddingBottom: 25,
  },

  logoPolygonOuter: {
    width: 110,
    height: 110,
    backgroundColor: POLYGON_GREY,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },

  logoPolygonMiddle: {
    width: 88,
    height: 88,
    backgroundColor: BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
  },

  logoPolygonInner: {
    width: 62,
    height: 62,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
  },

  logoLetter: {
    color: DEFAULT_ACCENT_COLOR,
    fontSize: 34,
    fontWeight: "800",
    transform: [{ rotate: "-45deg" }],
  },

  welcomeText: {
    color: TEXT,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 27,
  },

  heroText: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 7,
  },

  /* ---------------------------------------------------------------------- */
  /* Tools                                                                  */
  /* ---------------------------------------------------------------------- */

  toolsSection: {
    flex: 1,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  sectionTitle: {
    color: MUTED,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },

  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: SURFACE_2,
    marginLeft: 12,
  },

  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },

  /* ---------------------------------------------------------------------- */
  /* Footer                                                                 */
  /* ---------------------------------------------------------------------- */

  footer: {
    height: 45,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },

  footerPolygon: {
    width: 10,
    height: 10,
    backgroundColor: DEFAULT_ACCENT_COLOR,
    transform: [{ rotate: "45deg" }],
  },

  footerPolygonInner: {
    width: 4,
    height: 4,
    backgroundColor: BACKGROUND,
    margin: 3,
  },

  footerText: {
    color: POLYGON_GREY,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 2,
  },
});