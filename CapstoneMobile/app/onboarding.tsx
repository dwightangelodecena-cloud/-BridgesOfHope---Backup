import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Dimensions,
  Animated,
  StatusBar,
  Pressable,
  type ListRenderItemInfo,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BH } from "../theme/tokens";

const { width, height } = Dimensions.get("window");

type Slide = {
  id: string;
  // Local image asset from require(); typed loosely to match Metro's asset module.
  bg: number;
  title: string;
  showButton: boolean;
};

const SLIDES: Slide[] = [
  {
    id: "1",
    bg: require("../assets/images/landing1.png"),
    title: "Top-notch Addiction\nRehab in the Philippines",
    showButton: false,
  },
  {
    id: "2",
    bg: require("../assets/images/landing2.png"),
    title: "Start your recovery\njourney today",
    showButton: false,
  },
  {
    id: "3",
    bg: require("../assets/images/landing3.png"),
    title: "",
    showButton: true,
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Slide>>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isLast = currentIndex === SLIDES.length - 1;

  const handleComplete = async () => {
    await AsyncStorage.setItem("hasOpened", "true");
    router.replace("/login");
  };

  const handleCtaPress = () => {
    if (isLast) {
      void handleComplete();
      return;
    }
    listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
  };

  const renderItem = ({ item, index }: ListRenderItemInfo<Slide>) => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    // Parallax: background drifts slower than the swipe for depth.
    const bgTranslateX = scrollX.interpolate({
      inputRange,
      outputRange: [width * 0.14, 0, -width * 0.14],
      extrapolate: "clamp",
    });
    // Content rises + fades as the slide settles into view.
    const contentOpacity = scrollX.interpolate({
      inputRange: [(index - 0.55) * width, index * width, (index + 0.55) * width],
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    });
    const contentTranslateY = scrollX.interpolate({
      inputRange,
      outputRange: [48, 0, 48],
      extrapolate: "clamp",
    });
    const logoOpacity = scrollX.interpolate({
      inputRange: [(index - 0.7) * width, index * width, (index + 0.7) * width],
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    });
    const logoScale = scrollX.interpolate({
      inputRange,
      outputRange: [0.86, 1, 0.86],
      extrapolate: "clamp",
    });

    return (
      <View style={styles.slide}>
        <Animated.Image
          source={item.bg}
          style={[styles.bgImage, { transform: [{ translateX: bgTranslateX }, { scale: 1.14 }] }]}
          resizeMode="cover"
        />
        {/* Cinematic base wash — lifts logo/title/controls off any photo. */}
        <LinearGradient
          colors={["transparent", "rgba(248,250,255,0.42)", "rgba(248,250,255,0.9)"]}
          locations={[0.3, 0.62, 1]}
          style={styles.scrim}
          pointerEvents="none"
        />

        <Animated.View
          style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          pointerEvents="none"
        >
          <View style={styles.logoHalo}>
            <Image
              source={require("../assets/images/kalingalogo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.slideCopy,
            { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] },
          ]}
          pointerEvents="none"
        >
          <LinearGradient
            colors={[BH.brandLight, BH.brand]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.accentBar}
          />
          {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
        </Animated.View>
      </View>
    );
  };

  const skipOpacity = scrollX.interpolate({
    inputRange: [(SLIDES.length - 2) * width, (SLIDES.length - 1) * width],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: false,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      {/* Fixed controls layer — sits above the slides, lets swipes pass through. */}
      <View style={styles.overlay} pointerEvents="box-none">
        <Animated.View
          style={[styles.skipWrap, { top: insets.top + 10, opacity: skipOpacity }]}
          pointerEvents={isLast ? "none" : "auto"}
        >
          <Pressable
            onPress={handleComplete}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            hitSlop={8}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        </Animated.View>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 26 }]} pointerEvents="box-none">
          <View style={styles.pagination}>
            {SLIDES.map((_, i) => {
              const dotWidth = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [8, 26, 8],
                extrapolate: "clamp",
              });
              const dotColor = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: ["rgba(27,37,89,0.22)", BH.brand, "rgba(27,37,89,0.22)"],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={i}
                  style={[styles.dot, { width: dotWidth, backgroundColor: dotColor }]}
                />
              );
            })}
          </View>

          <Pressable
            onPress={handleCtaPress}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Get started" : "Next"}
            style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
          >
            <LinearGradient
              colors={[BH.brandLight, BH.brand]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>{isLast ? "Get Started" : "Next"}</Text>
              <Ionicons
                name={isLast ? "arrow-forward" : "chevron-forward"}
                size={isLast ? 20 : 18}
                color={BH.brandContrast}
              />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BH.surface2,
  },
  slide: {
    width,
    height,
    overflow: "hidden",
    backgroundColor: BH.surface2,
  },
  bgImage: {
    position: "absolute",
    width,
    height,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: height * 0.16,
  },
  logoHalo: {
    paddingVertical: 22,
    paddingHorizontal: 30,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.55)",
    shadowColor: BH.brand,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 6,
  },
  logo: {
    width: width * 0.66,
    height: 132,
  },
  slideCopy: {
    position: "absolute",
    bottom: height * 0.22,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  accentBar: {
    width: 52,
    height: 5,
    borderRadius: 3,
    marginBottom: 18,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    color: BH.slate900,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  skipWrap: {
    position: "absolute",
    right: 18,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.68)",
    borderWidth: 1,
    borderColor: "rgba(27,37,89,0.08)",
  },
  skipText: {
    fontSize: 13,
    fontWeight: "800",
    color: BH.navy,
    letterSpacing: 0.2,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 22,
  },
  dot: {
    height: 8,
    borderRadius: 999,
  },
  ctaWrap: {
    width: "100%",
    borderRadius: 18,
    shadowColor: BH.brand,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 8,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.95,
  },
  cta: {
    height: 58,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaText: {
    color: BH.brandContrast,
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.2,
  },
});
