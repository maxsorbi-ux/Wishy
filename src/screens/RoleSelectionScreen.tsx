import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { UserRole } from "../types/wishy";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "RoleSelection">;

export default function RoleSelectionScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  const handleRoleSelect = (role: UserRole) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRole(role);
  };

  const handleContinue = () => {
    if (!selectedRole) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("ProfileSetup");
  };

  return (
    <View
      className="flex-1 bg-wishy-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 40, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="chevron-back" size={24} color="#4A1528" />
          </Pressable>
          <Text className="text-3xl font-bold text-wishy-black mt-4">
            How do you want to use Wishy?
          </Text>
          <Text className="text-wishy-gray mt-2 text-base">
            Choose your primary role. You can always do both later.
          </Text>
        </Animated.View>

        {/* Role Options */}
        <View className="mt-8 space-y-4">
          <Animated.View entering={FadeInUp.delay(300).duration(600)}>
            <RoleCard
              role="wished"
              title="I want to be Wished"
              description="Share your desires and let others fulfill them. Create a wish list of experiences, gifts, and moments you dream of."
              icon="heart"
              selected={selectedRole === "wished"}
              onSelect={() => handleRoleSelect("wished")}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(450).duration(600)}>
            <RoleCard
              role="wisher"
              title="I want to be a Wisher"
              description="Discover wishes to fulfill. Create a portfolio of experiences and gifts you want to offer someone special."
              icon="gift"
              selected={selectedRole === "wisher"}
              onSelect={() => handleRoleSelect("wisher")}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600).duration(600)}>
            <RoleCard
              role="both"
              title="I want both"
              description="Experience the full Wishy journey. Share your wishes and fulfill others - perfect for couples and social connections."
              icon="sparkles"
              selected={selectedRole === "both"}
              onSelect={() => handleRoleSelect("both")}
            />
          </Animated.View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <Animated.View
        entering={FadeInUp.delay(800).duration(600)}
        className="px-6 pb-6"
      >
        <Pressable
          onPress={handleContinue}
          disabled={!selectedRole}
          className={cn(
            "py-4 rounded-2xl items-center",
            selectedRole ? "bg-wishy-black active:opacity-90" : "bg-wishy-gray/30"
          )}
        >
          <Text
            className={cn(
              "text-lg font-semibold",
              selectedRole ? "text-wishy-white" : "text-wishy-gray"
            )}
          >
            Continue
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function RoleCard({
  role,
  title,
  description,
  icon,
  selected,
  onSelect,
}: {
  role: UserRole;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Pressable
      onPress={onSelect}
      className={cn(
        "p-5 rounded-2xl border-2",
        selected
          ? "bg-wishy-paleBlush/50 border-wishy-black"
          : "bg-white border-transparent"
      )}
    >
      <View className="flex-row items-start space-x-4">
        <View
          className={cn(
            "w-14 h-14 rounded-xl items-center justify-center",
            selected ? "bg-wishy-black" : "bg-wishy-paleBlush"
          )}
        >
          <Ionicons
            name={icon}
            size={28}
            color={selected ? "#D4AF37" : "#8B2252"}
          />
        </View>
        <View className="flex-1">
          <Text className="text-wishy-black font-semibold text-lg">{title}</Text>
          <Text className="text-wishy-gray mt-1 text-sm leading-5">
            {description}
          </Text>
        </View>
        <View
          className={cn(
            "w-6 h-6 rounded-full border-2 items-center justify-center",
            selected ? "bg-wishy-black border-wishy-black" : "border-wishy-gray"
          )}
        >
          {selected && <Ionicons name="checkmark" size={16} color="#FFF8F0" />}
        </View>
      </View>
    </Pressable>
  );
}
