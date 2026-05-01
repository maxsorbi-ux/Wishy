import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import useUserStore from "../state/userStore";
import { PrivacyVisibility } from "../types/wishy";
import { cn } from "../utils/cn";

type PrivacyKey =
  | "email"
  | "bio"
  | "location"
  | "age"
  | "gender"
  | "relationshipPreferences"
  | "interests"
  | "wishList"
  | "wishPortfolio"
  | "gallery"
  | "calendar";

const PRIVACY_ITEMS: Array<{ key: PrivacyKey; label: string; icon: string }> = [
  { key: "email", label: "Email Contact", icon: "mail-outline" },
  { key: "bio", label: "Bio", icon: "document-text-outline" },
  { key: "location", label: "Location", icon: "location-outline" },
  { key: "age", label: "Age", icon: "person-outline" },
  { key: "gender", label: "Gender", icon: "body-outline" },
  { key: "relationshipPreferences", label: "Relationship Preferences", icon: "heart-outline" },
  { key: "interests", label: "Interests", icon: "sparkles-outline" },
  { key: "wishList", label: "Wish List", icon: "list-outline" },
  { key: "wishPortfolio", label: "Wish Portfolio", icon: "briefcase-outline" },
  { key: "gallery", label: "Photo Gallery", icon: "images-outline" },
  // { key: "calendar", label: "Calendar", icon: "calendar-outline" },
];

const VISIBILITY_OPTIONS: Array<{ value: PrivacyVisibility; label: string; icon: string }> = [
  { value: "public", label: "Public", icon: "globe-outline" },
  { value: "friends", label: "Friends", icon: "people-outline" },
  { value: "relationship", label: "Partner", icon: "heart-outline" },
];

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const currentUser = useUserStore((s) => s.currentUser);
  const updateUser = useUserStore((s) => s.updateUser);

  const defaultSettings: Record<PrivacyKey, PrivacyVisibility> = {
    email: "public",
    bio: "public",
    location: "public",
    age: "public",
    gender: "public",
    relationshipPreferences: "public",
    interests: "public",
    wishList: "public",
    wishPortfolio: "public",
    gallery: "public",
    calendar: "public",
  };

  const privacySettings = {
    ...defaultSettings,
    ...(currentUser?.privacySettings ?? {}),
  } as Record<PrivacyKey, PrivacyVisibility>;

  const handleChange = (key: PrivacyKey, value: PrivacyVisibility) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateUser({
      privacySettings: { ...privacySettings, [key]: value },
    });
  };

  return (
    <View className="flex-1 bg-wishy-white">
      <View
        style={{ paddingTop: insets.top + 16 }}
        className="flex-row items-center px-6 pb-4 border-b border-wishy-paleBlush bg-wishy-white"
      >
        <Pressable
          onPress={() => navigation.goBack()}
          className="w-10 h-10 items-center justify-center mr-3 active:opacity-70"
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text className="text-wishy-black font-bold text-xl">Privacy</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(50).duration(400)} className="bg-wishy-paleBlush/40 p-4 rounded-2xl mb-6 border border-wishy-pink/30">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#8B2252" />
            <View className="flex-1 ml-2">
              <Text className="text-wishy-black font-medium text-sm">Your name and profile picture are always public.</Text>
              <Text className="text-wishy-gray text-xs mt-1">Choose who can see other parts of your profile.</Text>
            </View>
          </View>
        </Animated.View>

        {PRIVACY_ITEMS.map((item, index) => (
          <Animated.View
            key={item.key}
            entering={FadeInDown.delay(80 + index * 40).duration(400)}
            className="bg-white rounded-2xl p-4 mb-3 border border-wishy-paleBlush"
          >
            <View className="flex-row items-center mb-3">
              <View className="w-9 h-9 bg-wishy-paleBlush rounded-full items-center justify-center mr-3">
                <Ionicons name={item.icon as any} size={18} color="#8B2252" />
              </View>
              <Text className="text-wishy-black font-semibold">{item.label}</Text>
            </View>
            <View className="flex-row gap-2">
              {VISIBILITY_OPTIONS.map((opt) => {
                const active = privacySettings[item.key] === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleChange(item.key, opt.value)}
                    className={cn(
                      "flex-1 py-2 rounded-xl border-2 items-center active:opacity-80",
                      active
                        ? "bg-wishy-pink border-wishy-darkPink"
                        : "bg-white border-wishy-paleBlush"
                    )}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={16}
                      color={active ? "#4A1528" : "#9A8A8A"}
                    />
                    <Text
                      className={cn(
                        "text-xs font-medium mt-1",
                        active ? "text-wishy-black" : "text-wishy-gray"
                      )}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}
