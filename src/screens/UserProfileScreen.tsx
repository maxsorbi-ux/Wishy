import React, { useMemo, useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, Linking, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useUserStore from "../state/userStore";
import useWishStore from "../state/wishStore";
import useConnectionStore from "../state/connectionStore";
import { Wish, CATEGORY_LABELS, WISH_STATUS_LABELS } from "../types/wishy";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type UserProfileRouteProp = RouteProp<RootStackParamList, "UserProfile">;

export default function UserProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<UserProfileRouteProp>();
  const insets = useSafeAreaInsets();

  const allUsers = useUserStore((s) => s.allUsers);
  const currentUser = useUserStore((s) => s.currentUser);
  const fetchUserProfile = useUserStore((s) => s.fetchUserProfile);
  const wishes = useWishStore((s) => s.wishes);
  const hiddenWishes = useWishStore((s) => s.hiddenWishes);
  const getUserAverageRating = useWishStore((s) => s.getUserAverageRating);
  const getAcceptedConnections = useConnectionStore((s) => s.getAcceptedConnections);

  const [selectedTab, setSelectedTab] = useState<"overview" | "wishlist" | "portfolio">("overview");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "sent" | "accepted_pending" | "fulfilled" | "rejected">("all");
  const [showEnlargedPhoto, setShowEnlargedPhoto] = useState(false);
  const [selectedGalleryPhoto, setSelectedGalleryPhoto] = useState<string | null>(null);

  const user = allUsers.find((u) => u.id === route.params.userId);

  useEffect(() => {
    fetchUserProfile(route.params.userId);
  }, [route.params.userId]);

  // Check if users are connected
  const isConnected = useMemo(() => {
    if (!currentUser || !user) return false;
    const connections = getAcceptedConnections(currentUser.id);
    return connections.some(
      (conn) => conn.senderId === user.id || conn.receiverId === user.id
    );
  }, [currentUser, user, getAcceptedConnections]);


  // Check if users are in a relationship
  const isRelationship = useMemo(() => {
    if (!currentUser || !user) return false;
    const connections = getAcceptedConnections(currentUser.id);
    return connections.some(
      (conn) =>
        conn.type === "relationship" &&
        (conn.senderId === user.id || conn.receiverId === user.id)
    );
  }, [currentUser, user, getAcceptedConnections]);
  const canView = (field: keyof NonNullable<typeof user>["privacySettings"]): boolean => {
    if (!user) return false;
    const ps = user.privacySettings;
    if (!ps) return true;
    const visibility = ps[field];
    if (visibility === "public") return true;
    if (visibility === "friends") return !isRelationship;
    if (visibility === "relationship") return isRelationship;
    return true;
  };


  // Get all wishes between me and this user (bidirectional)
  const wishesBetweenUs = useMemo(() => {
    if (!currentUser || !user) return [];
    return wishes.filter((wish) => {
      // Check if this wish involves both users
      const isCreatedByMe = wish.creatorId === currentUser.id;
      const isCreatedByThem = wish.creatorId === user.id;

      // Check if target is me or them (supporting both single and array targets)
      const targetsMe = wish.targetUserId === currentUser.id ||
                        (wish.targetUserIds && wish.targetUserIds.includes(currentUser.id));
      const targetsThem = wish.targetUserId === user.id ||
                          (wish.targetUserIds && wish.targetUserIds.includes(user.id));

      // Include wish if it's between us (either direction) and not hidden
      const isBetweenUs = (isCreatedByMe && targetsThem) || (isCreatedByThem && targetsMe);

      return isBetweenUs && !hiddenWishes.includes(wish.id);
    });
  }, [wishes, currentUser, user, hiddenWishes]);

  // Get wishes shared with me by this user (for backward compatibility)
  const wishesSharedWithMe = useMemo(() => {
    if (!currentUser || !user) return [];
    return wishes.filter(
      (wish) =>
        wish.creatorId === user.id &&
        (wish.targetUserId === currentUser.id ||
         (wish.targetUserIds && wish.targetUserIds.includes(currentUser.id))) &&
        !hiddenWishes.includes(wish.id)
    );
  }, [wishes, currentUser, user, hiddenWishes]);

  // Calculate statistics from all wishes between us
  const statistics = useMemo(() => {
    const proposed = wishesBetweenUs.filter((w) => w.status === "sent").length;
    const acceptedPending = wishesBetweenUs.filter(
      (w) => w.status === "accepted" || w.status === "date_set" || w.status === "confirmed"
    ).length;
    const completed = wishesBetweenUs.filter((w) => w.status === "fulfilled").length;
    const declined = wishesBetweenUs.filter((w) => w.status === "rejected").length;

    return {
      proposed,
      acceptedPending,
      completed,
      declined,
      total: wishesBetweenUs.length,
    };
  }, [wishesBetweenUs]);

  // Get filtered wishes based on selected filter
  const filteredWishes = useMemo(() => {
    if (selectedFilter === "all") return wishesBetweenUs;
    if (selectedFilter === "sent") {
      return wishesBetweenUs.filter((w) => w.status === "sent");
    }
    if (selectedFilter === "accepted_pending") {
      return wishesBetweenUs.filter(
        (w) => w.status === "accepted" || w.status === "date_set" || w.status === "confirmed"
      );
    }
    if (selectedFilter === "fulfilled") {
      return wishesBetweenUs.filter((w) => w.status === "fulfilled");
    }
    if (selectedFilter === "rejected") {
      return wishesBetweenUs.filter((w) => w.status === "rejected");
    }
    return wishesBetweenUs;
  }, [wishesBetweenUs, selectedFilter]);

  // Get user's wishlist (only wishes shared with me or public)
  const userWishlist = useMemo(() => {
    if (!user) return [];
    return wishes.filter(
      (wish) =>
        wish.creatorId === user.id &&
        wish.creatorRole === "wished" &&
        (wish.visibility === "public" ||
          (currentUser && wish.targetUserId === currentUser.id))
    );
  }, [wishes, user, currentUser]);

  // Get user's portfolio (only wishes shared with me or public)
  const userPortfolio = useMemo(() => {
    if (!user) return [];
    return wishes.filter(
      (wish) =>
        wish.creatorId === user.id &&
        wish.creatorRole === "wisher" &&
        (wish.visibility === "public" ||
          (currentUser && wish.targetUserId === currentUser.id))
    );
  }, [wishes, user, currentUser]);

  // Get user rating statistics
  const userRating = useMemo(() => {
    if (!user) return { average: 0, praised: 0, total: 0 };
    return getUserAverageRating(user.id);
  }, [user, getUserAverageRating]);

  // Get user's relationship connections (only "relationship" type)
  const userRelationships = useMemo(() => {
    if (!user) return [];
    const connections = getAcceptedConnections(user.id);
    return connections
      .filter((conn) => conn.type === "relationship")
      .map((conn) => {
        const friendId = conn.senderId === user.id ? conn.receiverId : conn.senderId;
        const friend = allUsers.find((u) => u.id === friendId);
        return { connection: conn, user: friend };
      })
      .filter((item) => item.user !== undefined);
  }, [user, getAcceptedConnections, allUsers]);

  if (!user) {
    return (
      <View className="flex-1 bg-wishy-white items-center justify-center">
        <Text className="text-wishy-gray">User not found</Text>
      </View>
    );
  }

  const StatCard = ({
    label,
    count,
    icon,
    color,
    onPress,
  }: {
    label: string;
    count: number;
    icon: string;
    color: string;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      disabled={!onPress}
      className={cn(
        "flex-1 bg-white rounded-xl p-4 border-2",
        onPress && "active:opacity-70"
      )}
      style={{ borderColor: color }}
    >
      <View className="flex-row items-center justify-between mb-2">
        <Ionicons name={icon as any} size={24} color={color} />
        <Text className="font-bold text-2xl" style={{ color }}>
          {count}
        </Text>
      </View>
      <Text className="text-wishy-gray text-sm">{label}</Text>
    </Pressable>
  );

  const WishCard = ({ wish }: { wish: Wish }) => (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate("WishDetail", { wishId: wish.id });
      }}
      className="bg-white rounded-xl overflow-hidden mb-3 border border-wishy-paleBlush active:opacity-70"
    >
      {wish.image && (
        <Image
          source={{ uri: wish.image }}
          style={{ width: "100%", height: 160 }}
          contentFit="cover"
        />
      )}
      <View className="p-4">
        <View className="flex-row items-center justify-between mb-2">
          <View className="bg-wishy-paleBlush px-3 py-1 rounded-full">
            <Text className="text-wishy-black text-xs font-medium">
              {wish.customCategory || CATEGORY_LABELS[wish.category]}
            </Text>
          </View>
          <View
            className={cn(
              "px-3 py-1 rounded-full",
              wish.status === "fulfilled" ? "bg-wishy-darkPink" :
              wish.status === "confirmed" ? "bg-wishy-pink" :
              wish.status === "date_set" ? "bg-wishy-pink" :
              wish.status === "accepted" ? "bg-wishy-pink" :
              wish.status === "sent" ? "bg-wishy-paleBlush" :
              wish.status === "rejected" ? "bg-black" : "bg-gray-100"
            )}
          >
            <Text
              className={cn(
                "text-xs font-medium",
                wish.status === "fulfilled" ? "text-white" :
                wish.status === "confirmed" ? "text-white" :
                wish.status === "date_set" ? "text-white" :
                wish.status === "accepted" ? "text-white" :
                wish.status === "sent" ? "text-wishy-darkPink" :
                wish.status === "rejected" ? "text-white" : "text-gray-700"
              )}
            >
              {WISH_STATUS_LABELS[wish.status] || wish.status}
            </Text>
          </View>
        </View>
        <Text className="text-wishy-black font-semibold text-lg">
          {wish.title}
        </Text>
        <Text className="text-wishy-gray text-sm mt-1" numberOfLines={2}>
          {wish.description}
        </Text>
        {wish.location && (
          <View className="flex-row items-center mt-2">
            <Ionicons name="location-outline" size={14} color="#9A8A8A" />
            <Text className="text-wishy-gray text-xs ml-1">{wish.location}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-wishy-white">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-wishy-pink px-6 pb-6"
      >
        <View className="flex-row items-center justify-between mt-4">
          <Pressable onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={28} color="#000000" />
          </Pressable>
          <Text className="text-wishy-black font-bold text-xl">Profile</Text>
          <View style={{ width: 28 }} />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="items-center pt-6 pb-6 px-6"
        >
          <Pressable
            onPress={() => {
              if (user.profilePhoto) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowEnlargedPhoto(true);
              }
            }}
          >
            <View style={{ width: 200, height: 200, borderRadius: 100, overflow: "hidden", borderWidth: 4, borderColor: "#FFB6D9", backgroundColor: "#FFE5F1", alignItems: "center", justifyContent: "center" }}>
              {user.profilePhoto ? (
                <Image
                  source={{ uri: user.profilePhoto }}
                  style={{ width: 200, height: 200 }}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="person" size={80} color="#8B2252" />
              )}
            </View>
          </Pressable>
          <Text className="text-wishy-black font-bold text-2xl mt-4">
            {user.name}
          </Text>
          {user.bio && canView("bio") && (
            <Text className="text-wishy-gray text-center mt-2 px-4">
              {user.bio}
            </Text>
          )}
          {user.bio && !canView("bio") && (
            <Text className="text-wishy-gray/50 text-center mt-2 px-4 italic text-sm">
              Bio is private
            </Text>
          )}

          {/* Role Badge */}
          <View className="flex-row mt-4 space-x-2">
            <View className="bg-wishy-black px-4 py-2 rounded-full flex-row items-center">
              <Ionicons name="sparkles" size={16} color="#D4AF37" />
              <Text className="text-wishy-white font-medium ml-2 capitalize">
                {user.role === "both" ? "Wisher & Wished" : user.role}
              </Text>
            </View>
            {user.isElite && (
              <View className="bg-wishy-darkPink px-4 py-2 rounded-full">
                <Text className="text-wishy-black font-medium">Elite</Text>
              </View>
            )}
          </View>


         

          {/* Rating Display */}
          {userRating.total > 0 && (
            <View className="mt-4 bg-wishy-paleBlush px-6 py-4 rounded-2xl border-2 border-wishy-pink">
              <View className="flex-row items-center justify-center mb-2">
                <Ionicons name="sparkles" size={20} color="#8B2252" />
                <Text className="text-wishy-black font-bold text-lg ml-2">
                  Satisfaction Rating
                </Text>
              </View>
              <View className="flex-row items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((wand) => (
                  <Ionicons
                    key={wand}
                    name="sparkles"
                    size={24}
                    color={userRating.average >= wand ? "#8B2252" : "#E5E7EB"}
                  />
                ))}
              </View>
              <Text className="text-center text-wishy-gray text-base mt-2">
                {userRating.average.toFixed(1)} / 5.0 ({userRating.total} {userRating.total === 1 ? "review" : "reviews"})
              </Text>
              {userRating.praised > 0 && (
                <View className="flex-row items-center justify-center mt-2">
                  <Ionicons name="heart" size={18} color="#D4536B" />
                  <Text className="text-wishy-black font-medium ml-2">
                    {userRating.praised} {userRating.praised === 1 ? "heart" : "hearts"} received
                  </Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Connection Status Warning */}
        {!isConnected && (
          <Animated.View
            entering={FadeInDown.delay(150).duration(400)}
            className="px-6 mb-4"
          >
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex-row items-center">
              <Ionicons name="information-circle" size={24} color="#F59E0B" />
              <Text className="text-yellow-800 ml-3 flex-1 text-sm">
                Connect with this user to see their full profile and wishes
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Show detailed info only if connected */}
        {isConnected && (
          <>
            {/* Tab Navigation */}
            <Animated.View
              entering={FadeInDown.delay(200).duration(400)}
              className="px-6 mb-4"
            >
              <View className="flex-row bg-wishy-paleBlush/30 rounded-xl p-1">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedTab("overview");
                  }}
                  className={cn(
                    "flex-1 py-3 rounded-lg",
                    selectedTab === "overview" && "bg-wishy-white"
                  )}
                >
                  <Text
                    className={cn(
                      "text-center font-semibold",
                      selectedTab === "overview"
                        ? "text-wishy-black"
                        : "text-wishy-gray"
                    )}
                  >
                    Overview
                  </Text>
                </Pressable>
                {(user.role === "both" || user.role === "wished") && canView("wishList") && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedTab("wishlist");
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-lg",
                      selectedTab === "wishlist" && "bg-wishy-white"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-center font-semibold",
                        selectedTab === "wishlist"
                          ? "text-wishy-black"
                          : "text-wishy-gray"
                      )}
                    >
                      Wishlist
                    </Text>
                  </Pressable>
                )}
                {(user.role === "both" || user.role === "wisher") && canView("wishPortfolio") && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedTab("portfolio");
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-lg",
                      selectedTab === "portfolio" && "bg-wishy-white"
                    )}
                  >
                    <Text
                      className={cn(
                        "text-center font-semibold",
                        selectedTab === "portfolio"
                          ? "text-wishy-black"
                          : "text-wishy-gray"
                      )}
                    >
                      Portfolio
                    </Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>

            {/* Overview Tab */}
            {selectedTab === "overview" && (
              <>
                {/* About Section */}
                {(canView("bio") || canView("age") || canView("gender") || canView("relationshipPreferences") || canView("interests") || canView("location") || canView("email") || (user.photoGallery.length > 0 && canView("gallery"))) && (
                  <Animated.View entering={FadeInDown.delay(220).duration(400)} className="px-6 mb-6">
                    <Text className="text-wishy-black font-bold text-lg mb-3">About</Text>
                    <View className="bg-white rounded-2xl p-4 border border-wishy-paleBlush gap-3">

                      {canView("bio") && user.bio && (
                        <View className="flex-row items-start">
                          <Ionicons name="person-outline" size={18} color="#8B2252" />
                          <Text className="text-wishy-black ml-3 flex-1 text-sm">{user.bio}</Text>
                        </View>
                      )}

                      {canView("gender") && (user.gender ) && (
                        <View className="flex-row items-center">
                          <Ionicons name="body-outline" size={18} color="#8B2252" />
                          <Text className="text-wishy-black ml-3 text-sm">
                            {user.gender ? `${user.gender}` : null}
                          </Text>
                        </View>
                      )}
                       {canView("age") && (user.age) && (
                        <View className="flex-row items-center">
                          <Ionicons name="body-outline" size={18} color="#8B2252" />
                          <Text className="text-wishy-black ml-3 text-sm">
                            {user.age ? `${user.age} yrs` : null}
                          </Text>
                        </View>
                      )}

                      {canView("relationshipPreferences") && user.relationshipPreference && (
                        <View className="flex-row items-center">
                          <Ionicons name="heart-outline" size={18} color="#8B2252" />
                          <Text className="text-wishy-black ml-3 text-sm capitalize">
                            {user.customRelationshipPreference || user.relationshipPreference}
                          </Text>
                        </View>
                      )}

                      {canView("location") && user.location && (
                        <View className="flex-row items-center">
                          <Ionicons name="location-outline" size={18} color="#8B2252" />
                          <Text className="text-wishy-black ml-3 text-sm">{user.location}</Text>
                        </View>
                      )}

                      {canView("email") && (
                        <View className="flex-row items-center">
                          <Ionicons name="mail-outline" size={18} color="#8B2252" />
                          <Text className="text-wishy-black ml-3 text-sm">{user.email}</Text>
                        </View>
                      )}

                      {canView("interests") && user.interests.length > 0 && (
                        <View>
                          <View className="flex-row items-center mb-2">
                            <Ionicons name="star-outline" size={18} color="#8B2252" />
                            <Text className="text-wishy-black ml-3 text-sm font-medium">Interests</Text>
                          </View>
                          <View className="flex-row flex-wrap gap-2 pl-7">
                            {user.interests.map((interest) => (
                              <View key={interest} className="bg-wishy-paleBlush/60 px-3 py-1 rounded-full">
                                <Text className="text-wishy-black text-xs">{interest}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {user.photoGallery.length > 0 && canView("gallery") && (
                        <View>
                          <View className="flex-row items-center mb-2">
                            <Ionicons name="images-outline" size={18} color="#8B2252" />
                            <Text className="text-wishy-black ml-3 text-sm font-medium">
                              Photo Gallery ({user.photoGallery.length})
                            </Text>
                          </View>
                          <View className="flex-row flex-wrap gap-2 pl-7">
                            {user.photoGallery.slice(0, 6).map((uri, i) => (
                              <Pressable
                                key={i}
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setSelectedGalleryPhoto(uri);
                                }}
                                className="w-20 h-20 rounded-xl overflow-hidden bg-wishy-paleBlush active:opacity-80"
                              >
                                <Image source={{ uri }} style={{ width: 80, height: 80 }} contentFit="cover" />
                              </Pressable>
                            ))}
                            {user.photoGallery.length > 6 && (
                              <Pressable
                                onPress={() => {
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  setSelectedGalleryPhoto(user.photoGallery[6]);
                                }}
                                className="w-20 h-20 rounded-xl overflow-hidden bg-wishy-paleBlush items-center justify-center active:opacity-80"
                              >
                                <Text className="text-wishy-black font-bold text-sm">
                                  +{user.photoGallery.length - 6}
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        </View>
                      )}

                    </View>
                  </Animated.View>
                )}

                {/* Statistics Section */}
                <Animated.View
                  entering={FadeInDown.delay(250).duration(400)}
                  className="px-6 mb-6"
                >
                  <Text className="text-wishy-black font-bold text-lg mb-3">
                    Our Wish Journey
                  </Text>
                  <Text className="text-wishy-gray text-sm mb-4">
                    Tap on a statistic to view related wishes
                  </Text>

                  <View className="flex-row gap-2 mb-3">
                    <StatCard
                      label="Proposed"
                      count={statistics.proposed}
                      icon="mail"
                      color="#FFB6D9"
                      onPress={() => setSelectedFilter("sent")}
                    />
                    <StatCard
                      label="In Progress"
                      count={statistics.acceptedPending}
                      icon="time"
                      color="#8B2252"
                      onPress={() => setSelectedFilter("accepted_pending")}
                    />
                  </View>

                  <View className="flex-row gap-2">
                    <StatCard
                      label="Fulfilled"
                      count={statistics.completed}
                      icon="checkmark-circle"
                      color="#D4536B"
                      onPress={() => setSelectedFilter("fulfilled")}
                    />
                    <StatCard
                      label="Declined"
                      count={statistics.declined}
                      icon="close-circle"
                      color="#4A1528"
                      onPress={() => setSelectedFilter("rejected")}
                    />
                  </View>
                </Animated.View>

                {/* Filtered Wishes List */}
                {selectedFilter !== "all" && (
                  <Animated.View
                    entering={FadeInDown.delay(300).duration(400)}
                    className="px-6 mb-6"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-wishy-black font-bold text-lg">
                        {selectedFilter === "sent" && "Proposed Wishes"}
                        {selectedFilter === "accepted_pending" && "In Progress"}
                        {selectedFilter === "fulfilled" && "Fulfilled Wishes"}
                        {selectedFilter === "rejected" && "Declined Wishes"}
                      </Text>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedFilter("all");
                        }}
                        className="px-3 py-1 bg-wishy-paleBlush rounded-full"
                      >
                        <Text className="text-wishy-black text-sm font-medium">
                          Clear
                        </Text>
                      </Pressable>
                    </View>
                    {filteredWishes.length === 0 ? (
                      <View className="bg-wishy-paleBlush/30 rounded-xl p-6 items-center">
                        <Ionicons name="folder-open-outline" size={48} color="#9A8A8A" />
                        <Text className="text-wishy-gray mt-2 text-center">
                          No wishes in this category
                        </Text>
                      </View>
                    ) : (
                      filteredWishes.map((wish) => (
                        <WishCard key={wish.id} wish={wish} />
                      ))
                    )}
                  </Animated.View>
                )}

                {/* All Wishes Between Us */}
                {selectedFilter === "all" && (
                  <Animated.View
                    entering={FadeInDown.delay(300).duration(400)}
                    className="px-6 mb-6"
                  >
                    <Text className="text-wishy-black font-bold text-lg mb-3">
                      All Wishes Between Us ({wishesBetweenUs.length})
                    </Text>
                    {wishesBetweenUs.length === 0 ? (
                      <View className="bg-wishy-paleBlush/30 rounded-xl p-6 items-center">
                        <Ionicons name="gift-outline" size={48} color="#9A8A8A" />
                        <Text className="text-wishy-gray mt-2 text-center">
                          No wishes shared yet
                        </Text>
                      </View>
                    ) : (
                      wishesBetweenUs.map((wish) => (
                        <WishCard key={wish.id} wish={wish} />
                      ))
                    )}
                  </Animated.View>
                )}
              </>
            )}

            {/* Wishlist Tab */}
            {selectedTab === "wishlist" && (
              <Animated.View
                entering={FadeInDown.delay(250).duration(400)}
                className="px-6 mb-6"
              >
                <Text className="text-wishy-black font-bold text-lg mb-3">
                  {user.name}&apos;s Wishlist ({userWishlist.length})
                </Text>
                <Text className="text-wishy-gray text-sm mb-4">
                  Wishes that {user.name} wants to experience
                </Text>
                {userWishlist.length === 0 ? (
                  <View className="bg-wishy-paleBlush/30 rounded-xl p-6 items-center">
                    <Ionicons name="heart-outline" size={48} color="#9A8A8A" />
                    <Text className="text-wishy-gray mt-2 text-center">
                      No wishes in wishlist
                    </Text>
                  </View>
                ) : (
                  userWishlist.map((wish) => <WishCard key={wish.id} wish={wish} />)
                )}
              </Animated.View>
            )}

            {/* Portfolio Tab */}
            {selectedTab === "portfolio" && (
              <Animated.View
                entering={FadeInDown.delay(250).duration(400)}
                className="px-6 mb-6"
              >
                <Text className="text-wishy-black font-bold text-lg mb-3">
                  {user.name}&apos;s Portfolio ({userPortfolio.length})
                </Text>
                <Text className="text-wishy-gray text-sm mb-4">
                  Wishes that {user.name} offers to fulfill
                </Text>
                {userPortfolio.length === 0 ? (
                  <View className="bg-wishy-paleBlush/30 rounded-xl p-6 items-center">
                    <Ionicons name="briefcase-outline" size={48} color="#9A8A8A" />
                    <Text className="text-wishy-gray mt-2 text-center">
                      No wishes in portfolio
                    </Text>
                  </View>
                ) : (
                  userPortfolio.map((wish) => <WishCard key={wish.id} wish={wish} />)
                )}
              </Animated.View>
            )}
          </>
        )}

        {/* Interests */}
        {/* {user.interests.length > 0 && canView("interests") && (
          <Animated.View
            entering={FadeInDown.delay(isConnected ? 400 : 200).duration(400)}
            className="px-6 mb-6"
          >
            <Text className="text-wishy-black font-semibold mb-3">Interests</Text>
            <View className="flex-row flex-wrap gap-2">
              {user.interests.map((interest) => (
                <View
                  key={interest}
                  className="bg-white px-4 py-2 rounded-full border border-wishy-paleBlush"
                >
                  <Text className="text-wishy-black text-sm">{interest}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )} */}

        {/* Photo Gallery */}
        {/* {user.photoGallery.length > 0 && isConnected && (
            <Animated.View
              entering={FadeInDown.delay(isConnected ? 450 : 250).duration(400)}
              className="px-6 mb-6"
            >
              <Text className="text-wishy-black font-semibold mb-3">Gallery</Text>
              <View className="flex-row flex-wrap gap-2">
                {user.photoGallery.map((photo, index) => (
                  <View
                    key={index}
                    className="w-[31%] aspect-square rounded-xl overflow-hidden bg-wishy-paleBlush"
                  >
                    <Image
                      source={{ uri: photo }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                    />
                  </View>
                ))}
              </View>
            </Animated.View>
          )} */}

        {/* Contact Info */}
        {/* {(canView("email") || (user.location && canView("location"))) && (
          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            className="px-6 mb-6"
          >
            <Text className="text-wishy-black font-semibold mb-3">Contact</Text>
            <View className="bg-white rounded-xl p-4 border border-wishy-paleBlush">
              {canView("email") && (
                <View className="flex-row items-center">
                  <Ionicons name="mail" size={20} color="#8B2252" />
                  <Text className="text-wishy-black ml-3">{user.email}</Text>
                </View>
              )}
              {user.location && canView("location") && (
                <View className="flex-row items-center mt-3">
                  <Ionicons name="location" size={20} color="#8B2252" />
                  <Text className="text-wishy-black ml-3">{user.location}</Text>
                </View>
              )}
              {user.socialLinks?.instagram && (
                <Pressable
                  onPress={() => {
                    const instagram = user.socialLinks?.instagram;
                    if (!instagram) return;
                    const url = instagram.startsWith("http")
                      ? instagram
                      : `https://instagram.com/${instagram}`;
                    Linking.openURL(url);
                  }}
                  className="flex-row items-center mt-3 active:opacity-70"
                >
                  <Ionicons name="logo-instagram" size={20} color="#8B2252" />
                  <Text className="text-wishy-black ml-3 underline">
                    {user.socialLinks?.instagram}
                  </Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        )} */}

        {/* In a Relationship Section */}
        {userRelationships.length > 0 && (
          <Animated.View
            entering={FadeInDown.delay(isConnected ? 550 : 300).duration(400)}
            className="px-6 mb-6"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Ionicons name="heart" size={20} color="#8B2252" />
                <Text className="text-wishy-black font-semibold ml-2">
                  In a Relationship ({userRelationships.length})
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }}
            >
              {userRelationships.map(({ connection, user: friend }) => {
                if (!friend) return null;

                return (
                  <Pressable
                    key={connection.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      navigation.navigate("UserProfile", { userId: friend.id });
                    }}
                    className="items-center w-24 active:opacity-70"
                  >
                    <View className="w-20 h-20 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
                      {friend.profilePhoto ? (
                        <Image
                          source={{ uri: friend.profilePhoto }}
                          style={{ width: 80, height: 80 }}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="person" size={32} color="#8B2252" />
                      )}
                    </View>
                    <Text
                      className="text-wishy-black text-sm font-medium mt-2 text-center"
                      numberOfLines={2}
                    >
                      {friend.name}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="heart" size={10} color="#8B2252" />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}
      </ScrollView>

      {/* Enlarged Profile Photo Modal */}
      <Modal
        visible={showEnlargedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEnlargedPhoto(false)}
      >
        <Pressable
          onPress={() => setShowEnlargedPhoto(false)}
          className="flex-1 bg-black/90 items-center justify-center"
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="w-full px-6"
          >
            {user?.profilePhoto && (
              <Image
                source={{ uri: user.profilePhoto }}
                style={{ width: "100%", aspectRatio: 1, borderRadius: 20 }}
                contentFit="contain"
              />
            )}
          </Animated.View>
          <Pressable
            onPress={() => setShowEnlargedPhoto(false)}
            className="absolute top-12 right-6 w-10 h-10 bg-wishy-white/20 rounded-full items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gallery Photo Fullscreen Modal */}
      <Modal
        visible={!!selectedGalleryPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedGalleryPhoto(null)}
      >
        <Pressable
          onPress={() => setSelectedGalleryPhoto(null)}
          className="flex-1 bg-black/90 items-center justify-center"
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="w-full px-4"
          >
            {selectedGalleryPhoto && (
              <Image
                source={{ uri: selectedGalleryPhoto }}
                style={{ width: "100%", aspectRatio: 1, borderRadius: 16 }}
                contentFit="contain"
              />
            )}
          </Animated.View>
          {/* Navigation arrows if gallery has multiple photos */}
          {user.photoGallery.length > 1 && selectedGalleryPhoto && (
            <>
              {user.photoGallery.indexOf(selectedGalleryPhoto) > 0 && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    const idx = user.photoGallery.indexOf(selectedGalleryPhoto);
                    setSelectedGalleryPhoto(user.photoGallery[idx - 1]);
                  }}
                  className="absolute left-4 w-10 h-10 bg-wishy-white/20 rounded-full items-center justify-center"
                >
                  <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
                </Pressable>
              )}
              {user.photoGallery.indexOf(selectedGalleryPhoto) < user.photoGallery.length - 1 && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    const idx = user.photoGallery.indexOf(selectedGalleryPhoto);
                    setSelectedGalleryPhoto(user.photoGallery[idx + 1]);
                  }}
                  className="absolute right-4 w-10 h-10 bg-wishy-white/20 rounded-full items-center justify-center"
                >
                  <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
                </Pressable>
              )}
              <View className="absolute bottom-8 flex-row gap-2">
                {user.photoGallery.map((_, i) => (
                  <View
                    key={i}
                    className={cn(
                      "rounded-full",
                      user.photoGallery.indexOf(selectedGalleryPhoto) === i
                        ? "w-3 h-3 bg-white"
                        : "w-2 h-2 bg-white/40"
                    )}
                  />
                ))}
              </View>
            </>
          )}
          <Pressable
            onPress={() => setSelectedGalleryPhoto(null)}
            className="absolute top-12 right-6 w-10 h-10 bg-wishy-white/20 rounded-full items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
