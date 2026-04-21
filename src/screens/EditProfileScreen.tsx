import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import useUserStore from "../state/userStore";
import { useToastStore } from "../state/toastStore";
import { Gender, RelationshipPreference } from "../types/wishy";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

export default function EditProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const currentUser = useUserStore((s) => s.currentUser);
  const updateUser = useUserStore((s) => s.updateUser);
  const showToast = useToastStore((s) => s.showToast);

  const [name, setName] = useState(currentUser?.name || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [location, setLocation] = useState(currentUser?.location || "");
  const [age, setAge] = useState(currentUser?.age?.toString() || "");
  const [gender, setGender] = useState<Gender | undefined>(currentUser?.gender);
  const [customGender, setCustomGender] = useState(currentUser?.customGender || "");
  const [relationshipPreference, setRelationshipPreference] = useState<RelationshipPreference | undefined>(
    currentUser?.relationshipPreference
  );
  const [customRelationshipPreference, setCustomRelationshipPreference] = useState(
    currentUser?.customRelationshipPreference || ""
  );
  const [interests, setInterests] = useState<string[]>(currentUser?.interests || []);
  const [newInterest, setNewInterest] = useState("");
  const [showAddInterest, setShowAddInterest] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    updateUser({
      name: name.trim(),
      bio: bio.trim(),
      location: location.trim() || undefined,
      age: age ? parseInt(age) : undefined,
      gender,
      customGender: gender === "custom" ? customGender.trim() : undefined,
      relationshipPreference,
      customRelationshipPreference: relationshipPreference === "custom" ? customRelationshipPreference.trim() : undefined,
      interests,
    });

    showToast("Profile updated successfully!");
    navigation.goBack();
  };

  const handleAddInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest("");
      setShowAddInterest(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast("Interest added!");
    }
  };

  const handleRemoveInterest = (interest: string) => {
    setInterests(interests.filter((i) => i !== interest));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          <Ionicons name="close" size={28} color="#000000" />
        </Pressable>
        <Text className="text-wishy-black font-bold text-lg">Edit Profile</Text>
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
          {/* Name */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-5">
            <Text className="text-wishy-black font-semibold mb-2">Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
              className="bg-white rounded-xl p-4 text-wishy-black border border-wishy-paleBlush"
            />
          </Animated.View>

          {/* Bio */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)} className="mb-5">
            <Text className="text-wishy-black font-semibold mb-2">Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              className="bg-white rounded-xl p-4 text-wishy-black border border-wishy-paleBlush"
              style={{ textAlignVertical: "top" }}
            />
          </Animated.View>

          {/* Location */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-5">
            <Text className="text-wishy-black font-semibold mb-2">Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="City, Country"
              placeholderTextColor="#9CA3AF"
              className="bg-white rounded-xl p-4 text-wishy-black border border-wishy-paleBlush"
            />
          </Animated.View>

          {/* Age */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)} className="mb-5">
            <Text className="text-wishy-black font-semibold mb-2">Age</Text>
            <TextInput
              value={age}
              onChangeText={setAge}
              placeholder="Your age"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              className="bg-white rounded-xl p-4 text-wishy-black border border-wishy-paleBlush"
            />
          </Animated.View>

          {/* Gender */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-5">
            <Text className="text-wishy-black font-semibold mb-2">Gender</Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((g) => (
                <Pressable
                  key={g.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setGender(g.value);
                  }}
                  className={cn(
                    "px-4 py-3 rounded-xl border-2",
                    gender === g.value
                      ? "bg-wishy-pink border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  <Text
                    className={cn(
                      "font-medium",
                      gender === g.value ? "text-wishy-black" : "text-wishy-gray"
                    )}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {gender === "custom" && (
              <TextInput
                value={customGender}
                onChangeText={setCustomGender}
                placeholder="Specify your gender"
                placeholderTextColor="#9CA3AF"
                className="bg-white rounded-xl p-4 text-wishy-black border border-wishy-paleBlush mt-3"
              />
            )}
          </Animated.View>

          {/* Relationship Preference */}
          <Animated.View entering={FadeInDown.delay(350).duration(400)} className="mb-5">
            <Text className="text-wishy-black font-semibold mb-2">Relationship Preference</Text>
            <View className="flex-row flex-wrap gap-2">
              {RELATIONSHIP_PREFERENCES.map((rp) => (
                <Pressable
                  key={rp.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setRelationshipPreference(rp.value);
                  }}
                  className={cn(
                    "px-4 py-3 rounded-xl border-2",
                    relationshipPreference === rp.value
                      ? "bg-wishy-pink border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  <Text
                    className={cn(
                      "font-medium",
                      relationshipPreference === rp.value ? "text-wishy-black" : "text-wishy-gray"
                    )}
                  >
                    {rp.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {relationshipPreference === "custom" && (
              <TextInput
                value={customRelationshipPreference}
                onChangeText={setCustomRelationshipPreference}
                placeholder="Specify your preference"
                placeholderTextColor="#9CA3AF"
                className="bg-white rounded-xl p-4 text-wishy-black border border-wishy-paleBlush mt-3"
              />
            )}
          </Animated.View>

          {/* Interests */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mb-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-wishy-black font-semibold">Interests</Text>
              <Pressable
                onPress={() => setShowAddInterest(true)}
                className="px-3 py-1 bg-wishy-pink rounded-lg active:opacity-80"
              >
                <Text className="text-wishy-black font-medium text-sm">Add</Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {interests.map((interest) => (
                <View
                  key={interest}
                  className="bg-white px-4 py-2 rounded-full border border-wishy-paleBlush flex-row items-center"
                >
                  <Text className="text-wishy-black text-sm mr-2">{interest}</Text>
                  <Pressable onPress={() => handleRemoveInterest(interest)}>
                    <Ionicons name="close-circle" size={18} color="#8B2252" />
                  </Pressable>
                </View>
              ))}
              {interests.length === 0 && (
                <Text className="text-wishy-gray text-sm">No interests added yet</Text>
              )}
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Add Interest Modal */}
      <Modal
        visible={showAddInterest}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddInterest(false)}
      >
        <Pressable
          onPress={() => setShowAddInterest(false)}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-80"
            >
              <Text className="text-wishy-black font-bold text-xl mb-4">Add Interest</Text>
              <TextInput
                value={newInterest}
                onChangeText={setNewInterest}
                placeholder="Enter an interest"
                placeholderTextColor="#9CA3AF"
                autoFocus
                className="bg-wishy-paleBlush/30 rounded-xl p-4 text-wishy-black mb-4"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setShowAddInterest(false);
                    setNewInterest("");
                  }}
                  className="flex-1 py-3 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleAddInterest}
                  className="flex-1 py-3 rounded-xl items-center bg-wishy-black active:opacity-90"
                >
                  <Text className="text-wishy-white font-semibold">Add</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
