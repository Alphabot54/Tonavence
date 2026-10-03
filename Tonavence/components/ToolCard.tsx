import { Ionicons } from "@expo/vector-icons";
import { Pressable, View, Text, StyleSheet, Dimensions } from "react-native";

const DEFAULT_ACCENT_COLOR = "#4DD0E1";
const SURFACE = "#171A1F";
const SURFACE_2 = "#20242A";
const TEXT = "#F2F4F7";
const MUTED = "#8D96A3";
const POLYGON_GREY = "#69717D";

const { width } = Dimensions.get("window");

type ToolCardProps = {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  wide?: boolean;
  accent?: boolean;
  onPress: () => void;
};

export default function ToolCard({
  title,
  description,
  icon,
  wide,
  accent,
  onPress,
}: ToolCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolCard,
        wide && styles.toolCardWide,
        pressed && styles.toolCardPressed,
      ]}
    >

      {/* Polygon corner decoration */}
      <View style={styles.cardPolygon}>
        <View style={styles.cardPolygonInner} />
      </View>

      {/* Icon */}
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={25}
          color={DEFAULT_ACCENT_COLOR}
        />
      </View>

      <View style={styles.cardTextContainer}>
        <Text style={styles.toolTitle}>
          {title}
        </Text>

        {description && (
          <Text style={styles.toolDescription}>
            {description}
          </Text>
        )}
      </View>

      {/* Arrow */}
      <View style={styles.arrowContainer}>
        <Ionicons
          name="arrow-forward"
          size={18}
          color={accent ? DEFAULT_ACCENT_COLOR : TEXT}
        />
      </View>

    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolCard: {
    width: (width - 56) / 2,
    height: 160,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: SURFACE_2,
    borderRadius: 16,
    padding: 16,
    overflow: "hidden",
  },

  toolCardWide: {
    width: "100%",
    height: 140,
  },

  toolCardPressed: {
    backgroundColor: SURFACE_2,
    borderColor: DEFAULT_ACCENT_COLOR,
    transform: [{ scale: 0.98 }],
  },

  /* Card polygon */

  cardPolygon: {
    position: "absolute",
    width: 75,
    height: 75,
    right: -35,
    top: -35,
    borderWidth: 1,
    borderColor: POLYGON_GREY,
    opacity: 0.25,
    transform: [{ rotate: "45deg" }],
  },

  cardPolygonInner: {
    position: "absolute",
    width: 38,
    height: 38,
    top: 18,
    left: 18,
    borderWidth: 1,
    borderColor: DEFAULT_ACCENT_COLOR,
  },

  /* Icon */

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 13,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTextContainer: {
    marginTop: 12,
  },

  toolTitle: {
    color: TEXT,
    fontSize: 17,
    fontWeight: "700",
  },

  toolDescription: {
    color: MUTED,
    fontSize: 11,
    marginTop: 3,
  },

  /* Arrow */

  arrowContainer: {
    position: "absolute",
    right: 15,
    bottom: 15,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: SURFACE_2,
    alignItems: "center",
    justifyContent: "center",
  }
});