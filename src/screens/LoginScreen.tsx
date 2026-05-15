import React, { useState } from "react";
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import useUserStore from "../state/userStore";
import { cn } from "../utils/cn";
import { Image } from "expo-image";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const login = useUserStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await login(email.trim(), password);

    setIsLoading(false);
    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace("Landing");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setError(result.error || "Login failed");
    }
  };

  const isValid = email.trim().length > 0 && password.trim().length > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        className="flex-1"
        style={{ paddingTop: insets.top + 40 }}
      >
        {/* Branding */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          className="items-center mb-8 px-8"
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

        {/* Form */}
        <View className="flex-1 px-6">
          <Animated.View entering={FadeInUp.delay(200).duration(600)}>
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
              placeholder="Enter your password"
              placeholderTextColor="#9A8A8A"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
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

          <Animated.View entering={FadeInUp.delay(400).duration(600)} className="mt-8">
            <Pressable
              onPress={handleLogin}
              disabled={!isValid || isLoading}
              className={cn(
                "py-4 rounded-2xl items-center",
                isValid && !isLoading ? "bg-wishy-black active:opacity-90" : "bg-wishy-gray/30"
              )}
            >
              <Text
                className={cn(
                  "text-lg font-semibold",
                  isValid && !isLoading ? "text-wishy-white" : "text-wishy-gray"
                )}
              >
                {isLoading ? "Logging in..." : "Log In"}
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500).duration(600)} className="mt-6">
            <Pressable
              onPress={() => navigation.navigate("Register")}
              className="py-3 items-center"
            >
              <Text className="text-wishy-black">
                Don&apos;t have an account?{" "}
                <Text className="font-semibold text-wishy-black underline">Sign Up</Text>
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
