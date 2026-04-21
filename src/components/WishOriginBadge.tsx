import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cn } from "../utils/cn";

interface WishOriginBadgeProps {
  createdByMe: boolean;
  isWished: boolean; // true if for me, false if for others
  proposedByUserName?: string;
  className?: string;
}

export function WishOriginBadge({
  createdByMe,
  isWished,
  proposedByUserName,
  className,
}: WishOriginBadgeProps) {
  if (createdByMe && isWished) {
    return (
      <View className={cn("flex-row items-center bg-wishy-pink/30 px-3 py-1.5 rounded-full", className)}>
        <Ionicons name="heart" size={14} color="#8B2252" />
        <Text className="text-wishy-black text-xs font-semibold ml-1.5">MY DESIRE</Text>
      </View>
    );
  }

  if (createdByMe && !isWished) {
    return (
      <View className={cn("flex-row items-center bg-blue-100 px-3 py-1.5 rounded-full", className)}>
        <Ionicons name="gift" size={14} color="#1E40AF" />
        <Text className="text-blue-900 text-xs font-semibold ml-1.5">MY PROPOSAL</Text>
      </View>
    );
  }

  if (!createdByMe && proposedByUserName) {
    return (
      <View className={cn("flex-row items-center bg-purple-100 px-3 py-1.5 rounded-full", className)}>
        <Ionicons name="arrow-down-circle" size={14} color="#6B21A8" />
        <Text className="text-purple-900 text-xs font-semibold ml-1.5">
          FROM {proposedByUserName.toUpperCase()}
        </Text>
      </View>
    );
  }

  return null;
}
