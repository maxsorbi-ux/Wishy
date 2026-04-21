import React from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Haptics from "expo-haptics";
import { cn } from "../utils/cn";
import { User } from "../types/wishy";
import { RootStackParamList } from "../navigation/RootNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface WishDirectionIndicatorProps {
  creator: User | undefined;
  target: User | undefined; // Deprecated: for backward compatibility
  targets?: User[]; // New: support multiple targets
  creatorRole: "wished" | "wisher";
  className?: string;
}

export function WishDirectionIndicator({
  creator,
  target,
  targets,
  creatorRole,
  className,
}: WishDirectionIndicatorProps) {
  const navigation = useNavigation<NavigationProp>();

  if (!creator) return null;

  // Use targets array if available, otherwise fall back to single target
  const targetUsers = targets && targets.length > 0 ? targets : (target ? [target] : []);

  const handleCreatorPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("UserProfile", { userId: creator.id });
  };

  const handleTargetPress = (targetUser: User) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("UserProfile", { userId: targetUser.id });
  };

  // Determine who is the wisher and who is the wished based on creatorRole
  const creatorIsWisher = creatorRole === "wisher";
  const creatorLabel = creatorIsWisher ? "WISHER" : "WISHED";
  const targetLabel = creatorIsWisher ? "WISHED" : "WISHER";
  const creatorBgColor = creatorIsWisher ? "bg-blue-100" : "bg-wishy-pink";
  const creatorTextColor = creatorIsWisher ? "text-blue-900" : "text-wishy-black";
  const targetBgColor = creatorIsWisher ? "bg-wishy-pink" : "bg-blue-100";
  const targetTextColor = creatorIsWisher ? "text-wishy-black" : "text-blue-900";

  return (
    <View className={cn("flex-row items-center justify-between py-4 px-5 bg-wishy-paleBlush/40 rounded-xl", className)}>
      {/* Creator */}
      <Pressable
        onPress={handleCreatorPress}
        className="items-center flex-1 active:opacity-70"
      >
        <View className="w-14 h-14 rounded-full bg-white items-center justify-center overflow-hidden border-2 border-wishy-pink">
          {creator.profilePhoto ? (
            <Image
              source={{ uri: creator.profilePhoto }}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="person" size={28} color="#8B2252" />
          )}
        </View>
        <Text className="text-wishy-black font-semibold text-xs mt-2" numberOfLines={1}>
          {creator.name}
        </Text>
        <View className={cn("px-2 py-0.5 rounded-full mt-1", creatorBgColor)}>
          <Text className={cn("text-[10px] font-medium", creatorTextColor)}>{creatorLabel}</Text>
        </View>
      </Pressable>

      {/* Arrow */}
      <View className="items-center mx-3">
        <Ionicons name="arrow-forward" size={24} color="#8B2252" />
      </View>

      {/* Targets */}
      {targetUsers.length > 0 ? (
        <View className="items-center flex-1">
          {/* Multiple avatars stacked */}
          <View className="flex-row -space-x-3 mb-2">
            {targetUsers.slice(0, 3).map((targetUser, index) => (
              <Pressable
                key={targetUser.id}
                onPress={() => handleTargetPress(targetUser)}
                style={{ zIndex: 10 - index }}
                className="active:opacity-70"
              >
                <View className="w-14 h-14 rounded-full bg-white items-center justify-center overflow-hidden border-2 border-wishy-darkPink">
                  {targetUser.profilePhoto ? (
                    <Image
                      source={{ uri: targetUser.profilePhoto }}
                      style={{ width: 56, height: 56 }}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={28} color="#FF8DC7" />
                  )}
                </View>
              </Pressable>
            ))}
            {targetUsers.length > 3 && (
              <View
                style={{ zIndex: 7 }}
                className="w-14 h-14 rounded-full bg-wishy-darkPink items-center justify-center border-2 border-white"
              >
                <Text className="text-white font-bold text-xs">+{targetUsers.length - 3}</Text>
              </View>
            )}
          </View>
          <Text className="text-wishy-black font-semibold text-xs" numberOfLines={1}>
            {targetUsers.length === 1 ? targetUsers[0].name : `${targetUsers.length} users`}
          </Text>
          <View className={cn("px-2 py-0.5 rounded-full mt-1", targetBgColor)}>
            <Text className={cn("text-[10px] font-medium", targetTextColor)}>{targetLabel}</Text>
          </View>
        </View>
      ) : (
        <View className="items-center flex-1">
          <View className="w-14 h-14 rounded-full bg-wishy-white border-2 border-dashed border-wishy-gray items-center justify-center">
            <Ionicons name="help-outline" size={28} color="#6B7280" />
          </View>
          <Text className="text-wishy-gray text-xs mt-2">Anyone</Text>
          <View className={cn("px-2 py-0.5 rounded-full mt-1 border border-wishy-gray", targetBgColor)}>
            <Text className={cn("text-[10px] font-medium", targetTextColor)}>{targetLabel}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
