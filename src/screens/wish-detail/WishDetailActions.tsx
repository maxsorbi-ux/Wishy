import React from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Wish } from "../../types/wishy";

interface WishDetailActionsProps {
  wish: Wish;
  isOwnWish: boolean;
  insets: { bottom: number };
  onEdit: () => void;
  onProposeDate: () => void;
  onOpenChat: () => void;
  onDelete: () => void;
  onDecline: () => void;
  onMarkFulfilled: () => void;
  onAccept: () => Promise<void>;
}

const actionBarStyle = (bottomInset: number) => ({
  paddingBottom: bottomInset + 16,
  paddingTop: 16,
  paddingHorizontal: 24,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: -2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 5,
});

export function WishDetailActions({
  wish,
  isOwnWish,
  insets,
  onEdit,
  onProposeDate,
  onOpenChat,
  onDelete,
  onDecline,
  onMarkFulfilled,
  onAccept,
}: WishDetailActionsProps) {
  const barStyle = actionBarStyle(insets.bottom);

  return (
    <>
      {/* CREATOR - active wish (sent/accepted/date_set/confirmed) */}
      {isOwnWish && wish.status !== "created" && wish.status !== "fulfilled" && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={barStyle}
        >
          <View className="gap-3">
            <Pressable
              onPress={onEdit}
              className="bg-wishy-darkPink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="pencil" size={22} color="#000000" />
              <Text className="text-black font-bold text-base ml-2">Edit</Text>
            </Pressable>
            <Pressable
              onPress={onProposeDate}
              className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="calendar-outline" size={22} color="#000000" />
              <Text className="text-black font-semibold text-base ml-2">Propose Date</Text>
            </Pressable>
            <Pressable
              onPress={onOpenChat}
              className="bg-wishy-paleBlush py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="chatbubble-outline" size={22} color="#000000" />
              <Text className="text-black font-semibold text-base ml-2">Open Chat</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">Delete</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* CREATOR - fulfilled wish */}
      {isOwnWish && wish.status === "fulfilled" && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={barStyle}
        >
          <View className="gap-3">
            <Pressable
              onPress={onOpenChat}
              className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="chatbubble-outline" size={22} color="#000000" />
              <Text className="text-black font-semibold text-base ml-2">Open Chat</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">Delete</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* CREATOR - unsent wish (created status) */}
      {isOwnWish && wish.status === "created" && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={barStyle}
        >
          <View className="gap-3">
            <Pressable
              onPress={onEdit}
              className="bg-wishy-darkPink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="pencil" size={22} color="#000000" />
              <Text className="text-black font-bold text-base ml-2">Edit</Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">Delete</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* RECEIVER actions */}
      {!isOwnWish && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={barStyle}
        >
          <View className="gap-3">
            {wish.status === "sent" && (
              <Pressable
                onPress={onAccept}
                className="bg-wishy-darkPink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="checkmark-circle" size={22} color="#000000" />
                <Text className="text-black font-bold text-base ml-2">Accept</Text>
              </Pressable>
            )}
            {wish.status === "confirmed" && (
              <Pressable
                onPress={onMarkFulfilled}
                className="bg-green-500 py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="star" size={22} color="#FFFFFF" />
                <Text className="text-white font-bold text-base ml-2">Fulfilled</Text>
              </Pressable>
            )}
            {(wish.status === "accepted" || wish.status === "date_set" || wish.status === "confirmed") && (
              <Pressable
                onPress={onProposeDate}
                className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="calendar-outline" size={22} color="#000000" />
                <Text className="text-black font-semibold text-base ml-2">Propose Date</Text>
              </Pressable>
            )}
            {wish.status !== "fulfilled" && (
              <Pressable
                onPress={onOpenChat}
                className="bg-wishy-paleBlush py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="chatbubble-outline" size={22} color="#000000" />
                <Text className="text-black font-semibold text-base ml-2">Open Chat</Text>
              </Pressable>
            )}
            {wish.status === "fulfilled" && (
              <Pressable
                onPress={onOpenChat}
                className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="chatbubble-outline" size={22} color="#000000" />
                <Text className="text-black font-semibold text-base ml-2">Open Chat</Text>
              </Pressable>
            )}
            {wish.status === "sent" && (
              <Pressable
                onPress={onDecline}
                className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
              >
                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                <Text className="text-red-600 font-semibold text-sm ml-2">Decline</Text>
              </Pressable>
            )}
            <Pressable
              onPress={onDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">Delete</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </>
  );
}
