import React, { useState } from "react";
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import useUserStore from "../state/userStore";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Register">;

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const register = useUserStore((s) => s.register);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    setError("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await register(email.trim(), password, name.trim(), "both");

    setIsLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // After successful registration, go to profile setup
      navigation.navigate("ProfileSetup");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || "Registration failed");
    }
  };

  const isValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.trim().length >= 6 &&
    password === confirmPassword;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-wishy-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ paddingTop: insets.top }} className="flex-1">
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </Pressable>
          <Text className="text-2xl font-bold text-wishy-black ml-4">Create Account</Text>
        </View>

        {/* Form */}
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInUp.delay(100).duration(600)}>
            <Text className="text-wishy-black font-semibold mb-2">Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor="#9A8A8A"
              autoCapitalize="words"
              className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush"
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(600)} className="mt-4">
            <Text className="text-wishy-black font-semibold mb-2">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#9A8A8A"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush"
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).duration(600)} className="mt-4">
            <Text className="text-wishy-black font-semibold mb-2">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor="#9A8A8A"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="off"
              textContentType="none"
              className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush"
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400).duration(600)} className="mt-4">
            <Text className="text-wishy-black font-semibold mb-2">Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your password"
              placeholderTextColor="#9A8A8A"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="off"
              textContentType="none"
              className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush"
            />
          </Animated.View>

          {error ? (
            <Animated.View entering={FadeInUp.duration(300)} className="mt-4">
              <View className="bg-red-50 border border-red-200 rounded-xl p-3 flex-row items-center">
                <Ionicons name="alert-circle" size={20} color="#DC2626" />
                <Text className="text-red-600 ml-2 flex-1">{error}</Text>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInUp.delay(500).duration(600)} className="mt-8">
            <Pressable
              onPress={handleRegister}
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
                Sign Up
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600).duration(600)} className="mt-6 mb-8">
            <Pressable
              onPress={() => navigation.navigate("Login")}
              className="py-3 items-center"
            >
              <Text className="text-wishy-black">
                Already have an account?{" "}
                <Text className="font-semibold text-wishy-black underline">Log In</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
