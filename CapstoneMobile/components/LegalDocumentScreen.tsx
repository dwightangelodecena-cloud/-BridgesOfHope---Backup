import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  SafeAreaView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { LegalDocument } from "../lib/legalDocuments";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SCROLL_END_THRESHOLD = 32;

type Props = {
  document: LegalDocument;
  onConfirmRead: () => void;
  confirmLabel: string;
};

export function LegalDocumentScreen({ document, onConfirmRead, confirmLabel }: Props) {
  const router = useRouter();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - SCROLL_END_THRESHOLD) {
      setScrolledToEnd(true);
    }
  };

  const handleContentSizeChange = (_w: number, h: number) => {
    const maxBody = SCREEN_HEIGHT * 0.45;
    if (h <= maxBody + SCROLL_END_THRESHOLD) setScrolledToEnd(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>

          <Text style={styles.title}>{document.title}</Text>
          <Text style={styles.subtitle}>{document.subtitle}</Text>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleContentSizeChange}
          >
            {document.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
            {document.footer ? (
              <Text style={styles.footerStatement}>{document.footer}</Text>
            ) : null}
            {!scrolledToEnd ? (
              <Text style={styles.scrollHint}>Scroll to the bottom to continue.</Text>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.confirmBtn, !scrolledToEnd && styles.confirmBtnDisabled]}
            disabled={!scrolledToEnd}
            onPress={() => {
              onConfirmRead();
              router.back();
            }}
          >
            <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: {
    width: "100%",
    maxHeight: SCREEN_HEIGHT * 0.88,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    overflow: "hidden",
  },
  closeButton: { position: "absolute", top: 12, right: 16, zIndex: 10 },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
    paddingRight: 32,
  },
  subtitle: { fontSize: 13, color: "#555", textAlign: "center", marginBottom: 12 },
  scrollView: { maxHeight: SCREEN_HEIGHT * 0.52 },
  scrollContent: { paddingBottom: 12 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#000", marginBottom: 4 },
  sectionBody: { fontSize: 12, color: "#444", lineHeight: 18 },
  footerStatement: {
    fontSize: 11,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  scrollHint: {
    textAlign: "center",
    color: "#F54E25",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
  },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: "#F54E25",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "600", textAlign: "center" },
});
