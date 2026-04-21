import React from "react";
import { View, Text, Pressable, Share } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import useUserStore from "../state/userStore";
import Svg, { Rect } from "react-native-svg";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "QRCode">;

// Simple QR code pattern component
function QRPattern({ size = 200 }: { size?: number }) {
  const cellSize = size / 25;
  const cells: React.ReactElement[] = [];

  // Generate a decorative pattern that looks like a QR code
  for (let row = 0; row < 25; row++) {
    for (let col = 0; col < 25; col++) {
      // Position finders (3 corners)
      const isTopLeftFinder = row < 7 && col < 7;
      const isTopRightFinder = row < 7 && col >= 18;
      const isBottomLeftFinder = row >= 18 && col < 7;

      // Finder pattern borders
      const isFinderOuter =
        (isTopLeftFinder || isTopRightFinder || isBottomLeftFinder) &&
        (row === 0 || row === 6 || col === 0 || col === 6 ||
         (isTopRightFinder && (col === 18 || col === 24)) ||
         (isBottomLeftFinder && (row === 18 || row === 24)));

      const isFinderInner =
        (isTopLeftFinder && row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
        (isTopRightFinder && row >= 2 && row <= 4 && col >= 20 && col <= 22) ||
        (isBottomLeftFinder && row >= 20 && row <= 22 && col >= 2 && col <= 4);

      // Random data pattern
      const isData = !isTopLeftFinder && !isTopRightFinder && !isBottomLeftFinder &&
                     Math.random() > 0.5;

      if (isFinderOuter || isFinderInner || isData) {
        cells.push(
          <Rect
            key={`${row}-${col}`}
            x={col * cellSize}
            y={row * cellSize}
            width={cellSize}
            height={cellSize}
            fill="#4A1528"
          />
        );
      }
    }
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {cells}
    </Svg>
  );
}

export default function QRCodeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const currentUser = useUserStore((s) => s.currentUser);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `Connect with me on Wishy! My profile: wishy://profile/${currentUser?.id}`,
        title: "Share Wishy Profile",
      });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  return (
    <View className="flex-1 bg-wishy-white">
      <View style={{ paddingTop: insets.top }} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#4A1528" />
          </Pressable>
          <Text className="text-wishy-black font-semibold text-lg">
            My QR Code
          </Text>
          <View className="w-10" />
        </View>

        {/* QR Code Card */}
        <View className="flex-1 items-center justify-center px-8">
          <Animated.View
            entering={FadeInDown.delay(100).duration(600)}
            className="bg-white rounded-3xl p-8 shadow-lg items-center w-full"
          >
            {/* Profile Info */}
            <View className="w-20 h-20 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
              <Ionicons name="person" size={40} color="#8B2252" />
            </View>
            <Text className="text-wishy-black font-bold text-xl">
              {currentUser?.name || "Your Name"}
            </Text>
            <Text className="text-wishy-gray text-sm mt-1 capitalize">
              {currentUser?.role === "both" ? "Wisher & Wished" : currentUser?.role || "Member"}
            </Text>

            {/* QR Code */}
            <View className="my-8 p-4 bg-white rounded-2xl border-2 border-wishy-paleBlush">
              <QRPattern size={200} />
            </View>

            {/* Instructions */}
            <Text className="text-wishy-gray text-center text-sm">
              Have someone scan this code to connect with you on Wishy
            </Text>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(600)}
            className="w-full mt-8 space-y-3"
          >
            <Pressable
              onPress={handleShare}
              className="bg-wishy-black py-4 rounded-2xl flex-row items-center justify-center active:opacity-90"
            >
              <Ionicons name="share-outline" size={22} color="#FFF8F0" />
              <Text className="text-wishy-white font-semibold text-lg ml-2">
                Share Profile
              </Text>
            </Pressable>

            <View className="bg-wishy-paleBlush/50 rounded-2xl p-5 mt-4">
              <View className="flex-row items-center mb-2">
                <Ionicons name="information-circle" size={20} color="#8B2252" />
                <Text className="text-wishy-black font-semibold ml-2">
                  Magic Wand
                </Text>
              </View>
              <Text className="text-wishy-black text-sm leading-5">
                Want a physical QR code? Order a Wishy Magic Wand - perfect for parties and events!
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
