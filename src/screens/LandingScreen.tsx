import React from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import useUserStore from "../state/userStore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LandingScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const currentUser = useUserStore((s) => s.currentUser);

  const handleExpressWish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("CreateWish", { mode: "wishlist" });
  };

  const handleProposeWish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("CreateWish", { mode: "portfolio" });
  };

  const handleExplore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("MainTabs", { screen: "Discovery" });
  };

  const showExpressButton = currentUser?.role === "wished" || currentUser?.role === "both";
  const showProposeButton = currentUser?.role === "wisher" || currentUser?.role === "both";

  return (
    <View
      className="flex-1 bg-white px-6"
      style={{ paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }}
    >
      {/* Branding */}
      <Animated.View
        entering={FadeIn.duration(800)}
        className="items-center mb-12"
      >
        <Image
          source={require("../../assets/wishy-logo.jpeg")}
          style={{ width: 120, height: 120, borderRadius: 60 }}
          contentFit="cover"
        />
        <Text className="text-4xl font-bold text-wishy-black tracking-tight mt-4">
          Wishy
        </Text>
        <Text className="text-base text-wishy-gray mt-2 text-center">
          Crave, Wish, Fulfill…with Wishy
        </Text>
      </Animated.View>

      {/* Action Buttons */}
      <View className="gap-3">
        {showExpressButton && (
          <Animated.View entering={FadeInDown.delay(200).duration(600)}>
            <Pressable
              onPress={handleExpressWish}
              className="bg-wishy-pink rounded-2xl p-5 flex-row items-center active:opacity-90 shadow-sm"
            >
              <View className="w-12 h-12 bg-white/90 rounded-full items-center justify-center mr-4">
                <Ionicons name="heart" size={26} color="#FF8DC7" />
              </View>
              <View className="flex-1">
                <Text className="text-wishy-black font-bold text-lg">
                  Make a Wish
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#000000" />
            </Pressable>
          </Animated.View>
        )}

        {showProposeButton && (
          <Animated.View entering={FadeInDown.delay(400).duration(600)}>
            <Pressable
              onPress={handleProposeWish}
              className="bg-blue-100 rounded-2xl p-5 flex-row items-center active:opacity-90 shadow-sm"
            >
              <View className="w-12 h-12 bg-white/90 rounded-full items-center justify-center mr-4">
                <Ionicons name="gift" size={26} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-blue-900 font-bold text-lg">
                  Offer a Wish
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#1E3A8A" />
            </Pressable>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(600).duration(600)}>
          <Pressable
            onPress={handleExplore}
            className="bg-purple-100 rounded-2xl p-5 flex-row items-center active:opacity-90 shadow-sm"
          >
            <View className="w-12 h-12 bg-white/90 rounded-full items-center justify-center mr-4">
              <Ionicons name="compass" size={26} color="#A855F7" />
            </View>
            <View className="flex-1">
              <Text className="text-purple-900 font-bold text-lg">
                Explore Wishes
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#581C87" />
          </Pressable>
        </Animated.View>
      </View>

      {/* Footer */}
      <Animated.View
        entering={FadeInDown.delay(800).duration(600)}
        className="mt-auto pt-6"
      >
        <Text className="text-wishy-gray text-center text-sm opacity-70">
          Wishes bring people together…
        </Text>
      </Animated.View>
    </View>
  );
}
