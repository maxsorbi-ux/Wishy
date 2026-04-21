import React, { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import useUserStore from "../state/userStore";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "ProfileSetup">;

const INTEREST_OPTIONS = [
  "Travel", "Dining", "Fashion", "Art", "Music", "Sports",
  "Wellness", "Adventure", "Nature", "Technology", "Books", "Movies"
];

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const updateUser = useUserStore((s) => s.updateUser);
  const currentUser = useUserStore((s) => s.currentUser);

  const [bio, setBio] = useState("");
  const [profilePhoto, setProfilePhoto] = useState<string | undefined>();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const toggleInterest = (interest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !selectedInterests.includes(customInterest.trim())) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedInterests((prev) => [...prev, customInterest.trim()]);
      setCustomInterest("");
      setShowCustomInput(false);
    }
  };

  const removeInterest = (interest: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInterests((prev) => prev.filter((i) => i !== interest));
  };

  const handleComplete = () => {
    if (!currentUser) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateUser({
      bio: bio.trim(),
      profilePhoto,
      interests: selectedInterests,
    });
    navigation.replace("Landing");
  };

  const isValid = true; // Always valid since user is already created

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-wishy-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ paddingTop: insets.top }} className="flex-1">
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
              Create your profile
            </Text>
            <Text className="text-wishy-gray mt-2 text-base">
              Let others know who you are
            </Text>
          </Animated.View>

          {/* Profile Photo */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(600)}
            className="items-center mt-8"
          >
            <Pressable onPress={handlePickImage} className="relative">
              <View className="w-28 h-28 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-4 border-wishy-pink">
                {profilePhoto ? (
                  <Image
                    source={{ uri: profilePhoto }}
                    style={{ width: 112, height: 112 }}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="person" size={48} color="#8B2252" />
                )}
              </View>
              <View className="absolute bottom-0 right-0 w-9 h-9 bg-wishy-black rounded-full items-center justify-center border-2 border-wishy-white">
                <Ionicons name="camera" size={18} color="#FFF8F0" />
              </View>
            </Pressable>
            <Text className="text-wishy-gray mt-3 text-sm">
              Tap to add a photo
            </Text>
          </Animated.View>

          {/* Bio Input */}
          <Animated.View
            entering={FadeInUp.delay(300).duration(600)}
            className="mt-8"
          >
            <Text className="text-wishy-black font-semibold mb-2">About You</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Share a little about yourself..."
              placeholderTextColor="#9A8A8A"
              multiline
              numberOfLines={3}
              className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush min-h-[100px]"
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Interests */}
          <Animated.View
            entering={FadeInUp.delay(500).duration(600)}
            className="mt-6"
          >
            <Text className="text-wishy-black font-semibold mb-3">Your Interests</Text>
            <View className="flex-row flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => (
                <Pressable
                  key={interest}
                  onPress={() => toggleInterest(interest)}
                  className={cn(
                    "px-4 py-2 rounded-full border",
                    selectedInterests.includes(interest)
                      ? "bg-wishy-black border-wishy-black"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      selectedInterests.includes(interest)
                        ? "text-wishy-white"
                        : "text-wishy-black"
                    )}
                  >
                    {interest}
                  </Text>
                </Pressable>
              ))}

              {/* Add Your Own Button */}
              <Pressable
                onPress={() => setShowCustomInput(true)}
                className="px-4 py-2 rounded-full border-2 border-dashed border-wishy-pink bg-wishy-paleBlush/30"
              >
                <Text className="text-sm font-medium text-wishy-black">
                  + Add Your Own
                </Text>
              </Pressable>

              {/* Custom Interests */}
              {selectedInterests
                .filter((interest) => !INTEREST_OPTIONS.includes(interest))
                .map((interest) => (
                  <Pressable
                    key={interest}
                    onPress={() => removeInterest(interest)}
                    className="px-4 py-2 rounded-full bg-wishy-pink border border-wishy-pink flex-row items-center"
                  >
                    <Text className="text-sm font-medium text-wishy-black mr-1">
                      {interest}
                    </Text>
                    <Ionicons name="close-circle" size={16} color="#000000" />
                  </Pressable>
                ))}
            </View>

            {/* Custom Input Field */}
            {showCustomInput && (
              <Animated.View entering={FadeInUp.duration(300)} className="mt-4">
                <View className="flex-row items-center space-x-2">
                  <TextInput
                    value={customInterest}
                    onChangeText={setCustomInterest}
                    placeholder="Type your interest..."
                    placeholderTextColor="#9A8A8A"
                    className="flex-1 bg-white p-3 rounded-xl text-wishy-black text-sm border border-wishy-paleBlush"
                    autoFocus
                    onSubmitEditing={addCustomInterest}
                  />
                  <Pressable
                    onPress={addCustomInterest}
                    disabled={!customInterest.trim()}
                    className={cn(
                      "w-10 h-10 rounded-full items-center justify-center",
                      customInterest.trim() ? "bg-wishy-black" : "bg-wishy-gray/30"
                    )}
                  >
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={customInterest.trim() ? "#FFFFFF" : "#9A8A8A"}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowCustomInput(false);
                      setCustomInterest("");
                    }}
                    className="w-10 h-10 rounded-full items-center justify-center bg-wishy-gray/20"
                  >
                    <Ionicons name="close" size={20} color="#6B7280" />
                  </Pressable>
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </ScrollView>

        {/* Complete Button */}
        <Animated.View
          entering={FadeInUp.delay(600).duration(600)}
          className="px-6"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={handleComplete}
            disabled={!isValid}
            className={cn(
              "py-4 rounded-2xl items-center",
              isValid ? "bg-wishy-black active:opacity-90" : "bg-wishy-gray/30"
            )}
          >
            <Text
              className={cn(
                "text-lg font-semibold",
                isValid ? "text-wishy-white" : "text-wishy-gray"
              )}
            >
              Complete Profile
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}
