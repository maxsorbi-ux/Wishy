import React, { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import useUserStore from "../state/userStore";
import useWishStore from "../state/wishStore";
import useConnectionStore from "../state/connectionStore";
import useNotificationStore from "../state/notificationStore";

// DEV ONLY - Remove this component in production
const DEV_ACCOUNTS = [
  {
    name: "Max Sorbi",
    email: "maxsorbi@bluewin.ch",
    password: "Chicca1976",
  },
  {
    name: "Chicca Ostinelli",
    email: "federicaostinelli@gmail.com",
    password: "Chicca1976",
  },
];

export default function DevAccountSwitcher() {
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = useUserStore((s) => s.currentUser);
  const login = useUserStore((s) => s.login);
  const syncWishes = useWishStore((s) => s.syncWishes);
  const syncConnections = useConnectionStore((s) => s.syncConnections);
  const syncNotifications = useNotificationStore((s) => s.syncNotifications);

  const handleSwitchAccount = async (account: typeof DEV_ACCOUNTS[0]) => {
    if (currentUser?.email === account.email) {
      setShowModal(false);
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log("=== DEV SWITCH ACCOUNT ===");
      console.log("Switching to:", account.name);

      const success = await login(account.email, account.password);

      if (success) {
        console.log("Login successful, syncing data...");
        // Sync all data for new account
        await Promise.all([
          syncWishes(),
          syncConnections(),
          syncNotifications(),
        ]);
        console.log("=== DEV SWITCH COMPLETE ===");
      } else {
        console.log("Login failed for:", account.email);
      }
    } catch (error) {
      console.log("Switch account error:", error);
    } finally {
      setIsLoading(false);
      setShowModal(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowModal(true);
        }}
        className="absolute bottom-32 left-4 w-12 h-12 bg-purple-600 rounded-full items-center justify-center shadow-lg z-50"
        style={{
          shadowColor: "#7C3AED",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <Ionicons name="swap-horizontal" size={24} color="#FFFFFF" />
      </Pressable>

      {/* Account Switcher Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable
          onPress={() => setShowModal(false)}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-white rounded-2xl p-5 mx-6 w-72"
            >
              <View className="flex-row items-center mb-4">
                <Ionicons name="code-working" size={24} color="#7C3AED" />
                <Text className="text-black font-bold text-lg ml-2">
                  Dev Account Switcher
                </Text>
              </View>

              <Text className="text-gray-500 text-sm mb-4">
                Current: {currentUser?.name || "Not logged in"}
              </Text>

              {DEV_ACCOUNTS.map((account) => {
                const isCurrentAccount = currentUser?.email === account.email;
                return (
                  <Pressable
                    key={account.email}
                    onPress={() => handleSwitchAccount(account)}
                    disabled={isLoading}
                    className={`flex-row items-center p-3 rounded-xl mb-2 ${
                      isCurrentAccount
                        ? "bg-purple-100 border-2 border-purple-500"
                        : "bg-gray-100 active:bg-gray-200"
                    }`}
                  >
                    <View
                      className={`w-10 h-10 rounded-full items-center justify-center ${
                        isCurrentAccount ? "bg-purple-500" : "bg-gray-300"
                      }`}
                    >
                      <Text className="text-white font-bold">
                        {account.name.charAt(0)}
                      </Text>
                    </View>
                    <View className="flex-1 ml-3">
                      <Text
                        className={`font-semibold ${
                          isCurrentAccount ? "text-purple-700" : "text-black"
                        }`}
                      >
                        {account.name}
                      </Text>
                      <Text className="text-gray-500 text-xs">
                        {account.email}
                      </Text>
                    </View>
                    {isCurrentAccount && (
                      <Ionicons name="checkmark-circle" size={20} color="#7C3AED" />
                    )}
                  </Pressable>
                );
              })}

              {isLoading && (
                <View className="items-center py-2">
                  <Text className="text-purple-600 font-medium">Switching...</Text>
                </View>
              )}

              <Pressable
                onPress={() => setShowModal(false)}
                className="mt-2 py-3 rounded-xl items-center border border-gray-300 active:bg-gray-100"
              >
                <Text className="text-gray-600 font-semibold">Close</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
