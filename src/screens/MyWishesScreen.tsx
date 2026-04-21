import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useWishStore from "../state/wishStore";
import useUserStore from "../state/userStore";
import { Wish, CATEGORY_LABELS, WISH_STATUS_LABELS } from "../types/wishy";
import { cn } from "../utils/cn";
import { WishOriginBadge } from "../components/WishOriginBadge";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type TabType = "for-me" | "for-others" | "received";

export default function MyWishesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const syncWishes = useWishStore((s) => s.syncWishes);
  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);

  // Subscribe directly to wishes array for immediate updates
  const wishes = useWishStore((s) => s.wishes);
  const hiddenWishes = useWishStore((s) => s.hiddenWishes);

  const [refreshing, setRefreshing] = useState(false);

  const userId = currentUser?.id || "";
  const userRole = currentUser?.role || "both";

  // Compute filtered wishes locally - will update immediately when wishes change
  const wishesForMe = wishes.filter((wish) => {
    return wish.creatorId === userId && wish.creatorRole === "wished";
  });

  const wishesForOthers = wishes.filter((wish) => {
    return wish.creatorId === userId && wish.creatorRole === "wisher";
  });

  const receivedWishes = wishes.filter((wish) => {
    const isTargetedToMe =
      wish.targetUserId === userId ||
      (wish.targetUserIds && wish.targetUserIds.includes(userId));

    return (
      isTargetedToMe &&
      wish.creatorId !== userId &&
      !hiddenWishes.includes(wish.id)
    );
  });

  // Determine which tabs should be visible based on user role
  const showWishList = userRole === "wished" || userRole === "both";
  const showPortfolio = userRole === "wisher" || userRole === "both";

  // Determine the default active tab based on role
  const getDefaultTab = (): TabType => {
    if (userRole === "wished") return "for-me";
    if (userRole === "wisher") return "for-others";
    return "for-me"; // both users default to "for-me"
  };

  const [activeTab, setActiveTab] = useState<TabType>(getDefaultTab());

  // Effect to handle role changes - ensure active tab is valid
  useEffect(() => {
    // If user switches to "wished" role and current tab is "for-others", switch to "for-me"
    if (userRole === "wished" && activeTab === "for-others") {
      setActiveTab("for-me");
    }
    // If user switches to "wisher" role and current tab is "for-me", switch to "for-others"
    if (userRole === "wisher" && activeTab === "for-me") {
      setActiveTab("for-others");
    }
  }, [userRole, activeTab]);

  // Sync wishes when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("MyWishesScreen: Focus - syncing wishes...");
      syncWishes();
    }, [syncWishes])
  );

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    console.log("MyWishesScreen: Pull to refresh...");
    setRefreshing(true);
    await syncWishes();
    setRefreshing(false);
  }, [syncWishes]);

  const handleCreateWish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const mode = activeTab === "for-others" ? "portfolio" : "wishlist";
    navigation.navigate("CreateWish", { mode });
  };

  const handleLogoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Landing");
  };

  const handleWishPress = (wishId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("WishDetail", { wishId });
  };

  const getDisplayedWishes = () => {
    switch (activeTab) {
      case "for-me":
        return wishesForMe;
      case "for-others":
        return wishesForOthers;
      case "received":
        return receivedWishes;
      default:
        return [];
    }
  };

  const displayedWishes = getDisplayedWishes();

  const getEmptyState = () => {
    switch (activeTab) {
      case "for-me":
        return {
          icon: "heart-outline" as const,
          title: "No wishes yet",
          description: "Start adding wishes you would love to have fulfilled",
        };
      case "for-others":
        return {
          icon: "gift-outline" as const,
          title: "No proposals yet",
          description: "Create offers and experiences you want to share with others",
        };
      case "received":
        return {
          icon: "mail-outline" as const,
          title: "No proposals received",
          description: "When others send you wish proposals, they will appear here",
        };
      default:
        return {
          icon: "star-outline" as const,
          title: "No wishes",
          description: "Start creating wishes",
        };
    }
  };

  const emptyState = getEmptyState();

  // Count unread received wishes
  const unreadCount = receivedWishes.filter(w => w.status === "sent").length;

  return (
    <View className="flex-1 bg-wishy-white">
      {/* Home Icon - Top Left Corner */}
      <Pressable
        onPress={handleLogoPress}
        style={{ position: "absolute", top: insets.top + 8, left: 12, zIndex: 50 }}
        className="w-9 h-9 bg-wishy-white rounded-full items-center justify-center active:opacity-70 shadow-md border border-wishy-paleBlush"
      >
        <Ionicons name="home" size={20} color="#8B2252" />
      </Pressable>

      {/* Tabs - Dynamically show based on user role */}
      <View
        style={{ paddingTop: insets.top }}
        className="flex-row px-4 py-3 border-b border-wishy-paleBlush"
      >
        {showWishList && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("for-me");
            }}
            className={cn(
              "flex-1 py-3 rounded-xl",
              showPortfolio ? "mr-1.5" : "mr-2",
              activeTab === "for-me" ? "bg-wishy-pink" : "bg-white"
            )}
          >
            <Text
              className={cn(
                "text-center font-semibold text-sm",
                activeTab === "for-me" ? "text-wishy-black" : "text-wishy-gray"
              )}
            >
              Wish list
            </Text>
            <Text
              className={cn(
                "text-center text-xs mt-0.5",
                activeTab === "for-me" ? "text-wishy-black/70" : "text-wishy-gray"
              )}
            >
              ({wishesForMe.length})
            </Text>
          </Pressable>
        )}

        {showPortfolio && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("for-others");
            }}
            className={cn(
              "flex-1 py-3 rounded-xl",
              showWishList ? "mx-1.5" : "mr-2",
              activeTab === "for-others" ? "bg-blue-100" : "bg-white"
            )}
          >
            <Text
              className={cn(
                "text-center font-semibold text-sm",
                activeTab === "for-others" ? "text-blue-900" : "text-wishy-gray"
              )}
            >
              Wish portfolio
            </Text>
            <Text
              className={cn(
                "text-center text-xs mt-0.5",
                activeTab === "for-others" ? "text-blue-700" : "text-wishy-gray"
              )}
            >
              ({wishesForOthers.length})
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab("received");
          }}
          className={cn(
            "flex-1 py-3 rounded-xl relative",
            showWishList || showPortfolio ? "ml-1.5" : "",
            activeTab === "received" ? "bg-purple-100" : "bg-white"
          )}
        >
          <Text
            className={cn(
              "text-center font-semibold text-sm",
              activeTab === "received" ? "text-purple-900" : "text-wishy-gray"
            )}
          >
            Received
          </Text>
          <Text
            className={cn(
              "text-center text-xs mt-0.5",
              activeTab === "received" ? "text-purple-700" : "text-wishy-gray"
            )}
          >
            ({receivedWishes.length})
          </Text>
          {unreadCount > 0 && (
            <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
              <Text className="text-white text-[10px] font-bold">{unreadCount}</Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8B2252"
            colors={["#8B2252"]}
          />
        }
      >
        {displayedWishes.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View className="w-20 h-20 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
              <Ionicons
                name={emptyState.icon}
                size={40}
                color="#8B2252"
              />
            </View>
            <Text className="text-wishy-black font-semibold text-lg">
              {emptyState.title}
            </Text>
            <Text className="text-wishy-gray text-center mt-2 px-8">
              {emptyState.description}
            </Text>
          </View>
        ) : (
          displayedWishes.map((wish, index) => {
            const proposerUser = wish.creatorId !== userId
              ? allUsers.find(u => u.id === wish.creatorId)
              : undefined;

            return (
              <Animated.View
                key={wish.id}
                entering={FadeInDown.delay(index * 80).duration(400)}
              >
                <CompactWishCard
                  wish={wish}
                  onPress={() => handleWishPress(wish.id)}
                  isOwn={wish.creatorId === userId}
                  proposerName={proposerUser?.name}
                />
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* FAB - Only show for "For Me" and "For Others" tabs */}
      {activeTab !== "received" && (
        <Pressable
          onPress={handleCreateWish}
          className="absolute bottom-6 right-6 w-14 h-14 bg-wishy-black rounded-full items-center justify-center shadow-lg active:opacity-90"
        >
          <Ionicons name="add" size={28} color="#FFF8F0" />
        </Pressable>
      )}
    </View>
  );
}

function CompactWishCard({
  wish,
  onPress,
  isOwn,
  proposerName
}: {
  wish: Wish;
  onPress: () => void;
  isOwn: boolean;
  proposerName?: string;
}) {
  const isWished = wish.creatorRole === "wished";

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl overflow-hidden flex-row active:opacity-95 border border-wishy-paleBlush"
    >
      {wish.image && (
        <Image
          source={{ uri: wish.image }}
          style={{ width: 100, height: 120 }}
          contentFit="cover"
        />
      )}
      <View className="flex-1 p-3 justify-center">
        {/* Origin Badge */}
        <WishOriginBadge
          createdByMe={isOwn}
          isWished={isWished}
          proposedByUserName={proposerName}
          className="mb-2"
        />

        {/* Category and Status */}
        <View className="flex-row items-center mb-2">
          <View className="bg-wishy-paleBlush px-2 py-0.5 rounded-full">
            <Text className="text-wishy-black text-xs">
              {CATEGORY_LABELS[wish.category]}
            </Text>
          </View>
          <View className={cn(
            "ml-2 px-2 py-0.5 rounded-full",
            wish.status === "fulfilled" ? "bg-wishy-darkPink" :
            wish.status === "confirmed" ? "bg-wishy-pink" :
            wish.status === "date_set" ? "bg-wishy-pink" :
            wish.status === "accepted" ? "bg-wishy-pink" :
            wish.status === "sent" ? "bg-wishy-paleBlush" :
            wish.status === "rejected" ? "bg-black" : "bg-gray-100"
          )}>
            <Text className={cn(
              "text-xs",
              wish.status === "fulfilled" ? "text-white" :
              wish.status === "confirmed" ? "text-white" :
              wish.status === "date_set" ? "text-white" :
              wish.status === "accepted" ? "text-white" :
              wish.status === "sent" ? "text-wishy-darkPink" :
              wish.status === "rejected" ? "text-white" : "text-wishy-gray"
            )}>
              {WISH_STATUS_LABELS[wish.status] || wish.status}
            </Text>
          </View>
        </View>

        <Text className="text-wishy-black font-semibold" numberOfLines={1}>
          {wish.title}
        </Text>
        <Text className="text-wishy-gray text-sm mt-1" numberOfLines={2}>
          {wish.description}
        </Text>
      </View>
    </Pressable>
  );
}
