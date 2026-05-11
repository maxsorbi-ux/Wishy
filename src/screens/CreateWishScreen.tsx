import React, { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import useWishStore from "../state/wishStore";
import useUserStore from "../state/userStore";
import useConnectionStore from "../state/connectionStore";
import useNotificationStore from "../state/notificationStore";
import { useToastStore } from "../state/toastStore";
import { WishCategory, CATEGORY_LABELS } from "../types/wishy";
import { cn } from "../utils/cn";
import { useModalState } from "../hooks/useModalState";
import LocationAutocomplete from "../components/LocationAutocomplete";
import {
  sendWishReceivedNotification,
  sendWishEditedNotification,
} from "../api/pushNotifications";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "CreateWish">;
type CreateWishRouteProp = RouteProp<RootStackParamList, "CreateWish">;

const CATEGORIES: WishCategory[] = [
  "dining", "travel", "experience", "gift", "entertainment", "wellness", "adventure", "romantic", "custom"
];

export default function CreateWishScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CreateWishRouteProp>();
  const initialMode = route.params?.mode || "wishlist";
  const editWishId = route.params?.editWishId;

  const addWish = useWishStore((s) => s.addWish);
  const updateWish = useWishStore((s) => s.updateWish);
  const getWishById = useWishStore((s) => s.getWishById);
  const addToWishList = useWishStore((s) => s.addToWishList);
  const addToPortfolio = useWishStore((s) => s.addToPortfolio);
  const removeFromWishList = useWishStore((s) => s.removeFromWishList);
  const removeFromPortfolio = useWishStore((s) => s.removeFromPortfolio);
  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const getAcceptedConnections = useConnectionStore((s) => s.getAcceptedConnections);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const showToast = useToastStore((s) => s.showToast);

  // Get existing wish if editing
  const existingWish = editWishId ? getWishById(editWishId) : undefined;
  const isEditMode = !!existingWish;

  const [title, setTitle] = useState(existingWish?.title || "");
  const [description, setDescription] = useState(existingWish?.description || "");
  const [category, setCategory] = useState<WishCategory>(existingWish?.category || "experience");
  const [customCategory, setCustomCategory] = useState(existingWish?.customCategory || "");
  const [image, setImage] = useState<string | undefined>(existingWish?.image);
  const [location, setLocation] = useState(existingWish?.location || "");
  const [locationPlaceId, setLocationPlaceId] = useState<string | undefined>(undefined);
  const [links, setLinks] = useState<string[]>(existingWish?.links && existingWish.links.length > 0 ? existingWish.links : [""]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    existingWish?.targetUserIds || (existingWish?.targetUserId ? [existingWish.targetUserId] : [])
  );
  const { show: showModal, hide: hideModal, isVisible } = useModalState("userPicker", "imagePicker", "camera");
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const cameraRef = React.useRef<any>(null);
  const [saveAsRole, setSaveAsRole] = useState<"wished" | "wisher" | null>(null);

  // Get connected users - show all connected users regardless of role
  // The role filtering was causing issues where users couldn't see their connections
  const connectedUsers = React.useMemo(() => {
    if (!currentUser) return [];
    const connections = getAcceptedConnections(currentUser.id);

    const connectedUserIds = connections.map((conn) =>
      conn.senderId === currentUser.id ? conn.receiverId : conn.senderId
    );

    // Show all connected users - don't filter by role
    const filteredUsers = allUsers.filter((user) => {
      return connectedUserIds.includes(user.id);
    });


    return filteredUsers;
  }, [currentUser, getAcceptedConnections, allUsers]);

  const handlePickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImage(result.assets[0].uri);
      hideModal("imagePicker");
    }
  };

  const handleTakePhoto = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Permission required", "Camera access is needed to take photos");
        return;
      }
    }
    hideModal("imagePicker");
    showModal("camera");
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      setImage(photo.uri);
      hideModal("camera");
    }
  };

  const handleAddLink = () => {
    setLinks([...links, ""]);
  };

  const handleRemoveLink = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks.length > 0 ? newLinks : [""]);
  };

  const handleLinkChange = (text: string, index: number) => {
    const newLinks = [...links];
    newLinks[index] = text;
    setLinks(newLinks);
  };

  const handleLocationPress = () => {
    if (location.trim()) {
      const encodedLocation = encodeURIComponent(location.trim());
      const url = Platform.OS === "ios"
        ? `maps://app?q=${encodedLocation}`
        : `geo:0,0?q=${encodedLocation}`;
      Linking.openURL(url).catch(() => {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`);
      });
    }
  };

  const handleCreate = async (role: "wished" | "wisher") => {
    if (!title.trim() || !currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const filteredLinks = links.filter(link => link.trim().length > 0);

    if (isEditMode && existingWish) {
      // Edit mode - update existing wish
      const roleChanged = existingWish.creatorRole !== role;

      await updateWish(existingWish.id, {
        title: title.trim(),
        description: description.trim(),
        category,
        customCategory: category === "custom" ? customCategory.trim() : undefined,
        image,
        links: filteredLinks.length > 0 ? filteredLinks : undefined,
        location: location.trim() || undefined,
        targetUserIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
        targetUserId: selectedUserIds.length > 0 ? selectedUserIds[0] : undefined, // Backward compatibility
        creatorRole: role,
        status: selectedUserIds.length > 0 && (!existingWish.targetUserIds || existingWish.targetUserIds.length === 0) && !existingWish.targetUserId ? "sent" : existingWish.status,
        updatedAt: Date.now(),
      });

      // Handle role change - update wishlist/portfolio membership
      if (roleChanged) {
        if (role === "wished") {
          // Changed to wished: remove from portfolio, add to wishlist
          removeFromPortfolio(existingWish.id);
          addToWishList(existingWish.id);
        } else {
          // Changed to wisher: remove from wishlist, add to portfolio
          removeFromWishList(existingWish.id);
          addToPortfolio(existingWish.id);
        }
      }

      // If targetUserIds was added (wish was sent to someone new), create notifications
      if (selectedUserIds.length > 0 && (!existingWish.targetUserIds || existingWish.targetUserIds.length === 0) && !existingWish.targetUserId) {
        selectedUserIds.forEach((userId) => {
          const recipientUser = allUsers.find(u => u.id === userId);
          if (recipientUser) {
            if (role === "wisher") {
              addNotification(
                userId,
                "wish_received",
                "New Wish Offer!",
                `${currentUser.name} wants to fulfill a wish for you: "${title.trim()}"`,
                existingWish.id
              );
            } else {
              addNotification(
                userId,
                "wish_received",
                "New Wish Request!",
                `${currentUser.name} sent you a wish to fulfill: "${title.trim()}"`,
                existingWish.id
              );
            }

            // Push notification for new send
            sendWishReceivedNotification(
              userId,
              currentUser.name,
              title.trim(),
              existingWish.id
            );
          }
        });
      } else if (existingWish.targetUserId) {
        // Wish was already sent - notify recipient about the edit
        sendWishEditedNotification(
          existingWish.targetUserId,
          currentUser.name,
          title.trim(),
          existingWish.id
        );
      }
    } else {
      // Create mode - add new wish
      const wishId = await addWish({
        title: title.trim(),
        description: description.trim(),
        category,
        customCategory: category === "custom" ? customCategory.trim() : undefined,
        tags: [],
        image,
        links: filteredLinks.length > 0 ? filteredLinks : undefined,
        location: location.trim() || undefined,
        isOnline: false,
        status: selectedUserIds.length > 0 ? "sent" : "created",
        creatorId: currentUser.id,
        creatorRole: role,
        targetUserIds: selectedUserIds.length > 0 ? selectedUserIds : undefined,
        targetUserId: selectedUserIds.length > 0 ? selectedUserIds[0] : undefined, // Backward compatibility
        visibility: "public",
      });

      // If recipients are selected, create notifications
      if (selectedUserIds.length > 0) {
        selectedUserIds.forEach((userId) => {
          const recipientUser = allUsers.find(u => u.id === userId);
          if (recipientUser) {
            if (role === "wisher") {
              // Wisher sending to Wished
              addNotification(
                userId,
                "wish_received",
                "New Wish Offer!",
                `${currentUser.name} wants to fulfill a wish for you: "${title.trim()}"`,
                wishId
              );
            } else {
              // Wished sending to Wisher
              addNotification(
                userId,
                "wish_received",
                "New Wish Request!",
                `${currentUser.name} sent you a wish to fulfill: "${title.trim()}"`,
                wishId
              );
            }

            // Push notification
            sendWishReceivedNotification(
              userId,
              currentUser.name,
              title.trim(),
              wishId
            );
          }
        });
      }

      if (role === "wished") {
        addToWishList(wishId);
      } else {
        addToPortfolio(wishId);
      }
    }

    navigation.goBack();

    // Show success toast
    if (isEditMode) {
      showToast("Wish updated successfully!");
    } else {
      showToast("Wish created successfully!");
    }
  };

  const isValid = title.trim().length > 0 && (category !== "custom" || customCategory.trim().length > 0);

  // Camera View
  if (isVisible("camera")) {
    return (
      <View className="flex-1 bg-black">
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={facing}
        >
          <View style={{ paddingTop: insets.top }} className="absolute top-0 left-0 right-0 z-10">
            <View className="flex-row items-center justify-between px-4 py-3">
              <Pressable
                onPress={() => hideModal("camera")}
                className="w-10 h-10 items-center justify-center bg-black/50 rounded-full"
              >
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setFacing(facing === "back" ? "front" : "back")}
                className="w-10 h-10 items-center justify-center bg-black/50 rounded-full"
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
          <View style={{ paddingBottom: insets.bottom + 20 }} className="absolute bottom-0 left-0 right-0 items-center">
            <Pressable
              onPress={capturePhoto}
              className="w-20 h-20 rounded-full bg-white border-4 border-wishy-pink"
            />
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-wishy-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={{ paddingTop: insets.top }} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-wishy-paleBlush">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="close" size={24} color="#4A1528" />
          </Pressable>
          <Text className="text-wishy-black font-semibold text-lg">
            {isEditMode ? "Edit Wish" : "Create Wish"}
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image Picker */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <Pressable
              onPress={() => showModal("imagePicker")}
              className="bg-white rounded-2xl overflow-hidden border border-wishy-paleBlush mb-6"
            >
              {image ? (
                <View>
                  <Image
                    source={{ uri: image }}
                    style={{ width: "100%", height: 200 }}
                    contentFit="cover"
                  />
                  <Pressable
                    onPress={() => setImage(undefined)}
                    className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full items-center justify-center"
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View className="h-48 items-center justify-center">
                  <Ionicons name="image-outline" size={48} color="#9A8A8A" />
                  <Text className="text-wishy-gray mt-2">Add a cover image</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>

          {/* Title */}
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <Text className="text-wishy-black font-semibold mb-2">Title *</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What do you wish for?"
              placeholderTextColor="#9A8A8A"
              className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush"
            />
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mt-4">
            <Text className="text-wishy-black font-semibold mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your wish in detail..."
              placeholderTextColor="#9A8A8A"
              multiline
              numberOfLines={4}
              className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush min-h-[100px]"
              textAlignVertical="top"
            />
          </Animated.View>

          {/* Category */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)} className="mt-4">
            <Text className="text-wishy-black font-semibold mb-3">Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setCategory(cat);
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full",
                    category === cat
                      ? "bg-wishy-black"
                      : "bg-white border border-wishy-paleBlush"
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      category === cat ? "text-wishy-white" : "text-wishy-black"
                    )}
                  >
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          {/* Custom Category Input */}
          {category === "custom" && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mt-4">
              <Text className="text-wishy-black font-semibold mb-2">Custom Category Name *</Text>
              <TextInput
                value={customCategory}
                onChangeText={setCustomCategory}
                placeholder="Enter category name"
                placeholderTextColor="#9A8A8A"
                className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush"
              />
            </Animated.View>
          )}

          {/* Location */}
          <Animated.View entering={FadeInDown.delay(350).duration(400)} className="mt-4">
            <Text className="text-wishy-black font-semibold mb-2">Location (optional)</Text>
            <LocationAutocomplete
              value={location}
              onChangeText={setLocation}
              onSelectLocation={(loc, placeId) => {
                setLocation(loc);
                setLocationPlaceId(placeId);
              }}
              placeholder="Search for a city or place..."
            />
            {location.trim().length > 0 && (
              <Pressable
                onPress={handleLocationPress}
                className="flex-row items-center mt-2 active:opacity-70"
              >
                <Ionicons name="open-outline" size={14} color="#8B2252" />
                <Text className="text-wishy-darkPink text-xs ml-1 underline">
                  View on map
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Links */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mt-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-wishy-black font-semibold">Links (optional)</Text>
              <Pressable
                onPress={handleAddLink}
                className="flex-row items-center"
              >
                <Ionicons name="add-circle" size={20} color="#4A1528" />
                <Text className="text-wishy-black ml-1 text-sm">Add Link</Text>
              </Pressable>
            </View>
            {links.map((link, index) => (
              <View key={index} className="flex-row items-center mb-3">
                <TextInput
                  value={link}
                  onChangeText={(text) => handleLinkChange(text, index)}
                  placeholder="https://example.com"
                  placeholderTextColor="#9A8A8A"
                  className="bg-white p-4 rounded-xl text-wishy-black text-base border border-wishy-paleBlush flex-1"
                  keyboardType="url"
                  autoCapitalize="none"
                />
                {links.length > 1 && (
                  <Pressable
                    onPress={() => handleRemoveLink(index)}
                    className="ml-2 w-10 h-10 items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  </Pressable>
                )}
              </View>
            ))}
          </Animated.View>

          {/* Recipient Selector (optional for both modes) */}
          <Animated.View entering={FadeInDown.delay(450).duration(400)} className="mt-4">
            <Text className="text-wishy-black font-semibold mb-2">Send to (optional)</Text>
            <Text className="text-wishy-gray text-sm mb-2">
              You can send this wish now or select recipients later
            </Text>
            {connectedUsers.length === 0 ? (
              <View className="bg-wishy-paleBlush/30 p-4 rounded-xl">
                <Text className="text-wishy-gray text-center text-sm">
                  No connected users. You can create the wish now and send it after connecting with others.
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  showModal("userPicker");
                }}
                className="bg-white p-4 rounded-xl border border-wishy-paleBlush flex-row items-center justify-between"
              >
                {selectedUserIds.length > 0 ? (
                  <>
                    <View className="flex-row items-center flex-1">
                      <View className="flex-row -space-x-2 mr-3">
                        {selectedUserIds.slice(0, 3).map((userId, index) => {
                          const user = allUsers.find((u) => u.id === userId);
                          return user?.profilePhoto ? (
                            <Image
                              key={userId}
                              source={{ uri: user.profilePhoto }}
                              style={{ width: 32, height: 32, zIndex: 10 - index }}
                              className="rounded-full border-2 border-white"
                            />
                          ) : (
                            <View
                              key={userId}
                              style={{ zIndex: 10 - index }}
                              className="w-8 h-8 rounded-full bg-wishy-paleBlush items-center justify-center border-2 border-white"
                            >
                              <Ionicons name="person" size={16} color="#4A1528" />
                            </View>
                          );
                        })}
                      </View>
                      <Text className="text-wishy-black font-medium flex-1" numberOfLines={1}>
                        {selectedUserIds.length === 1
                          ? allUsers.find((u) => u.id === selectedUserIds[0])?.name
                          : `${selectedUserIds.length} users selected`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={20} color="#9A8A8A" />
                  </>
                ) : (
                  <>
                    <Text className="text-wishy-gray">Select recipients (optional)</Text>
                    <Ionicons name="chevron-down" size={20} color="#9A8A8A" />
                  </>
                )}
              </Pressable>
            )}
          </Animated.View>

          {/* Save As Role Buttons */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} className="mt-6">
            <Text className="text-wishy-black font-semibold mb-3">Save this wish as:</Text>
            <View className="space-y-3">
              <Pressable
                onPress={() => isValid && handleCreate("wished")}
                disabled={!isValid}
                className={cn(
                  "p-4 rounded-xl border-2 flex-row items-center justify-between",
                  isValid ? "bg-pink-50 border-wishy-pink" : "bg-gray-100 border-gray-300"
                )}
              >
                <View className="flex-1">
                  <Text className={cn(
                    "font-bold text-lg",
                    isValid ? "text-wishy-black" : "text-gray-400"
                  )}>
                    Wished
                  </Text>
                  <Text className={cn(
                    "text-sm mt-1",
                    isValid ? "text-wishy-gray" : "text-gray-400"
                  )}>
                    A desire for others to fulfill for you
                  </Text>
                </View>
                <Ionicons name="heart" size={28} color={isValid ? "#FFB6D9" : "#D1D5DB"} />
              </Pressable>

              <Pressable
                onPress={() => isValid && handleCreate("wisher")}
                disabled={!isValid}
                className={cn(
                  "p-4 rounded-xl border-2 flex-row items-center justify-between mb-4",
                  isValid ? "bg-blue-50 border-blue-400" : "bg-gray-100 border-gray-300"
                )}
              >
                <View className="flex-1">
                  <Text className={cn(
                    "font-bold text-lg",
                    isValid ? "text-wishy-black" : "text-gray-400"
                  )}>
                    Wisher
                  </Text>
                  <Text className={cn(
                    "text-sm mt-1",
                    isValid ? "text-wishy-gray" : "text-gray-400"
                  )}>
                    An offer to fulfill for others
                  </Text>
                </View>
                <Ionicons name="gift" size={28} color={isValid ? "#60A5FA" : "#D1D5DB"} />
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>

        {/* Image Picker Modal */}
        {isVisible("imagePicker") && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            className="absolute inset-0 bg-black/50 justify-end"
          >
            <Pressable
              className="flex-1"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                hideModal("imagePicker");
              }}
            />
            <View className="bg-wishy-white rounded-t-3xl" style={{ paddingBottom: insets.bottom }}>
              <View className="p-4 border-b border-wishy-paleBlush">
                <Text className="text-wishy-black font-bold text-lg text-center">
                  Add Image
                </Text>
              </View>
              <View className="p-4">
                <Pressable
                  onPress={handleTakePhoto}
                  className="flex-row items-center p-4 bg-white rounded-xl border border-wishy-paleBlush mb-3"
                >
                  <Ionicons name="camera" size={24} color="#4A1528" />
                  <Text className="text-wishy-black font-semibold ml-3">Take Photo</Text>
                </Pressable>
                <Pressable
                  onPress={handlePickFromLibrary}
                  className="flex-row items-center p-4 bg-white rounded-xl border border-wishy-paleBlush"
                >
                  <Ionicons name="images" size={24} color="#4A1528" />
                  <Text className="text-wishy-black font-semibold ml-3">Choose from Library</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}

        {/* User Picker Modal */}
        {isVisible("userPicker") && (
          <Animated.View
            entering={FadeInDown.duration(300)}
            className="absolute inset-0 bg-black/50 justify-end"
          >
            <Pressable
              className="flex-1"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                hideModal("userPicker");
              }}
            />
            <View className="bg-wishy-white rounded-t-3xl" style={{ paddingBottom: insets.bottom }}>
              <View className="p-4 border-b border-wishy-paleBlush">
                <Text className="text-wishy-black font-bold text-lg text-center">
                  Select Recipients
                </Text>
                <Text className="text-wishy-gray text-center mt-1 text-sm">
                  {selectedUserIds.length === 3
                    ? "Maximum 3 recipients reached"
                    : `Select up to 3 recipients (${selectedUserIds.length}/3)`}
                </Text>
              </View>
              <ScrollView className="max-h-96">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectedUserIds([]);
                  }}
                  className={cn(
                    "flex-row items-center p-4 border-b border-wishy-paleBlush",
                    selectedUserIds.length === 0 && "bg-wishy-paleBlush/30"
                  )}
                >
                  <View className="w-12 h-12 rounded-full bg-wishy-paleBlush items-center justify-center mr-3">
                    <Ionicons name="close-circle" size={24} color="#4A1528" />
                  </View>
                  <Text className="text-wishy-black font-semibold text-base flex-1">
                    No recipients (send later)
                  </Text>
                  {selectedUserIds.length === 0 && (
                    <Ionicons name="checkmark-circle" size={24} color="#4A1528" />
                  )}
                </Pressable>
                {connectedUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <Pressable
                      key={user.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        if (isSelected) {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                        } else if (selectedUserIds.length < 3) {
                          setSelectedUserIds([...selectedUserIds, user.id]);
                        }
                      }}
                      className={cn(
                        "flex-row items-center p-4 border-b border-wishy-paleBlush",
                        isSelected && "bg-wishy-paleBlush/30"
                      )}
                    >
                      {user.profilePhoto ? (
                        <Image
                          source={{ uri: user.profilePhoto }}
                          style={{ width: 50, height: 50 }}
                          className="rounded-full mr-3"
                        />
                      ) : (
                        <View className="w-12 h-12 rounded-full bg-wishy-paleBlush items-center justify-center mr-3">
                          <Ionicons name="person" size={24} color="#4A1528" />
                        </View>
                      )}
                      <View className="flex-1">
                        <Text className="text-wishy-black font-semibold text-base">
                          {user.name}
                        </Text>
                        {user.bio && (
                          <Text className="text-wishy-gray text-sm mt-1" numberOfLines={1}>
                            {user.bio}
                          </Text>
                        )}
                        <Text className="text-wishy-darkPink text-xs mt-1 capitalize">
                          {user.role}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={24} color="#4A1528" />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
              {selectedUserIds.length > 0 && (
                <View className="p-4 border-t border-wishy-paleBlush">
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      hideModal("userPicker");
                    }}
                    className="bg-wishy-black py-3 rounded-xl items-center"
                  >
                    <Text className="text-wishy-white font-semibold">
                      Done ({selectedUserIds.length})
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
