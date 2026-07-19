import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

const C = {
  orange: "#F54E25",
  orangeLight: "#FF6A3D",
  orangeDark: "#E8441A",
  navy: "#1A2B4A",
  muted: "#64748B",
};

const STEPS = [
  { key: "email", label: "Email", icon: "mail-outline" as const },
  { key: "verify", label: "Verify", icon: "keypad-outline" as const },
  { key: "reset", label: "Reset", icon: "lock-open-outline" as const },
];

type Props = {
  activeIndex: number;
};

export function RecoveryStepBar({ activeIndex }: Props) {
  return (
    <View style={styles.bar}>
      {STEPS.map((step, index) => {
        const active = index === activeIndex;
        const done = index < activeIndex;
        const isLast = index === STEPS.length - 1;

        const connectorDone = activeIndex > index;
        const connectorActive = activeIndex === index;

        return (
          <React.Fragment key={step.key}>
            <View style={styles.stepCol}>
              <View style={styles.dotStack}>
                {active ? <View style={styles.activeRing} /> : null}
                {done ? (
                  <View style={[styles.dot, styles.dotDone]}>
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  </View>
                ) : active ? (
                  <LinearGradient
                    colors={[C.orangeLight, C.orange, C.orangeDark]}
                    style={styles.dot}
                  >
                    <Ionicons name={step.icon} size={13} color="#fff" />
                  </LinearGradient>
                ) : (
                  <View style={[styles.dot, styles.dotIdle]}>
                    <Ionicons name={step.icon} size={13} color={C.muted} />
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  active && styles.labelActive,
                  done && styles.labelDone,
                ]}
                numberOfLines={1}
              >
                {step.label}
              </Text>
            </View>

            {!isLast ? (
              <View style={styles.connector}>
                <View style={styles.connectorTrack} />
                <View
                  style={[
                    styles.connectorFill,
                    connectorDone && styles.connectorFillDone,
                    connectorActive && styles.connectorFillActive,
                  ]}
                />
              </View>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  stepCol: {
    width: 52,
    alignItems: "center",
  },
  dotStack: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  activeRing: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "rgba(245, 78, 37, 0.22)",
    backgroundColor: "rgba(245, 78, 37, 0.07)",
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dotIdle: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  dotDone: {
    backgroundColor: "#16A34A",
    borderWidth: 1.5,
    borderColor: "#16A34A",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    color: C.muted,
    textAlign: "center",
  },
  labelActive: {
    color: C.navy,
    fontWeight: "800",
  },
  labelDone: {
    color: "#166534",
    fontWeight: "700",
  },
  connector: {
    flex: 1,
    height: 3,
    marginTop: 14,
    marginHorizontal: 2,
    position: "relative",
    justifyContent: "center",
  },
  connectorTrack: {
    height: 2,
    borderRadius: 1,
    backgroundColor: "#E2E8F0",
  },
  connectorFill: {
    position: "absolute",
    left: 0,
    height: 2,
    width: "0%",
    borderRadius: 1,
    backgroundColor: C.orange,
  },
  connectorFillDone: {
    width: "100%",
    backgroundColor: "#22C55E",
  },
  connectorFillActive: {
    width: "42%",
    backgroundColor: C.orange,
  },
});
