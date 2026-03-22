import React, { useState, useRef } from "react";
import { View, Text, StyleSheet, FlatList, Image, 
  Dimensions, TouchableOpacity, ImageBackground, Animated,
  SafeAreaView, Platform, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

const SLIDES = [
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
  const router = useRouter();

  const handleComplete = async () => {
    await AsyncStorage.setItem("hasOpened", "true");
    router.replace("/login");
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.slide}>
      <ImageBackground source={item.bg} style={styles.background} resizeMode="cover">

        <View style={styles.logoContainer}>
          <Image 
            source={require("../assets/images/BOHLogo.png")} 
            style={styles.logo} 
            resizeMode="contain" 
          />
        </View>

        <View style={styles.bottomContainer}>
          {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
          
          {item.showButton && (
            <TouchableOpacity 
               activeOpacity={0.8} 
               style={styles.button} 
               onPress={handleComplete}
            >
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          )}
        </View>
      </ImageBackground>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      <FlatList
        data={SLIDES}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />

      <View style={styles.pagination}>
        {SLIDES.map((_, i) => {
          const opacity = scrollX.interpolate({
            inputRange: [(i - 1) * width, i * width, (i + 1) * width],
            outputRange: [0.3, 1, 0.3],
            extrapolate: 'clamp',
          });
          return <Animated.View key={i} style={[styles.dot, { opacity }]} />;
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#fff' 
  },
  slide: { 
    width: width, 
    height: height 
  },
  background: { 
    width: width,
    height: height,
    justifyContent: "center", 
    alignItems: "center",
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? -300 : -80,
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight || 0,
  },
  logo: { 
    width: width * 0.75, 
    height: 150 
  },
  bottomContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 120 : 100,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    color: "#000000", 
    lineHeight: 28,
  },
  button: {
    backgroundColor: "#FF5722",
    paddingVertical: 18,
    width: width * 0.8,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    marginTop: 20,
  },
  buttonText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 18 
  },
  pagination: {
    flexDirection: "row",
    position: "absolute",
    bottom: Platform.OS === 'ios' ? 70 : 50,
    alignSelf: "center",
  },
  dot: {
    height: 10,
    width: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
    marginHorizontal: 6,
  },
});