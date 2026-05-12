import React, { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, Modal, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import useUserStore from "../state/userStore";
import { supabaseStorage } from "../api/supabase";
import useWishStore from "../state/wishStore";
import useNotificationStore from "../state/notificationStore";
import useConnectionStore from "../state/connectionStore";
import { UserRole } from "../types/wishy";
import { cn } from "../utils/cn";
import { useModalState } from "../hooks/useModalState";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const currentUser = useUserStore((s) => s.currentUser);
  const updateUser = useUserStore((s) => s.updateUser);
  const logout = useUserStore((s) => s.logout);
  const deleteAccount = useUserStore((s) => s.deleteAccount);
  const getUserAverageRating = useWishStore((s) => s.getUserAverageRating);
  const wishes = useWishStore((s) => s.wishes);
  const hiddenWishes = useWishStore((s) => s.hiddenWishes);
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);
  const getRelationshipConnections = useConnectionStore((s) => s.getRelationshipConnections);
  const { show: showModal, hide: hideModal, isVisible } = useModalState(
    "photo", "enlargedPhoto", "role", "delete", "logout", "help", "viewGalleryPhoto"
  );
  const [galleryPhotoUri, setGalleryPhotoUri] = useState<string | null>(null);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);

  const unreadNotifications = getUnreadCount(currentUser?.id || "");

  const todayScheduledCount = useMemo(() => {
    if (!currentUser) return 0;
    return wishes.filter((w) => {
      if (!["accepted", "date_set", "confirmed"].includes(w.status)) return false;
      return (
        w.creatorId === currentUser.id ||
        w.targetUserId === currentUser.id ||
        (w.targetUserIds && w.targetUserIds.includes(currentUser.id))
      );
    }).length;
  }, [wishes, currentUser]);

  const userRating = React.useMemo(
    () => currentUser ? getUserAverageRating(currentUser.id) : { average: 0, praised: 0, total: 0 },
    [currentUser, getUserAverageRating, wishes]
  );

  // Calculate wish statistics - subscribe to wishes array for immediate updates
  const wishStats = React.useMemo(() => {
    if (!currentUser) return { forMe: 0, forOthers: 0, received: 0, fulfilled: 0, inProgress: 0 };

    const forMe = wishes.filter((wish) => {
      return wish.creatorId === currentUser.id && wish.creatorRole === "wished";
    });

    const forOthers = wishes.filter((wish) => {
      return wish.creatorId === currentUser.id && wish.creatorRole === "wisher";
    });

    const received = wishes.filter((wish) => {
      const isTargetedToMe =
        wish.targetUserId === currentUser.id ||
        (wish.targetUserIds && wish.targetUserIds.includes(currentUser.id));

      return (
        isTargetedToMe &&
        wish.creatorId !== currentUser.id &&
        !hiddenWishes.includes(wish.id)
      );
    });

    const allMyWishes = [...forMe, ...forOthers, ...received];
    const fulfilled = allMyWishes.filter(w => w.status === "fulfilled").length;
    const inProgress = allMyWishes.filter(w => w.status === "accepted" || w.status === "sent").length;

    return {
      forMe: forMe.length,
      forOthers: forOthers.length,
      received: received.length,
      fulfilled,
      inProgress,
    };
  }, [currentUser, wishes, hiddenWishes]);

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showModal("logout");
  };

  const confirmLogout = async () => {
    await logout();
    hideModal("logout");
    navigation.reset({
      index: 0,
      routes: [{ name: "Welcome" }],
    });
  };

  const handleQRCode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("QRCode");
  };

  const handleChangePhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showModal("photo");
  };

  const handleViewPhoto = () => {
    if (currentUser?.profilePhoto) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showModal("enlargedPhoto");
    }
  };

  const handleTakePhoto = async () => {
    hideModal("photo");
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser({ profilePhoto: result.assets[0].uri });
    }
  };

  const handleChoosePhoto = async () => {
    hideModal("photo");
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser({ profilePhoto: result.assets[0].uri });
    }
  };

  const handleRemovePhoto = () => {
    hideModal("photo");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateUser({ profilePhoto: undefined });
  };

  const handleAddGalleryPhoto = async () => {
    if ((currentUser?.photoGallery?.length ?? 0) >= 10) return;
    if (!currentUser) return;
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setIsUploadingGallery(true);
      try {
        const localUri = result.assets[0].uri;
        const filename = `${currentUser.id}/gallery_${Date.now()}.jpg`;
        const uploadResult = await supabaseStorage.uploadFromUri("avatar", filename, localUri);
        if (uploadResult.error || !uploadResult.data) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          const gallery = [...(currentUser.photoGallery ?? []), uploadResult.data.publicUrl];
          await updateUser({ photoGallery: gallery });
        }
      } finally {
        setIsUploadingGallery(false);
      }
    }
  };

  const handleRemoveGalleryPhoto = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const gallery = (currentUser?.photoGallery ?? []).filter((u) => u !== uri);
    updateUser({ photoGallery: gallery });
  };

  const handleViewGalleryPhoto = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGalleryPhotoUri(uri);
    showModal("viewGalleryPhoto");
  };

  const handleChangeRole = (newRole: UserRole) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateUser({ role: newRole });
    hideModal("role");
  };

  const handleEditProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("EditProfile");
  };

  const handleSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Settings");
  };

  const handleDeleteAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    showModal("delete");
  };

  const confirmDeleteAccount = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deleteAccount();
    hideModal("delete");
    navigation.reset({
      index: 0,
      routes: [{ name: "Welcome" }],
    });
  };

  if (!currentUser) {
    return (
      <View className="flex-1 bg-wishy-white items-center justify-center">
        <Text className="text-wishy-gray">No profile found</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-wishy-white">
      <ScrollView
        style={{ paddingTop: insets.top }}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Profile Header */}
      <Animated.View
        entering={FadeInDown.delay(100).duration(400)}
        className="items-center pt-6 pb-8 px-6"
      >
        <Pressable onPress={handleViewPhoto} className="relative">
        <View style={{ width: 200, height: 200, borderRadius: 100, overflow: "hidden", borderWidth: 4, borderColor: "#FFB6D9", backgroundColor: "#FFE5F1", alignItems: "center", justifyContent: "center" }}>
        {currentUser.profilePhoto ? (
              <Image
                source={{ uri: currentUser.profilePhoto }}
                style={{ width: 200, height: 200 }}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="person" size={120} color="#8B2252" />
            )}
          </View>
          <Pressable
            onPress={handleChangePhoto}
            className="absolute bottom-3 right-3 bg-wishy-black w-12 h-12 rounded-full items-center justify-center border-2 border-wishy-white"
          >
            <Ionicons name="camera" size={22} color="#FFB6D9" />
          </Pressable>
        </Pressable>
        <Text className="text-wishy-black font-bold text-2xl mt-4">
          {currentUser.name}
        </Text>
        {currentUser.bio && (
          <Text className="text-wishy-gray text-center mt-2 px-4">
            {currentUser.bio}
          </Text>
        )}

        {/* Role Badge */}
        <View className="flex-row mt-4 space-x-2">
          <View className="bg-wishy-black px-4 py-2 rounded-full flex-row items-center">
            <Ionicons name="sparkles" size={16} color="#D4AF37" />
            <Text className="text-wishy-white font-medium ml-2 capitalize">
              {currentUser.role === "both" ? "Wisher & Wished" : currentUser.role}
            </Text>
          </View>
          {currentUser.isElite && (
            <View className="bg-wishy-darkPink px-4 py-2 rounded-full">
              <Text className="text-wishy-black font-medium">Elite</Text>
            </View>
          )}
        </View>

        {/* Rating Display */}
        {userRating.total > 0 && (
          <View className="mt-4 w-full bg-wishy-paleBlush px-6 py-4 rounded-2xl border-2 border-wishy-pink">
            <View className="flex-row items-center justify-center mb-2">
              <Ionicons name="sparkles" size={20} color="#8B2252" />
              <Text className="text-wishy-black font-bold text-lg ml-2">
                Your Satisfaction Rating
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

        {/* Wishy Journey Statistics */}
        <View className="mt-4 w-full bg-white px-6 py-4 rounded-2xl border-2 border-wishy-paleBlush">
          <View className="flex-row items-center justify-center mb-4">
            <Ionicons name="stats-chart" size={20} color="#8B2252" />
            <Text className="text-wishy-black font-bold text-lg ml-2">
              Your Wishy Journey
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-1 bg-wishy-paleBlush/30 p-3 rounded-xl min-w-[45%]">
              <Text className="text-wishy-black font-bold text-2xl text-center">{wishStats.fulfilled}</Text>
              <Text className="text-wishy-gray text-xs text-center mt-1">Fulfilled</Text>
            </View>
            <View className="flex-1 bg-wishy-paleBlush/30 p-3 rounded-xl min-w-[45%]">
              <Text className="text-wishy-black font-bold text-2xl text-center">{wishStats.inProgress}</Text>
              <Text className="text-wishy-gray text-xs text-center mt-1">In Progress</Text>
            </View>
            <View className="flex-1 bg-wishy-paleBlush/30 p-3 rounded-xl min-w-[45%]">
              <Text className="text-wishy-black font-bold text-2xl text-center">{wishStats.forMe}</Text>
              <Text className="text-wishy-gray text-xs text-center mt-1">For Me</Text>
            </View>
            <View className="flex-1 bg-wishy-paleBlush/30 p-3 rounded-xl min-w-[45%]">
              <Text className="text-wishy-black font-bold text-2xl text-center">{wishStats.forOthers}</Text>
              <Text className="text-wishy-gray text-xs text-center mt-1">For Others</Text>
            </View>
            <View className="flex-1 bg-wishy-paleBlush/30 p-3 rounded-xl min-w-[45%]">
              <Text className="text-wishy-black font-bold text-2xl text-center">{wishStats.received}</Text>
              <Text className="text-wishy-gray text-xs text-center mt-1">Received</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Interests */}
      {currentUser.interests.length > 0 && (
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="px-6 mb-6"
        >
          <Text className="text-wishy-black font-semibold mb-3">Interests</Text>
          <View className="flex-row flex-wrap gap-2">
            {currentUser.interests.map((interest) => (
              <View
                key={interest}
                className="bg-white px-4 py-2 rounded-full border border-wishy-paleBlush"
              >
                <Text className="text-wishy-black text-sm">{interest}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Photo Album */}
      <Animated.View
        entering={FadeInDown.delay(250).duration(400)}
        className="px-6 mb-6"
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-wishy-black font-semibold">Photo Gallery</Text>
          <Text className="text-wishy-gray text-xs">
            {currentUser.photoGallery?.length ?? 0}/10
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {(currentUser.photoGallery ?? []).map((uri) => (
            <Pressable
              key={uri}
              onPress={() => handleViewGalleryPhoto(uri)}
              onLongPress={() => handleRemoveGalleryPhoto(uri)}
              className="active:opacity-80"
            >
              <Image
                source={{ uri }}
                style={{ width: 80, height: 80, borderRadius: 12 }}
                contentFit="cover"
              />
            </Pressable>
          ))}
          {(currentUser.photoGallery?.length ?? 0) < 10 && (
            <Pressable
              onPress={handleAddGalleryPhoto}
              disabled={isUploadingGallery}
              className="w-20 h-20 rounded-xl bg-wishy-paleBlush/50 border-2 border-dashed border-wishy-pink items-center justify-center active:opacity-70"
            >
              {isUploadingGallery ? (
                <View className="items-center gap-1">
                  <Ionicons name="cloud-upload-outline" size={22} color="#8B2252" />
                  <Text className="text-wishy-darkPink text-xs font-medium">Uploading</Text>
                </View>
              ) : (
                <Ionicons name="add" size={28} color="#8B2252" />
              )}
            </Pressable>
          )}
        </View>
        {(currentUser.photoGallery?.length ?? 0) > 0 && (
          <Text className="text-wishy-gray text-xs mt-2">Long press a photo to remove it</Text>
        )}
      </Animated.View>

      {/* Actions */}
      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        className="px-6"
      >
        <Text className="text-wishy-black font-semibold mb-3">Quick Actions</Text>

        {/* Calendar */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("Calendar");
          }}
          className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between border border-wishy-paleBlush active:opacity-80"
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-wishy-paleBlush rounded-full items-center justify-center mr-3">
              <Ionicons name="calendar" size={20} color="#4A1528" />
            </View>
            <Text className="text-wishy-black font-medium text-base">Calendar</Text>
            {todayScheduledCount > 0 && (
              <View className="ml-2 bg-wishy-pink rounded-full min-w-5 h-5 items-center justify-center px-1">
                <Text className="text-wishy-black text-xs font-bold">
                  {todayScheduledCount > 99 ? "99+" : todayScheduledCount}
                </Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable>

        {/* Notifications */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("Notifications");
          }}
          className="bg-white rounded-2xl p-4 mb-3 flex-row items-center justify-between border border-wishy-paleBlush active:opacity-80"
        >
          <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-wishy-paleBlush rounded-full items-center justify-center mr-3">
              <Ionicons name="notifications" size={20} color="#4A1528" />
            </View>
            <Text className="text-wishy-black font-medium text-base">Notifications</Text>
          </View>
          <View className="flex-row items-center">
            {unreadNotifications > 0 && (
              <View className="bg-wishy-pink px-2 py-0.5 rounded-full mr-2">
                <Text className="text-wishy-black text-xs font-semibold">
                  {unreadNotifications}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
          </View>
        </Pressable>

        {/* Edit Profile */}
        <Pressable
          onPress={handleEditProfile}
          className="bg-white rounded-xl p-4 flex-row items-center mb-3 active:opacity-95 border border-wishy-paleBlush"
        >
          <View className="w-10 h-10 bg-wishy-paleBlush rounded-xl items-center justify-center">
            <Ionicons name="create-outline" size={22} color="#8B2252" />
          </View>
          <Text className="flex-1 text-wishy-black font-medium ml-3">
            Edit Profile
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable>

        {/* Change Role Button */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            showModal("role");
          }}
          className="bg-white rounded-xl p-4 flex-row items-center mb-3 active:opacity-95 border border-wishy-paleBlush"
        >
          <View className="w-10 h-10 bg-wishy-paleBlush rounded-xl items-center justify-center">
            <Ionicons name="person-outline" size={22} color="#8B2252" />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-wishy-black font-medium">
              Change Role
            </Text>
            <Text className="text-wishy-gray text-xs mt-0.5">
              Currently: {currentUser.role === "both" ? "Wisher & Wished" : currentUser.role}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable>
{/* 
        <Pressable
          onPress={handleQRCode}
          className="bg-white rounded-xl p-4 flex-row items-center mb-3 active:opacity-95"
        >
          <View className="w-10 h-10 bg-wishy-paleBlush rounded-xl items-center justify-center">
            <Ionicons name="qr-code" size={22} color="#8B2252" />
          </View>
          <Text className="flex-1 text-wishy-black font-medium ml-3">
            My QR Code
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable> */}

        <Pressable
          onPress={handleSettings}
          className="bg-white rounded-xl p-4 flex-row items-center mb-3 active:opacity-95 border border-wishy-paleBlush"
        >
          <View className="w-10 h-10 bg-wishy-paleBlush rounded-xl items-center justify-center">
            <Ionicons name="settings-outline" size={22} color="#8B2252" />
          </View>
          <Text className="flex-1 text-wishy-black font-medium ml-3">
            Search Settings
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("Privacy");
          }}
          className="bg-white rounded-xl p-4 flex-row items-center mb-3 active:opacity-95 border border-wishy-paleBlush"
        >
          <View className="w-10 h-10 bg-wishy-paleBlush rounded-xl items-center justify-center">
            <Ionicons name="shield-outline" size={22} color="#8B2252" />
          </View>
          <Text className="flex-1 text-wishy-black font-medium ml-3">
            Privacy
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            showModal("help");
          }}
          className="bg-white rounded-xl p-4 flex-row items-center active:opacity-95"
        >
          <View className="w-10 h-10 bg-wishy-paleBlush rounded-xl items-center justify-center">
            <Ionicons name="help-circle-outline" size={22} color="#8B2252" />
          </View>
          <Text className="flex-1 text-wishy-black font-medium ml-3">
            Help & Support
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable>

        {/* Push Debug - for testing */}
        {/* <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.navigate("PushDebug");
          }}
          className="bg-gray-100 rounded-xl p-4 flex-row items-center mt-3 active:opacity-95 border border-gray-200"
        >
          <View className="w-10 h-10 bg-gray-200 rounded-xl items-center justify-center">
            <Ionicons name="bug-outline" size={22} color="#666" />
          </View>
          <Text className="flex-1 text-gray-700 font-medium ml-3">
            Push Debug
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
        </Pressable> */}
      </Animated.View>

      {/* Logout */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(400)}
        className="px-6 mt-8"
      >
        <Pressable
          onPress={handleLogout}
          className="py-4 rounded-xl items-center border border-wishy-pink active:opacity-90 mb-3"
        >
          <Text className="text-wishy-black font-semibold">Log Out</Text>
        </Pressable>

        {/* Delete Account */}
        <Pressable
          onPress={handleDeleteAccount}
          className="py-4 rounded-xl items-center border-2 border-red-200 bg-red-50 active:opacity-90"
        >
          <Text className="text-red-600 font-semibold">Delete Account</Text>
        </Pressable>
      </Animated.View>

      {/* Photo Options Modal */}
      <Modal
        visible={isVisible("photo")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("photo")}
      >
        <Pressable
          onPress={() => hideModal("photo")}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-t-3xl p-6"
            >
              <View className="w-12 h-1 bg-wishy-paleBlush rounded-full self-center mb-6" />

              <Text className="text-wishy-black font-bold text-xl mb-6 text-center">
                Profile Photo
              </Text>

              <Pressable
                onPress={handleTakePhoto}
                className="bg-wishy-pink/20 rounded-xl p-4 flex-row items-center mb-3 active:opacity-80"
              >
                <View className="w-10 h-10 bg-wishy-pink rounded-xl items-center justify-center">
                  <Ionicons name="camera" size={22} color="#000000" />
                </View>
                <Text className="flex-1 text-wishy-black font-medium ml-3">
                  Take Photo
                </Text>
              </Pressable>

              <Pressable
                onPress={handleChoosePhoto}
                className="bg-wishy-pink/20 rounded-xl p-4 flex-row items-center mb-3 active:opacity-80"
              >
                <View className="w-10 h-10 bg-wishy-pink rounded-xl items-center justify-center">
                  <Ionicons name="images" size={22} color="#000000" />
                </View>
                <Text className="flex-1 text-wishy-black font-medium ml-3">
                  Choose from Library
                </Text>
              </Pressable>

              {currentUser?.profilePhoto && (
                <Pressable
                  onPress={handleRemovePhoto}
                  className="bg-red-50 rounded-xl p-4 flex-row items-center mb-3 active:opacity-80"
                >
                  <View className="w-10 h-10 bg-red-100 rounded-xl items-center justify-center">
                    <Ionicons name="trash-outline" size={22} color="#DC2626" />
                  </View>
                  <Text className="flex-1 text-red-600 font-medium ml-3">
                    Remove Photo
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => hideModal("photo")}
                className="mt-2 py-4 rounded-xl items-center active:opacity-80"
              >
                <Text className="text-wishy-gray font-medium">Cancel</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Enlarged Photo Modal */}
      <Modal
        visible={isVisible("enlargedPhoto")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("enlargedPhoto")}
      >
        <Pressable
          onPress={() => hideModal("enlargedPhoto")}
          className="flex-1 bg-black/90 items-center justify-center"
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="w-full px-6"
          >
            {currentUser?.profilePhoto && (
              <Image
                source={{ uri: currentUser.profilePhoto }}
                style={{ width: "100%", aspectRatio: 1, borderRadius: 20 }}
                contentFit="contain"
              />
            )}
          </Animated.View>

          <Pressable
            onPress={() => hideModal("enlargedPhoto")}
            className="absolute top-12 right-6 w-10 h-10 bg-wishy-white/20 rounded-full items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        visible={isVisible("role")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("role")}
      >
        <Pressable
          onPress={() => hideModal("role")}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-[90%] max-w-md"
            >
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
                  <Ionicons name="person" size={32} color="#8B2252" />
                </View>
                <Text className="text-wishy-black font-bold text-2xl mb-2 text-center">
                  Change Your Role
                </Text>
                <Text className="text-wishy-gray text-center text-sm">
                  Select the role that best describes how you want to use Wishy
                </Text>
              </View>

              {/* Role Options */}
              <View className="gap-3 mb-4">
                {/* Wished */}
                <Pressable
                  onPress={() => handleChangeRole("wished")}
                  className={cn(
                    "p-4 rounded-2xl border-2 active:opacity-80",
                    currentUser.role === "wished"
                      ? "bg-wishy-paleBlush border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-wishy-black font-bold text-lg">Wished</Text>
                    {currentUser.role === "wished" && (
                      <Ionicons name="checkmark-circle" size={24} color="#8B2252" />
                    )}
                  </View>
                  <Text className="text-wishy-gray text-sm">
                    Share your desires and let others fulfill them
                  </Text>
                </Pressable>

                {/* Wisher */}
                <Pressable
                  onPress={() => handleChangeRole("wisher")}
                  className={cn(
                    "p-4 rounded-2xl border-2 active:opacity-80",
                    currentUser.role === "wisher"
                      ? "bg-wishy-paleBlush border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-wishy-black font-bold text-lg">Wisher</Text>
                    {currentUser.role === "wisher" && (
                      <Ionicons name="checkmark-circle" size={24} color="#8B2252" />
                    )}
                  </View>
                  <Text className="text-wishy-gray text-sm">
                    Discover wishes to fulfill and create meaningful moments
                  </Text>
                </Pressable>

                {/* Both */}
                <Pressable
                  onPress={() => handleChangeRole("both")}
                  className={cn(
                    "p-4 rounded-2xl border-2 active:opacity-80",
                    currentUser.role === "both"
                      ? "bg-wishy-paleBlush border-wishy-darkPink"
                      : "bg-white border-wishy-paleBlush"
                  )}
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-wishy-black font-bold text-lg">Wisher & Wished</Text>
                    {currentUser.role === "both" && (
                      <Ionicons name="checkmark-circle" size={24} color="#8B2252" />
                    )}
                  </View>
                  <Text className="text-wishy-gray text-sm">
                    Experience the full Wishy journey - share and fulfill wishes
                  </Text>
                </Pressable>
              </View>

              {/* Cancel Button */}
              <Pressable
                onPress={() => hideModal("role")}
                className="py-3 rounded-xl items-center border-2 border-wishy-paleBlush active:opacity-80"
              >
                <Text className="text-wishy-black font-semibold">Cancel</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={isVisible("delete")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("delete")}
      >
        <Pressable
          onPress={() => hideModal("delete")}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-80"
            >
              <View className="items-center mb-4">
                <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                  <Ionicons name="warning" size={32} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2 text-center">
                  Delete Account?
                </Text>
                <Text className="text-wishy-gray text-center text-sm">
                  This action cannot be undone. All your wishes, connections, and data will be permanently deleted.
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => hideModal("delete")}
                  className="flex-1 py-3 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDeleteAccount}
                  className="flex-1 py-3 rounded-xl items-center bg-red-600 active:opacity-90"
                >
                  <Text className="text-white font-semibold">Delete</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Help & Support Modal */}
      <Modal
        visible={isVisible("help")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("help")}
      >
        <Pressable
          onPress={() => hideModal("help")}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-80"
            >
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
                  <Ionicons name="help-circle" size={32} color="#8B2252" />
                </View>
                <Text className="text-wishy-black font-bold text-xl text-center">
                  Help & Support
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Linking.openURL("mailto:wishydevelop@gmail.com");
                }}
                className="bg-wishy-paleBlush/50 rounded-2xl p-4 flex-row items-center active:opacity-80 border border-wishy-pink/30"
              >
                <View className="w-10 h-10 bg-wishy-pink rounded-xl items-center justify-center mr-3">
                  <Ionicons name="mail" size={20} color="#4A1528" />
                </View>
                <View className="flex-1">
                  <Text className="text-wishy-black font-medium">Contact Support</Text>
                  <Text className="text-wishy-gray text-xs mt-0.5">wishydevelop@gmail.com</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => hideModal("help")}
                className="mt-4 py-3 rounded-xl items-center border border-wishy-paleBlush active:opacity-80"
              >
                <Text className="text-wishy-black font-semibold">Close</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gallery Full-Screen Viewer */}
      <Modal
        visible={isVisible("viewGalleryPhoto")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("viewGalleryPhoto")}
      >
        <Pressable
          onPress={() => hideModal("viewGalleryPhoto")}
          className="flex-1 bg-black/90 items-center justify-center"
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="w-full px-6"
          >
            {galleryPhotoUri && (
              <Image
                source={{ uri: galleryPhotoUri }}
                style={{ width: "100%", aspectRatio: 1, borderRadius: 20 }}
                contentFit="contain"
              />
            )}
          </Animated.View>
          <Pressable
            onPress={() => hideModal("viewGalleryPhoto")}
            className="absolute top-12 right-6 w-10 h-10 bg-wishy-white/20 rounded-full items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={isVisible("logout")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("logout")}
      >
        <Pressable
          onPress={() => hideModal("logout")}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-80"
            >
              <View className="items-center mb-4">
                <View className="w-16 h-16 bg-wishy-paleBlush rounded-full items-center justify-center mb-3">
                  <Ionicons name="log-out-outline" size={32} color="#8B2252" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2 text-center">
                  Log Out?
                </Text>
                <Text className="text-wishy-gray text-center text-sm">
                  You will be redirected to the welcome screen and can log in with a different account.
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => hideModal("logout")}
                  className="flex-1 py-3 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmLogout}
                  className="flex-1 py-3 rounded-xl items-center bg-wishy-pink active:opacity-90"
                >
                  <Text className="text-wishy-black font-semibold">Log Out</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
    </View>
  );
}
