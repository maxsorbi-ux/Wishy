import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import useUserStore from "../state/userStore";
import { UserRole, Gender, RelationshipPreference } from "../types/wishy";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "wisher", label: "Wisher" },
  { value: "wished", label: "Wished" },
  { value: "both", label: "Both" },
];

const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-Binary" },
  { value: "custom", label: "Custom" },
];

const RELATIONSHIP_PREFERENCES: Array<{ value: RelationshipPreference; label: string }> = [
  { value: "heterosexual", label: "Heterosexual" },
  { value: "homosexual", label: "Homosexual" },
  { value: "bisexual", label: "Bisexual" },
  { value: "custom", label: "Custom" },
];

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const currentUser = useUserStore((s) => s.currentUser);
  const updateUser = useUserStore((s) => s.updateUser);

  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(
    currentUser?.searchPreferences?.roles || ["wisher", "wished", "both"]
  );
  const [selectedGenders, setSelectedGenders] = useState<Gender[]>(
    currentUser?.searchPreferences?.genders || ["male", "female", "non-binary"]
  );
  const [selectedRelationshipPreferences, setSelectedRelationshipPreferences] = useState<RelationshipPreference[]>(
    currentUser?.searchPreferences?.relationshipPreferences || ["heterosexual", "homosexual", "bisexual"]
  );

  const toggleRole = (role: UserRole) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const toggleGender = (gender: Gender) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGenders((prev) =>
      prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
    );
  };

  const toggleRelationshipPreference = (preference: RelationshipPreference) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRelationshipPreferences((prev) =>
      prev.includes(preference) ? prev.filter((p) => p !== preference) : [...prev, preference]
    );
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    updateUser({
      searchPreferences: {
        roles: selectedRoles,
        genders: selectedGenders,
        relationshipPreferences: selectedRelationshipPreferences,
      },
    });

    navigation.goBack();
  };

  if (!currentUser) {
    return null;
  }

  return (
    <View className="flex-1 bg-wishy-white">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 16 }}
        className="flex-row items-center justify-between px-6 pb-4 border-b border-wishy-paleBlush bg-wishy-white"
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          className="w-10 h-10 items-center justify-center active:opacity-70"
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </Pressable>
        <Text className="text-wishy-black font-bold text-lg">Search Settings</Text>
        <Pressable
          onPress={handleSave}
          className="px-4 py-2 bg-wishy-black rounded-xl active:opacity-80"
        >
          <Text className="text-wishy-white font-semibold">Save</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6">
          {/* Info Banner */}
          <Animated.View
            entering={FadeInDown.delay(50).duration(400)}
            className="bg-wishy-paleBlush/50 p-4 rounded-2xl mb-6 border border-wishy-pink/30"
          >
            <View className="flex-row items-start">
              <Ionicons name="information-circle" size={20} color="#8B2252" />
              <Text className="text-wishy-gray text-sm ml-2 flex-1">
                Choose which users appear in your search results based on their role, gender, and relationship preference.
              </Text>
            </View>
          </Animated.View>

          {/* Roles Filter */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-6">
            <Text className="text-wishy-black font-bold text-lg mb-3">User Roles</Text>
            <Text className="text-wishy-gray text-sm mb-3">
              Show users with these roles in search results
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ROLES.map((role) => (
                <Pressable
                  key={role.value}
                  onPress={() => toggleRole(role.value)}
                  className={cn(
                    "px-4 py-3 rounded-xl border-2 flex-row items-center",
                    selectedRoles.includes(role.value)
                      ? "bg-wishy-pink border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  {selectedRoles.includes(role.value) && (
                    <Ionicons name="checkmark-circle" size={18} color="#000000" className="mr-2" />
                  )}
                  <Text
                    className={cn(
                      "font-medium",
                      selectedRoles.includes(role.value) ? "text-wishy-black" : "text-wishy-gray"
                    )}
                  >
                    {role.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Gender Filter */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} className="mb-6">
            <Text className="text-wishy-black font-bold text-lg mb-3">Gender</Text>
            <Text className="text-wishy-gray text-sm mb-3">
              Show users with these genders in search results
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((gender) => (
                <Pressable
                  key={gender.value}
                  onPress={() => toggleGender(gender.value)}
                  className={cn(
                    "px-4 py-3 rounded-xl border-2 flex-row items-center",
                    selectedGenders.includes(gender.value)
                      ? "bg-wishy-pink border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  {selectedGenders.includes(gender.value) && (
                    <Ionicons name="checkmark-circle" size={18} color="#000000" className="mr-2" />
                  )}
                  <Text
                    className={cn(
                      "font-medium",
                      selectedGenders.includes(gender.value) ? "text-wishy-black" : "text-wishy-gray"
                    )}
                  >
                    {gender.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          {/* Relationship Preference Filter */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-6">
            <Text className="text-wishy-black font-bold text-lg mb-3">Relationship Preference</Text>
            <Text className="text-wishy-gray text-sm mb-3">
              Show users with these preferences in search results
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {RELATIONSHIP_PREFERENCES.map((pref) => (
                <Pressable
                  key={pref.value}
                  onPress={() => toggleRelationshipPreference(pref.value)}
                  className={cn(
                    "px-4 py-3 rounded-xl border-2 flex-row items-center",
                    selectedRelationshipPreferences.includes(pref.value)
                      ? "bg-wishy-pink border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  {selectedRelationshipPreferences.includes(pref.value) && (
                    <Ionicons name="checkmark-circle" size={18} color="#000000" className="mr-2" />
                  )}
                  <Text
                    className={cn(
                      "font-medium",
                      selectedRelationshipPreferences.includes(pref.value)
                        ? "text-wishy-black"
                        : "text-wishy-gray"
                    )}
                  >
                    {pref.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
