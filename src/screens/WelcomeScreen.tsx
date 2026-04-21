import React from "react";
import { View, Text, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import useUserStore from "../state/userStore";
import WishyLogo from "../components/WishyLogo";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Welcome">;

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);

  React.useEffect(() => {
    if (isLoggedIn) {
      navigation.replace("Landing");
    }
  }, [isLoggedIn, navigation]);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("Login");
  };

  return (
    <View className="flex-1" style={{ backgroundColor: "#FFB3D6" }}>
      <LinearGradient
        colors={["#FFB3D6", "#FFB3D6", "#FFFFFF"]}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.4, 1]}
      >
        <View
          className="flex-1 px-8"
          style={{ paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }}
        >
          {/* Logo and branding */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(800)}
            className="items-center"
          >
            <WishyLogo size={180} />
            <Text className="text-5xl font-bold text-wishy-black tracking-tight mt-4">
              Wishy
            </Text>
            <Text className="text-lg text-wishy-darkGray mt-2 text-center">
              Where desires become reality
            </Text>
          </Animated.View>

          {/* Feature highlights */}
          <Animated.View
            entering={FadeInUp.delay(600).duration(800)}
            className="flex-1 justify-center space-y-6"
          >
            <FeatureItem
              icon="heart"
              title="Share Your Desires"
              description="Create your wish list and let someone special know what makes you happy"
            />
            <FeatureItem
              icon="gift"
              title="Fulfill Dreams"
              description="Discover wishes to fulfill and create unforgettable moments together"
            />
            <FeatureItem
              icon="people"
              title="Connect Deeply"
              description="Build meaningful relationships through shared experiences"
            />
          </Animated.View>

          {/* CTA Button */}
          <Animated.View entering={FadeInUp.delay(1000).duration(800)}>
            <Pressable
              onPress={handleGetStarted}
              className="bg-wishy-black py-4 rounded-2xl items-center shadow-lg active:opacity-90"
            >
              <Text className="text-wishy-white text-lg font-semibold">
                Get Started
              </Text>
            </Pressable>
            <Text className="text-wishy-gray text-center mt-4 text-sm">
              Join thousands discovering meaningful connections
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-row items-start space-x-4">
      <View className="w-12 h-12 bg-wishy-white/90 rounded-xl items-center justify-center">
        <Ionicons name={icon} size={24} color="#FF8DC7" />
      </View>
      <View className="flex-1">
        <Text className="text-wishy-black font-semibold text-base">{title}</Text>
        <Text className="text-wishy-darkGray text-sm mt-1">{description}</Text>
      </View>
    </View>
  );
}
