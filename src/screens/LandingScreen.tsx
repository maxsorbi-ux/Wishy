import React from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import useUserStore from "../state/userStore";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function LandingScreen() {
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

  // Determine which buttons to show based on user role
  const showExpressButton = currentUser?.role === "wished" || currentUser?.role === "both";
  const showProposeButton = currentUser?.role === "wisher" || currentUser?.role === "both";
  const showExploreButton = true; // Always visible

  return (
    <View className="flex-1 bg-wishy-white">
      <LinearGradient
        colors={["#FFE5F1", "#FFF8F0", "#FFFFFF"]}
        style={{ flex: 1 }}
      >
        {/* Logo Section - More Integrated */}
        <Animated.View
          entering={FadeIn.duration(800)}
          className="flex-1 items-center justify-center px-6"
        >
          {/* Logo with soft shadow and better spacing */}
          <View className="items-center mb-16">
            <View className="items-center justify-center mb-6">
              <Image
                source={require("../../assets/wishy-logo.jpeg")}
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 12,
                }}
                contentFit="cover"
              />
            </View>
            <Text className="text-wishy-black text-3xl font-bold tracking-tight">
              Wishy
            </Text>
            <Text className="text-wishy-gray text-center mt-2 text-base px-4">
              Trasforma i desideri in realtà
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="w-full gap-3 px-2">
            {/* Express a Wish Button - Only for "wished" and "both" */}
            {showExpressButton && (
              <Animated.View entering={FadeInDown.delay(200).duration(600)}>
                <Pressable
                  onPress={handleExpressWish}
                  className="bg-wishy-pink rounded-2xl p-5 flex-row items-center active:scale-98 shadow-sm"
                >
                  <View className="w-12 h-12 bg-white/90 rounded-full items-center justify-center mr-4 shadow-sm">
                    <Ionicons name="heart" size={26} color="#FF8DC7" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-wishy-black font-bold text-lg">
                      Esprimi un Desiderio
                    </Text>
                    <Text className="text-wishy-black/70 text-sm mt-0.5">
                      Condividi ciò che desideri
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#000000" />
                </Pressable>
              </Animated.View>
            )}

            {/* Propose a Wish Button - Only for "wisher" and "both" */}
            {showProposeButton && (
              <Animated.View entering={FadeInDown.delay(400).duration(600)}>
                <Pressable
                  onPress={handleProposeWish}
                  className="bg-blue-100 rounded-2xl p-5 flex-row items-center active:scale-98 shadow-sm"
                >
                  <View className="w-12 h-12 bg-white/90 rounded-full items-center justify-center mr-4 shadow-sm">
                    <Ionicons name="gift" size={26} color="#3B82F6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-blue-900 font-bold text-lg">
                      Proponi un Desiderio
                    </Text>
                    <Text className="text-blue-700 text-sm mt-0.5">
                      Offri un{"'"}esperienza a qualcuno
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#1E3A8A" />
                </Pressable>
              </Animated.View>
            )}

            {/* Explore Wishes Button - Always visible */}
            {showExploreButton && (
              <Animated.View entering={FadeInDown.delay(600).duration(600)}>
                <Pressable
                  onPress={handleExplore}
                  className="bg-purple-100 rounded-2xl p-5 flex-row items-center active:scale-98 shadow-sm"
                >
                  <View className="w-12 h-12 bg-white/90 rounded-full items-center justify-center mr-4 shadow-sm">
                    <Ionicons name="compass" size={26} color="#A855F7" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-purple-900 font-bold text-lg">
                      Esplora i Desideri
                    </Text>
                    <Text className="text-purple-700 text-sm mt-0.5">
                      Scopri nuove opportunità
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color="#581C87" />
                </Pressable>
              </Animated.View>
            )}
          </View>
        </Animated.View>

        {/* Footer */}
        <Animated.View
          entering={FadeInDown.delay(800).duration(600)}
          className="pb-10 px-8"
        >
          <Text className="text-wishy-gray text-center text-sm opacity-70">
            Inizia il tuo viaggio con Wishy
          </Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}
