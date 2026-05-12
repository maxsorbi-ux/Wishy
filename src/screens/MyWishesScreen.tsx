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
import { Wish, User, CATEGORY_LABELS, WISH_STATUS_LABELS } from "../types/wishy";
import { cn } from "../utils/cn";
import { WishOriginBadge } from "../components/WishOriginBadge";

type ReceivedFilter = "all" | "from-wisher" | "from-wished" | "from-user";

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
  const [receivedFilter, setReceivedFilter] = useState<ReceivedFilter>("all");
  const [filterUserId, setFilterUserId] = useState<string | null>(null);
  const [showUserFilterModal, setShowUserFilterModal] = useState(false);

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

  // Users who have sent received wishes (for the "from specific user" filter picker)
  const receivedWishCreators = React.useMemo(() => {
    const creatorIds = new Set(receivedWishes.map(w => w.creatorId));
    return allUsers.filter(u => creatorIds.has(u.id));
  }, [receivedWishes, allUsers]);

  // Apply sub-filter to received wishes
  const filteredReceivedWishes = React.useMemo(() => {
    switch (receivedFilter) {
      case "from-wisher":
        return receivedWishes.filter(w => w.creatorRole === "wisher");
      case "from-wished":
        return receivedWishes.filter(w => w.creatorRole === "wished");
      case "from-user":
        return filterUserId ? receivedWishes.filter(w => w.creatorId === filterUserId) : receivedWishes;
      default:
        return receivedWishes;
    }
  }, [receivedWishes, receivedFilter, filterUserId]);

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
      syncWishes();
    }, [syncWishes])
  );

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await syncWishes();
    setRefreshing(false);
  }, [syncWishes]);

  const handleCreateWish = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const mode = activeTab === "for-others" ? "portfolio" : "wishlist";
    navigation.navigate("CreateWish", { mode });
  };

  const handleWishPress = (wishId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("WishDetail", { wishId });
  };

  const switchTab = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    if (tab !== "received") {
      setReceivedFilter("all");
      setFilterUserId(null);
    }
  };

  const getDisplayedWishes = () => {
    switch (activeTab) {
      case "for-me":
        return wishesForMe;
      case "for-others":
        return wishesForOthers;
      case "received":
        return filteredReceivedWishes;
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
      {/* Tabs - Dynamically show based on user role */}
      <View
        style={{ paddingTop: insets.top }}
        className="flex-row px-4 py-3 border-b border-wishy-paleBlush"
      >
        {showWishList && (
          <Pressable
            onPress={() => switchTab("for-me")}
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
            onPress={() => switchTab("for-others")}
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
          onPress={() => switchTab("received")}
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

      {/* Received filter bar */}
      {activeTab === "received" && (
        <View className="border-b border-wishy-paleBlush py-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          >
            <Pressable
              onPress={() => { setReceivedFilter("all"); setFilterUserId(null); }}
              className={cn(
                "px-3 py-1.5 rounded-full border",
                receivedFilter === "all" ? "bg-purple-100 border-purple-400" : "bg-white border-wishy-paleBlush"
              )}
            >
              <Text className={cn("text-xs font-medium", receivedFilter === "all" ? "text-purple-900" : "text-wishy-gray")}>
                All ({receivedWishes.length})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => { setReceivedFilter("from-wisher"); setFilterUserId(null); }}
              className={cn(
                "px-3 py-1.5 rounded-full border",
                receivedFilter === "from-wisher" ? "bg-blue-100 border-blue-400" : "bg-white border-wishy-paleBlush"
              )}
            >
              <Text className={cn("text-xs font-medium", receivedFilter === "from-wisher" ? "text-blue-900" : "text-wishy-gray")}>
                From Wishers
              </Text>
            </Pressable>

            <Pressable
              onPress={() => { setReceivedFilter("from-wished"); setFilterUserId(null); }}
              className={cn(
                "px-3 py-1.5 rounded-full border",
                receivedFilter === "from-wished" ? "bg-wishy-pink border-wishy-darkPink" : "bg-white border-wishy-paleBlush"
              )}
            >
              <Text className={cn("text-xs font-medium", receivedFilter === "from-wished" ? "text-wishy-black" : "text-wishy-gray")}>
                From Wished
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowUserFilterModal(true)}
              className={cn(
                "px-3 py-1.5 rounded-full border flex-row items-center",
                receivedFilter === "from-user" ? "bg-wishy-paleBlush border-wishy-darkPink" : "bg-white border-wishy-paleBlush"
              )}
            >
              <Ionicons name="person-outline" size={12} color={receivedFilter === "from-user" ? "#8B2252" : "#9A8A8A"} />
              <Text className={cn("text-xs font-medium ml-1", receivedFilter === "from-user" ? "text-wishy-darkPink" : "text-wishy-gray")}>
                {receivedFilter === "from-user" && filterUserId
                  ? allUsers.find(u => u.id === filterUserId)?.name || "Person"
                  : "Person"}
              </Text>
              {receivedFilter === "from-user" && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setReceivedFilter("all");
                    setFilterUserId(null);
                  }}
                  className="ml-1"
                >
                  <Ionicons name="close-circle" size={14} color="#8B2252" />
                </Pressable>
              )}
            </Pressable>
          </ScrollView>
        </View>
      )}

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

      {/* User Filter Modal */}
      {showUserFilterModal && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          className="absolute inset-0 bg-black/50 justify-end"
          style={{ zIndex: 50 }}
        >
          <Pressable
            className="flex-1"
            onPress={() => setShowUserFilterModal(false)}
          />
          <View
            className="bg-wishy-white rounded-t-3xl"
            style={{ paddingBottom: insets.bottom }}
          >
            <View className="p-4 border-b border-wishy-paleBlush">
              <Text className="text-wishy-black font-bold text-lg text-center">
                Filter by Person
              </Text>
              <Text className="text-wishy-gray text-center text-sm mt-1">
                Show wishes received from a specific person
              </Text>
            </View>
            <ScrollView className="max-h-80">
              {receivedWishCreators.length === 0 ? (
                <View className="p-6 items-center">
                  <Text className="text-wishy-gray text-center">
                    No senders to filter by
                  </Text>
                </View>
              ) : (
                receivedWishCreators.map((user) => (
                  <Pressable
                    key={user.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setReceivedFilter("from-user");
                      setFilterUserId(user.id);
                      setShowUserFilterModal(false);
                    }}
                    className={cn(
                      "flex-row items-center p-4 border-b border-wishy-paleBlush active:bg-wishy-paleBlush/30",
                      filterUserId === user.id && "bg-wishy-paleBlush/30"
                    )}
                  >
                    {user.profilePhoto ? (
                      <Image
                        source={{ uri: user.profilePhoto }}
                        style={{ width: 40, height: 40 }}
                        className="rounded-full mr-3"
                      />
                    ) : (
                      <View className="w-10 h-10 rounded-full bg-wishy-paleBlush items-center justify-center mr-3">
                        <Ionicons name="person" size={20} color="#4A1528" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-wishy-black font-semibold">
                        {user.name}
                      </Text>
                      <Text className="text-wishy-gray text-xs mt-0.5 capitalize">
                        {user.role}
                      </Text>
                    </View>
                    {filterUserId === user.id && (
                      <Ionicons name="checkmark-circle" size={20} color="#4A1528" />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </Animated.View>
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
