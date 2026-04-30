import React, { useState } from "react";
import { format } from "date-fns";
import { View, Text, Pressable, ScrollView, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useWishStore from "../state/wishStore";
import useUserStore from "../state/userStore";
import useConnectionStore from "../state/connectionStore";
import useNotificationStore from "../state/notificationStore";
import { useToastStore } from "../state/toastStore";
import { CATEGORY_LABELS, WISH_STATUS_LABELS, User } from "../types/wishy";
import { cn } from "../utils/cn";
import { WishOriginBadge } from "../components/WishOriginBadge";
import { WishDirectionIndicator } from "../components/WishDirectionIndicator";
import { useModalState } from "../hooks/useModalState";
import { WishDetailActions } from "./wish-detail/WishDetailActions";
import { WishDetailModals } from "./wish-detail/WishDetailModals";
import {
  sendWishAcceptedNotification,
  sendWishEditedNotification,
  sendWishDeletedNotification,
  sendDateProposedNotification,
  sendWishReceivedNotification,
} from "../api/pushNotifications";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "WishDetail">;
type WishDetailRouteProp = RouteProp<RootStackParamList, "WishDetail">;

export default function WishDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<WishDetailRouteProp>();
  const wishId = route.params.wishId;

  // Subscribe to the specific wish - this will re-render when the wish changes
  const wish = useWishStore((s) => s.wishes.find((w) => w.id === wishId));
  const proposeDate = useWishStore((s) => s.proposeDate);
  const confirmDate = useWishStore((s) => s.confirmDate);
  const acceptWish = useWishStore((s) => s.acceptWish);
  const declineWish = useWishStore((s) => s.declineWish);
  const updateWish = useWishStore((s) => s.updateWish);
  const deleteWishAsCreator = useWishStore((s) => s.deleteWishAsCreator);
  const hideWishAsRecipient = useWishStore((s) => s.hideWishAsRecipient);
  const fulfillWish = useWishStore((s) => s.fulfillWish);

  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const createChat = useConnectionStore((s) => s.createChat);
  const getChatByWishId = useConnectionStore((s) => s.getChatByWishId);
  const getAcceptedConnections = useConnectionStore((s) => s.getAcceptedConnections);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const showToast = useToastStore((s) => s.showToast);

  const { show: showModal, hide: hideModal, toggle, isVisible } = useModalState(
    "date", "decline", "delete", "rating", "sendTo", "editDate",
    "datePicker", "timePicker", "editDatePicker", "editTimePicker"
  );

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [proposedDate, setProposedDate] = useState<Date>(new Date());
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [rating, setRating] = useState(0);
  const [praised, setPraised] = useState(false);
  const [review, setReview] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");

  // Get connected users filtered by role - must be before early return
  const connectedUsers = React.useMemo(() => {
    if (!currentUser || !wish) return [];
    const connections = getAcceptedConnections(currentUser.id);
    const connectedUserIds = connections.map((conn) =>
      conn.senderId === currentUser.id ? conn.receiverId : conn.senderId
    );

    // Filter users based on the creator role
    // If wish creator is Wisher: show Wished and Both users
    // If wish creator is Wished: show Wisher and Both users
    const filteredUsers = allUsers.filter((user) => {
      if (!connectedUserIds.includes(user.id)) return false;

      if (wish.creatorRole === "wisher") {
        // Wisher can send to Wished or Both
        return user.role === "wished" || user.role === "both";
      } else if (wish.creatorRole === "wished") {
        // Wished can send to Wisher or Both
        return user.role === "wisher" || user.role === "both";
      }

      return true;
    });

    return filteredUsers;
  }, [currentUser, getAcceptedConnections, allUsers, wish?.creatorRole, wish]);

  // Get all target users - must be before early return
  const targets = React.useMemo(() => {
    if (!wish || !wish.targetUserIds || wish.targetUserIds.length === 0) return [];
    return wish.targetUserIds
      .map(userId => allUsers.find(u => u.id === userId))
      .filter((user): user is User => user !== undefined);
  }, [wish, wish?.targetUserIds, allUsers]);

  if (!wish) {
    return (
      <View className="flex-1 bg-wishy-white items-center justify-center">
        <Text className="text-wishy-gray">Wish not found</Text>
      </View>
    );
  }

  const isOwnWish = wish.creatorId === currentUser?.id;
  const creator = allUsers.find(u => u.id === wish.creatorId);
  const target = wish.targetUserId ? allUsers.find(u => u.id === wish.targetUserId) : undefined;
  const isWished = wish.creatorRole === "wished";

  // Check if this is my wish that hasn't been sent yet (both wisher and wished can send)
  const canSendToUser = isOwnWish &&
    (!wish.targetUserIds || wish.targetUserIds.length === 0) &&
    !wish.targetUserId &&
    wish.status === "created";

  // Determine if I am the receiver (WISHED)
  const iAmReceiver = (wish.targetUserId === currentUser?.id) ||
                      (wish.creatorId === currentUser?.id && wish.creatorRole === "wished");

  // Determine if I am the WISHED person in this wish relationship
  // The WISHED is the person whose desire is being fulfilled
  const iAmWished = (wish.creatorRole === "wished" && wish.creatorId === currentUser?.id) ||
                    (wish.creatorRole === "wisher" && wish.targetUserId === currentUser?.id);

  // Can mark as fulfilled if: I'm the WISHED person and wish has accepted status
  const canMarkFulfilled = iAmWished && wish.status === "accepted";

  const handleAccept = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await acceptWish(wishId);

    if (currentUser && wish.creatorId && wish.creatorId !== currentUser.id) {
      addNotification(
        wish.creatorId,
        "wish_accepted",
        "Wish Accepted!",
        `${currentUser.name} accepted your wish: "${wish.title}"`,
        wishId
      );
    }

    showToast("Wish accepted!");
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("CreateWish", {
      mode: wish.creatorRole === "wished" ? "wishlist" : "portfolio",
      editWishId: wishId,
    });
  };

  const handleConfirmDate = async () => {
    if (!currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const dateStr = format(proposedDate, "yyyy-MM-dd");
    const timeStr = proposedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    await proposeDate(wishId, {
      date: dateStr,
      time: timeStr,
      message: proposalMessage,
      proposedBy: currentUser.id,
    });

    // Create or open chat
    const participants: string[] = [currentUser.id];
    if (wish.creatorId === currentUser.id) {
      // I'm the creator, add target users
      if (wish.targetUserIds && wish.targetUserIds.length > 0) {
        wish.targetUserIds.forEach((targetId) => {
          if (!participants.includes(targetId)) {
            participants.push(targetId);
          }
        });
      } else if (wish.targetUserId) {
        participants.push(wish.targetUserId);
      }
    } else {
      // I'm the recipient, add the creator
      participants.push(wish.creatorId);
    }
    const chatId = await createChat(wishId, participants.filter(Boolean));

    // Send in-app notifications
    const recipientIds = participants.filter((id) => id !== currentUser.id);
    recipientIds.forEach((recipientId) => {
      addNotification(
        recipientId,
        "date_proposed",
        "Date Proposed!",
        `${currentUser.name} proposed ${dateStr} at ${timeStr} for "${wish.title}"`,
        wishId
      );
    });

    hideModal("date");
    setProposalMessage("");

    showToast("Date proposed successfully!");

    // Navigate to chat
    navigation.navigate("Chat", { wishId, chatId });
  };

  const handleAskForDetails = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!currentUser) return;

    const participants: string[] = [currentUser.id];
    if (wish.creatorId === currentUser.id) {
      // I'm the creator, add target users
      if (wish.targetUserIds && wish.targetUserIds.length > 0) {
        wish.targetUserIds.forEach((targetId) => {
          if (!participants.includes(targetId)) {
            participants.push(targetId);
          }
        });
      } else if (wish.targetUserId) {
        participants.push(wish.targetUserId);
      }
    } else {
      // I'm the recipient, add the creator
      participants.push(wish.creatorId);
    }
    const chatId = await createChat(wishId, participants.filter(Boolean));

    navigation.navigate("Chat", { wishId, chatId });
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showModal("decline");
  };

  const confirmDecline = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    declineWish(wishId);
    hideModal("decline");
    showToast("Wish declined", "info");
    navigation.goBack();
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showModal("delete");
  };

  const confirmDelete = () => {
    if (!currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const isCreator = wish.creatorId === currentUser.id;

    if (isCreator) {
      // Creator deletes - remove for everyone
      deleteWishAsCreator(wishId);

      // Notify recipient if wish was sent (both parties exist)
      if (wish.targetUserId) {
        // In-app notification
        addNotification(
          wish.targetUserId,
          "wish_received",
          "Wish Deleted",
          `${currentUser.name} has deleted the wish "${wish.title}"`,
          wishId
        );

        // Push notification
        sendWishDeletedNotification(
          wish.targetUserId,
          currentUser.name,
          wish.title
        );
      }
    } else {
      // Recipient deletes - hide only for them
      hideWishAsRecipient(wishId, currentUser.id);

      // Notify creator (both parties exist)
      if (wish.creatorId) {
        // In-app notification
        addNotification(
          wish.creatorId,
          "wish_received",
          "Wish Removed",
          `${currentUser.name} has removed your wish "${wish.title}" from their list`,
          wishId
        );

        // Push notification
        sendWishDeletedNotification(
          wish.creatorId,
          currentUser.name,
          wish.title
        );
      }
    }

    hideModal("delete");
    showToast(isCreator ? "Wish deleted" : "Wish removed", "info");
    navigation.goBack();
  };

  const handleMarkAsFulfilled = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Reset rating form for new rating
    setRating(0);
    setPraised(false);
    setReview("");
    showModal("rating");
  };

  const handleEditRating = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Pre-populate with existing rating
    setRating(wish.rating || 0);
    setPraised(wish.praised || false);
    setReview(wish.review || "");
    showModal("rating");
  };

  const confirmFulfill = () => {
    if (!currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Mark wish as fulfilled with rating
    fulfillWish(wishId, rating, praised, review.trim(), currentUser.id);

    // Determine who to notify (the wisher who fulfilled it)
    const wisherId = wish.creatorRole === "wisher" ? wish.creatorId : wish.targetUserId;

    if (wisherId && wisherId !== currentUser.id) {
      addNotification(
        wisherId,
        "wish_received",
        "Wish Fulfilled! ⭐",
        `${currentUser.name} marked "${wish.title}" as fulfilled with ${rating} ${rating === 1 ? "wand" : "wands"}${praised ? " and a heart!" : "!"}`,
        wishId
      );
    }

    hideModal("rating");

    showToast("Wish marked as fulfilled!");

    // Reset rating form
    setRating(0);
    setPraised(false);
    setReview("");
  };

  const handleOpenChat = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Check if chat exists
    let existingChat = getChatByWishId(wishId);

    if (existingChat) {
      navigation.navigate("Chat", { wishId, chatId: existingChat.id });
    } else if (currentUser) {
      // Create chat if it doesn't exist
      const participants: string[] = [currentUser.id];

      // Add the other party based on who I am
      if (wish.creatorId === currentUser.id) {
        // I'm the creator, add target users
        if (wish.targetUserIds && wish.targetUserIds.length > 0) {
          wish.targetUserIds.forEach((targetId) => {
            if (!participants.includes(targetId)) {
              participants.push(targetId);
            }
          });
        } else if (wish.targetUserId) {
          participants.push(wish.targetUserId);
        }
      } else {
        // I'm the recipient, add the creator
        participants.push(wish.creatorId);
      }

      if (participants.length >= 2) {
        const newChatId = await createChat(wishId, participants);
        navigation.navigate("Chat", { wishId, chatId: newChatId });
      } else {
        showToast("Cannot open chat - missing participant", "error");
      }
    }
  };

  const handleSendToUsers = () => {
    if (!currentUser || selectedUserIds.length === 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Update wish to set target users
    updateWish(wishId, {
      targetUserIds: selectedUserIds,
      targetUserId: selectedUserIds[0], // Backward compatibility
      status: "sent",
    });

    // Create notifications for all recipients based on creator role
    selectedUserIds.forEach((userId) => {
      const recipientUser = allUsers.find((u) => u.id === userId);
      if (!recipientUser) return;

      if (wish.creatorRole === "wisher") {
        // Wisher sending to Wished - In-app notification
        addNotification(
          userId,
          "wish_received",
          "New Wish Offer!",
          `${currentUser.name} wants to fulfill a wish for you: "${wish.title}"`,
          wishId
        );
      } else {
        // Wished sending to Wisher - In-app notification
        addNotification(
          userId,
          "wish_received",
          "New Wish Request!",
          `${currentUser.name} sent you a wish to fulfill: "${wish.title}"`,
          wishId
        );
      }

      // Push notification
      sendWishReceivedNotification(
        userId,
        currentUser.name,
        wish.title,
        wishId
      );
    });

    hideModal("sendTo");
    setSelectedUserIds([]);

    showToast(`Wish sent to ${selectedUserIds.length} ${selectedUserIds.length === 1 ? "user" : "users"}!`);

    // Show success message and navigate back
    setTimeout(() => {
      navigation.goBack();
    }, 100);
  };

  const handleOpenEditDate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Pre-populate with existing date/time if available
    if (wish.proposal?.proposedDate && wish.proposal?.proposedTime) {
      try {
        // Parse the localized date string
        const dateParts = wish.proposal.proposedDate.split("/");
        let day, month, year;

        // Handle different date formats (MM/DD/YYYY or DD/MM/YYYY)
        if (dateParts.length === 3) {
          // Assume MM/DD/YYYY format (US)
          month = parseInt(dateParts[0]) - 1; // Month is 0-indexed
          day = parseInt(dateParts[1]);
          year = parseInt(dateParts[2]);
        } else {
          // If parsing fails, use current date
          const now = new Date();
          day = now.getDate();
          month = now.getMonth();
          year = now.getFullYear();
        }

        // Parse time
        const timeParts = wish.proposal.proposedTime.split(":");
        let hours = 12;
        let minutes = 0;

        if (timeParts.length >= 2) {
          const timeStr = wish.proposal.proposedTime.trim();
          const isPM = timeStr.toLowerCase().includes("pm");
          const isAM = timeStr.toLowerCase().includes("am");

          hours = parseInt(timeParts[0]);
          minutes = parseInt(timeParts[1].replace(/[^0-9]/g, ""));

          // Convert to 24-hour format if needed
          if (isPM && hours !== 12) {
            hours += 12;
          } else if (isAM && hours === 12) {
            hours = 0;
          }
        }

        const existingDate = new Date(year, month, day, hours, minutes);

        // Verify the date is valid
        if (!isNaN(existingDate.getTime())) {
          setEditDate(existingDate);
        } else {
          // If invalid, use current date
          setEditDate(new Date());
        }
      } catch (error) {
        // If any error occurs, use current date
        setEditDate(new Date());
      }
    } else {
      setEditDate(new Date());
    }

    showModal("editDate");
  };

  const handleUpdateDate = async () => {
    if (!currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const dateStr = format(editDate, "yyyy-MM-dd");
    const timeStr = editDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    await proposeDate(wishId, {
      date: dateStr,
      time: timeStr,
      message: proposalMessage,
      proposedBy: currentUser.id,
    });

    // Determine all recipients to notify
    const recipientIds: string[] = [];
    if (wish.creatorId === currentUser.id) {
      // I'm the creator, notify target users
      if (wish.targetUserIds && wish.targetUserIds.length > 0) {
        recipientIds.push(...wish.targetUserIds);
      } else if (wish.targetUserId) {
        recipientIds.push(wish.targetUserId);
      }
    } else {
      // I'm the recipient, notify the creator
      recipientIds.push(wish.creatorId);
    }

    // Send notifications to all recipients
    recipientIds.forEach((recipientId) => {
      if (recipientId && recipientId !== currentUser.id) {
        // In-app notification
        addNotification(
          recipientId,
          "date_changed",
          "Date/Time Changed",
          `${currentUser.name} updated the date/time for "${wish.title}" to ${dateStr} at ${timeStr}`,
          wishId
        );

        // Push notification
        sendDateProposedNotification(
          recipientId,
          currentUser.name,
          wish.title,
          wishId
        );
      }
    });

    hideModal("editDate");
    setProposalMessage("");
    showToast("Date/time updated!");
  };

  const handleConfirmExistingDate = async () => {
    if (!currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    await confirmDate(wishId, currentUser.id);

    showToast("Date confirmed!");

    // Determine all recipients to notify
    const recipientIds: string[] = [];
    if (wish.creatorId === currentUser.id) {
      // I'm the creator, notify target users
      if (wish.targetUserIds && wish.targetUserIds.length > 0) {
        recipientIds.push(...wish.targetUserIds);
      } else if (wish.targetUserId) {
        recipientIds.push(wish.targetUserId);
      }
    } else {
      // I'm the recipient, notify the creator
      recipientIds.push(wish.creatorId);
    }

    // Send notifications to all recipients
    recipientIds.forEach((recipientId) => {
      if (recipientId && recipientId !== currentUser.id) {
        addNotification(
          recipientId,
          "date_confirmed",
          "Date Confirmed!",
          `${currentUser.name} confirmed the date/time for "${wish.title}"`,
          wishId
        );
      }
    });
  };

  const handleOpenMaps = () => {
    if (!wish.location) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const encodedLocation = encodeURIComponent(wish.location);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedLocation}`,
      android: `geo:0,0?q=${encodedLocation}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encodedLocation}`,
    });

    Linking.openURL(url).catch(() => {
      // Fallback to Google Maps web
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedLocation}`);
    });
  };

  return (
    <View className="flex-1 bg-wishy-white">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Hero Image */}
        <View className="relative">
          {wish.image ? (
            <Image
              source={{ uri: wish.image }}
              style={{ width: "100%", height: 320 }}
              contentFit="cover"
            />
          ) : (
            <View className="w-full h-80 bg-wishy-paleBlush items-center justify-center">
              <Ionicons name="image-outline" size={64} color="#8B2252" />
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(74,21,40,0.8)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 120,
            }}
          />
          <Pressable
            onPress={() => navigation.goBack()}
            className="absolute top-12 left-4 w-10 h-10 bg-black/30 rounded-full items-center justify-center"
          >
            <Ionicons name="chevron-back" size={24} color="#FFF8F0" />
          </Pressable>
          {canSendToUser && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                showModal("sendTo");
              }}
              className="absolute top-12 right-4 bg-wishy-pink/95 rounded-full px-4 py-2 flex-row items-center active:opacity-80"
            >
              <Ionicons name="paper-plane" size={16} color="#4A1528" />
              <Text className="text-wishy-black font-semibold text-sm ml-1.5">Send to</Text>
            </Pressable>
          )}
        </View>

        {/* Content */}
        <View className="px-6 -mt-8 pb-8">
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <View className="bg-white rounded-2xl p-5 shadow-sm">
              {/* Origin Badge */}
              <WishOriginBadge
                createdByMe={isOwnWish}
                isWished={isWished}
                proposedByUserName={creator?.name}
                className="mb-3"
              />

              {/* Category and Status */}
              <View className="flex-row items-center justify-between mb-3">
                <View className="bg-wishy-paleBlush px-3 py-1 rounded-full">
                  <Text className="text-wishy-black text-sm font-medium">
                    {CATEGORY_LABELS[wish.category]}
                  </Text>
                </View>
                <View className={cn(
                  "px-3 py-1 rounded-full",
                  wish.status === "fulfilled" ? "bg-wishy-darkPink" :
                  wish.status === "confirmed" ? "bg-wishy-pink" :
                  wish.status === "date_set" ? "bg-wishy-pink" :
                  wish.status === "accepted" ? "bg-wishy-pink" :
                  wish.status === "sent" ? "bg-wishy-paleBlush" :
                  wish.status === "rejected" ? "bg-black" : "bg-gray-100"
                )}>
                  <Text className={cn(
                    "text-sm font-medium",
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

              {/* Title */}
              <Text className="text-wishy-black font-bold text-2xl">
                {wish.title}
              </Text>

              {/* Description */}
              <Text className="text-wishy-gray mt-3 text-base leading-6">
                {wish.description}
              </Text>

              {/* Rating Section - Only show when fulfilled */}
              {wish.status === "fulfilled" && wish.rating !== undefined && (
                <Animated.View entering={FadeInUp.delay(250).duration(400)} className="mt-5 p-4 bg-wishy-paleBlush/30 rounded-2xl">
                  <Text className="text-wishy-black font-bold text-lg mb-3 text-center">
                    Experience Rating
                  </Text>

                  {/* Magic Wands Display */}
                  <View className="flex-row justify-center gap-2 mb-3">
                    {[1, 2, 3, 4, 5].map((wand) => (
                      <Ionicons
                        key={wand}
                        name="sparkles"
                        size={28}
                        color={wish.rating && wish.rating >= wand ? "#8B2252" : "#D1D5DB"}
                      />
                    ))}
                  </View>

                  {/* Heart/Praise */}
                  {wish.praised && (
                    <View className="flex-row items-center justify-center mb-2">
                      <Ionicons name="heart" size={20} color="#8B2252" />
                      <Text className="text-wishy-darkPink font-semibold ml-2">
                        Special Praise
                      </Text>
                    </View>
                  )}

                  {/* Review Text */}
                  {wish.review && wish.review.trim() !== "" && (
                    <View className="mt-3 pt-3 border-t border-wishy-pink/20">
                      <Text className="text-wishy-gray text-sm italic text-center">
                        {`"${wish.review}"`}
                      </Text>
                    </View>
                  )}
                </Animated.View>
              )}

              {/* Details */}
              <View className="mt-5 pt-5 border-t border-wishy-paleBlush">
                {wish.location && (
                  <Pressable
                    onPress={handleOpenMaps}
                    className="flex-row items-center mb-3 active:opacity-70"
                  >
                    <Ionicons name="location-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-2 underline">{wish.location}</Text>
                    <Ionicons name="open-outline" size={16} color="#8B2252" className="ml-1" />
                  </Pressable>
                )}
                {wish.links && wish.links.length > 0 && (
                  <View className="mb-3">
                    <View className="flex-row items-center mb-2">
                      <Ionicons name="link-outline" size={20} color="#8B2252" />
                      <Text className="text-wishy-black ml-2 font-semibold">Links</Text>
                    </View>
                    {wish.links.map((link, index) => (
                      <Pressable
                        key={index}
                        onPress={() => Linking.openURL(link)}
                        className="ml-7 mb-1 active:opacity-70"
                      >
                        <Text className="text-blue-600 underline" numberOfLines={1}>
                          {link}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {wish.customCategory && (
                  <View className="flex-row items-center mb-3">
                    <Ionicons name="pricetag-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-2">
                      {wish.customCategory}
                    </Text>
                  </View>
                )}
              </View>

              {/* Proposed Date Info */}
              {wish.proposal && (
                <View className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="calendar" size={20} color="#1E40AF" />
                    <Text className="text-blue-900 font-semibold ml-2">
                      {wish.proposal.confirmedBy ? "Confirmed Date" : "Proposed Date"}
                    </Text>
                  </View>
                  <Text className="text-blue-800 ml-7">
                    {wish.proposal.proposedDate} at {wish.proposal.proposedTime}
                  </Text>
                  {wish.proposal.proposalMessage && (
                    <Text className="text-blue-700 text-sm mt-2 ml-7 italic">
                      {wish.proposal.proposalMessage}
                    </Text>
                  )}

                  {/* Confirm button - only shows when status is "date_set" and to receiver who did NOT propose the date */}
                  {wish.status === "date_set" &&
                    (wish.targetUserId === currentUser?.id ||
                     wish.targetUserIds?.includes(currentUser?.id || "") ||
                     wish.creatorId === currentUser?.id) &&
                    wish.proposal.proposedBy !== currentUser?.id && (
                    <View className="mt-3">
                      <Pressable
                        onPress={handleConfirmExistingDate}
                        className="flex-row items-center justify-center bg-green-500 px-4 py-3 rounded-lg active:opacity-80"
                      >
                        <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                        <Text className="text-white font-semibold ml-2">Confirm Date</Text>
                      </Pressable>
                    </View>
                  )}

                  {(wish.status === "confirmed" || wish.status === "fulfilled") && (
                    <View className="flex-row items-center mt-2 ml-7">
                      <Ionicons name="checkmark-circle" size={16} color="#059669" />
                      <Text className="text-green-700 text-sm ml-1">Date confirmed</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Animated.View>

          {/* Direction Indicator */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)} className="mt-4">
            <WishDirectionIndicator
              creator={creator}
              target={target}
              targets={targets.length > 0 ? targets : undefined}
              creatorRole={wish.creatorRole}
            />
          </Animated.View>

          {/* Tags */}
          {wish.tags.length > 0 && (
            <Animated.View entering={FadeInUp.delay(200).duration(400)} className="mt-4">
              <View className="flex-row flex-wrap gap-2">
                {wish.tags.map((tag) => (
                  <View key={tag} className="bg-wishy-paleBlush/50 px-3 py-1 rounded-full">
                    <Text className="text-wishy-black text-sm">#{tag}</Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}
        </View>
      </ScrollView>

      <WishDetailActions
        wish={wish}
        isOwnWish={isOwnWish}
        insets={insets}
        onEdit={handleEdit}
        onProposeDate={handleOpenEditDate}
        onOpenChat={handleOpenChat}
        onDelete={handleDelete}
        onDecline={handleDecline}
        onMarkFulfilled={handleMarkAsFulfilled}
        onAccept={handleAccept}
      />

      <WishDetailModals
        wish={wish}
        isOwnWish={isOwnWish}
        isVisible={isVisible as unknown as (key: string) => boolean}
        showModal={showModal as unknown as (key: string) => void}
        hideModal={hideModal as unknown as (key: string) => void}
        toggle={toggle as unknown as (key: string) => void}
        proposedDate={proposedDate}
        setProposedDate={setProposedDate}
        editDate={editDate}
        setEditDate={setEditDate}
        rating={rating}
        setRating={setRating}
        praised={praised}
        setPraised={setPraised}
        review={review}
        setReview={setReview}
        proposalMessage={proposalMessage}
        setProposalMessage={setProposalMessage}
        connectedUsers={connectedUsers}
        selectedUserIds={selectedUserIds}
        setSelectedUserIds={setSelectedUserIds}
        insets={insets}
        onConfirmDate={handleConfirmDate}
        onSendToUsers={handleSendToUsers}
        onUpdateDate={handleUpdateDate}
        onConfirmDecline={confirmDecline}
        onConfirmDelete={confirmDelete}
        onConfirmFulfill={confirmFulfill}
      />
    </View>
  );
}
