import React, { useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, TextInput, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import DateTimePicker from "@react-native-community/datetimepicker";
import useWishStore from "../state/wishStore";
import useUserStore from "../state/userStore";
import useConnectionStore from "../state/connectionStore";
import useNotificationStore from "../state/notificationStore";
import { useToastStore } from "../state/toastStore";
import { CATEGORY_LABELS, WISH_STATUS_LABELS, User } from "../types/wishy";
import { cn } from "../utils/cn";
import { WishOriginBadge } from "../components/WishOriginBadge";
import { WishDirectionIndicator } from "../components/WishDirectionIndicator";
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

  const [showDateModal, setShowDateModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showSendToModal, setShowSendToModal] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showEditDateModal, setShowEditDateModal] = useState(false);
  const [proposedDate, setProposedDate] = useState<Date>(new Date());
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [rating, setRating] = useState(0);
  const [praised, setPraised] = useState(false);
  const [review, setReview] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [showEditTimePicker, setShowEditTimePicker] = useState(false);
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

  // Debug logging for proposal
  console.log("=== WISH DETAIL DEBUG ===");
  console.log("Wish ID:", wish.id);
  console.log("Wish Status:", wish.status);
  console.log("Wish Proposal:", JSON.stringify(wish.proposal, null, 2));
  console.log("Current User ID:", currentUser?.id);
  console.log("Wish targetUserId:", wish.targetUserId);
  console.log("Wish targetUserIds:", wish.targetUserIds);
  console.log("Wish creatorId:", wish.creatorId);
  if (wish.proposal) {
    console.log("Proposal proposedBy:", wish.proposal.proposedBy);
    const isTargetById = wish.targetUserId === currentUser?.id;
    const isTargetByIds = wish.targetUserIds?.includes(currentUser?.id || "");
    const isCreator = wish.creatorId === currentUser?.id;
    console.log("Is target by targetUserId:", isTargetById);
    console.log("Is target by targetUserIds:", isTargetByIds);
    console.log("Is creator:", isCreator);
    console.log("proposedBy !== currentUser:", wish.proposal.proposedBy !== currentUser?.id);
    console.log("Should show Confirm Date:",
      wish.status === "date_set" &&
      (isTargetById || isTargetByIds || isCreator) &&
      wish.proposal.proposedBy !== currentUser?.id
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

  const handleAcceptAndProposeDate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDateModal(true);
  };

  const handleConfirmDate = async () => {
    if (!currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const dateStr = proposedDate.toLocaleDateString();
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

    setShowDateModal(false);
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
    setShowDeclineModal(true);
  };

  const confirmDecline = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    declineWish(wishId);
    setShowDeclineModal(false);
    showToast("Wish declined", "info");
    navigation.goBack();
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowDeleteModal(true);
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

    setShowDeleteModal(false);
    showToast(isCreator ? "Wish deleted" : "Wish removed", "info");
    navigation.goBack();
  };

  const handleMarkAsFulfilled = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Reset rating form for new rating
    setRating(0);
    setPraised(false);
    setReview("");
    setShowRatingModal(true);
  };

  const handleEditRating = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Pre-populate with existing rating
    setRating(wish.rating || 0);
    setPraised(wish.praised || false);
    setReview(wish.review || "");
    setShowRatingModal(true);
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

    setShowRatingModal(false);

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

    setShowSendToModal(false);
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

    setShowEditDateModal(true);
  };

  const handleUpdateDate = async () => {
    if (!currentUser) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const dateStr = editDate.toLocaleDateString();
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

    setShowEditDateModal(false);
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
                setShowSendToModal(true);
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

      {/* Action Buttons - CREATOR (I created this wish) */}
      {isOwnWish && wish.status !== "created" && wish.status !== "fulfilled" && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={{
            paddingBottom: insets.bottom + 16,
            paddingTop: 16,
            paddingHorizontal: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5
          }}
        >
          <View className="gap-3">
            {/* Edit */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("CreateWish", {
                  mode: wish.creatorRole === "wished" ? "wishlist" : "portfolio",
                  editWishId: wishId,
                });
              }}
              className="bg-wishy-darkPink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="pencil" size={22} color="#000000" />
              <Text className="text-black font-bold text-base ml-2">
                Edit
              </Text>
            </Pressable>

            {/* Propose Date */}
            <Pressable
              onPress={handleOpenEditDate}
              className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="calendar-outline" size={22} color="#000000" />
              <Text className="text-black font-semibold text-base ml-2">
                Propose Date
              </Text>
            </Pressable>

            {/* Open Chat */}
            <Pressable
              onPress={handleOpenChat}
              className="bg-wishy-paleBlush py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="chatbubble-outline" size={22} color="#000000" />
              <Text className="text-black font-semibold text-base ml-2">
                Open Chat
              </Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">
                Delete
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Action Buttons - CREATOR viewing fulfilled wish */}
      {isOwnWish && wish.status === "fulfilled" && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={{
            paddingBottom: insets.bottom + 16,
            paddingTop: 16,
            paddingHorizontal: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5
          }}
        >
          <View className="gap-3">
            {/* Open Chat */}
            <Pressable
              onPress={handleOpenChat}
              className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="chatbubble-outline" size={22} color="#000000" />
              <Text className="text-black font-semibold text-base ml-2">
                Open Chat
              </Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">
                Delete
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Action Buttons - CREATOR viewing unsent wish (created status) */}
      {isOwnWish && wish.status === "created" && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={{
            paddingBottom: insets.bottom + 16,
            paddingTop: 16,
            paddingHorizontal: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5
          }}
        >
          <View className="gap-3">
            {/* Edit */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("CreateWish", {
                  mode: wish.creatorRole === "wished" ? "wishlist" : "portfolio",
                  editWishId: wishId,
                });
              }}
              className="bg-wishy-darkPink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
            >
              <Ionicons name="pencil" size={22} color="#000000" />
              <Text className="text-black font-bold text-base ml-2">
                Edit
              </Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">
                Delete
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Action Buttons - RECEIVER (I received this wish) */}
      {!isOwnWish && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-white border-t border-wishy-paleBlush"
          style={{
            paddingBottom: insets.bottom + 16,
            paddingTop: 16,
            paddingHorizontal: 24,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5
          }}
        >
          <View className="gap-3">
            {/* Accept - only show if status is "sent" (not yet accepted) */}
            {wish.status === "sent" && (
              <Pressable
                onPress={async () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                  if (!wish) {
                    showToast("Wish not found", "error");
                    return;
                  }

                  console.log("Accept button pressed for wish:", wishId);
                  console.log("Wish status before accept:", wish.status);

                  // Call acceptWish - this updates Supabase and sends push notification
                  await acceptWish(wishId);

                  // Send in-app notification to the creator
                  if (currentUser && wish.creatorId && wish.creatorId !== currentUser.id) {
                    console.log("Adding in-app notification for creator:", wish.creatorId);
                    addNotification(
                      wish.creatorId,
                      "wish_accepted",
                      "Wish Accepted!",
                      `${currentUser.name} accepted your wish: "${wish.title}"`,
                      wishId
                    );
                  }

                  showToast("Wish accepted!");
                }}
                className="bg-wishy-darkPink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="checkmark-circle" size={22} color="#000000" />
                <Text className="text-black font-bold text-base ml-2">
                  Accept
                </Text>
              </Pressable>
            )}

            {/* Mark as Fulfilled - show when status is "confirmed" */}
            {wish.status === "confirmed" && (
              <Pressable
                onPress={handleMarkAsFulfilled}
                className="bg-green-500 py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="star" size={22} color="#FFFFFF" />
                <Text className="text-white font-bold text-base ml-2">
                  Fulfilled
                </Text>
              </Pressable>
            )}

            {/* Propose Date - show for accepted, date_set, confirmed statuses (NOT fulfilled) */}
            {(wish.status === "accepted" || wish.status === "date_set" || wish.status === "confirmed") && (
              <Pressable
                onPress={handleOpenEditDate}
                className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="calendar-outline" size={22} color="#000000" />
                <Text className="text-black font-semibold text-base ml-2">
                  Propose Date
                </Text>
              </Pressable>
            )}

            {/* Open Chat - always show except for fulfilled */}
            {wish.status !== "fulfilled" && (
              <Pressable
                onPress={handleOpenChat}
                className="bg-wishy-paleBlush py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="chatbubble-outline" size={22} color="#000000" />
                <Text className="text-black font-semibold text-base ml-2">
                  Open Chat
                </Text>
              </Pressable>
            )}

            {/* Open Chat - show for fulfilled (primary action) */}
            {wish.status === "fulfilled" && (
              <Pressable
                onPress={handleOpenChat}
                className="bg-wishy-pink py-4 rounded-2xl flex-row items-center justify-center active:opacity-80"
              >
                <Ionicons name="chatbubble-outline" size={22} color="#000000" />
                <Text className="text-black font-semibold text-base ml-2">
                  Open Chat
                </Text>
              </Pressable>
            )}

            {/* Decline - show when status is "sent" */}
            {wish.status === "sent" && (
              <Pressable
                onPress={handleDecline}
                className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
              >
                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
                <Text className="text-red-600 font-semibold text-sm ml-2">
                  Decline
                </Text>
              </Pressable>
            )}

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              className="bg-gray-50 border border-gray-200 py-4 rounded-2xl flex-row items-center justify-center active:opacity-70"
            >
              <Ionicons name="trash-outline" size={20} color="#000000" />
              <Text className="text-black font-semibold text-sm ml-2">
                Delete
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* Date Proposal Modal */}
      <Modal
        visible={showDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateModal(false)}
      >
        <Pressable
          onPress={() => setShowDateModal(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-t-3xl p-6"
            >
              <View className="w-12 h-1 bg-wishy-paleBlush rounded-full self-center mb-6" />

              <Text className="text-wishy-black font-bold text-xl mb-2">
                Propose a Date & Time
              </Text>
              <Text className="text-wishy-gray mb-6">
                Suggest when you would like to fulfill this wish
              </Text>

              {/* Date and Time Selection */}
              <View className="gap-3 mb-4">
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {proposedDate.toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8B2252" />
                </Pressable>

                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {proposedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8B2252" />
                </Pressable>
              </View>

              {/* Optional Message */}
              <TextInput
                value={proposalMessage}
                onChangeText={setProposalMessage}
                placeholder="Add a message (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                className="bg-wishy-paleBlush/30 rounded-xl p-4 text-wishy-black mb-4 min-h-[80px]"
                style={{ textAlignVertical: "top" }}
              />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowDateModal(false)}
                  className="flex-1 py-4 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirmDate}
                  className="flex-1 py-4 rounded-xl items-center bg-wishy-black active:opacity-90"
                >
                  <Text className="text-wishy-white font-semibold">Confirm</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Decline Modal */}
      <Modal
        visible={showDeclineModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeclineModal(false)}
      >
        <Pressable
          onPress={() => setShowDeclineModal(false)}
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
                  <Ionicons name="close-circle" size={32} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2 text-center">
                  Decline Wish?
                </Text>
                <Text className="text-wishy-gray text-center">
                  Are you sure you want to decline this wish proposal?
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowDeclineModal(false)}
                  className="flex-1 py-3 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDecline}
                  className="flex-1 py-3 rounded-xl items-center bg-red-500 active:opacity-90"
                >
                  <Text className="text-white font-semibold">Decline</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <Pressable
          onPress={() => setShowDeleteModal(false)}
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
                  <Ionicons name="trash" size={32} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2 text-center">
                  {isOwnWish ? "Delete Wish?" : "Remove Wish?"}
                </Text>
                <Text className="text-wishy-gray text-center">
                  {isOwnWish
                    ? "This will permanently delete the wish for everyone. This action cannot be undone."
                    : "This will remove the wish from your list. The creator will be notified."}
                </Text>
              </View>

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowDeleteModal(false)}
                  className="flex-1 py-3 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmDelete}
                  className="flex-1 py-3 rounded-xl items-center bg-red-500 active:opacity-90"
                >
                  <Text className="text-white font-semibold">
                    {isOwnWish ? "Delete" : "Remove"}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <Pressable
          onPress={() => setShowRatingModal(false)}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-[90%] max-w-md"
            >
              <View className="items-center mb-6">
                <View className="w-20 h-20 bg-wishy-pink rounded-full items-center justify-center mb-4">
                  <Ionicons name="sparkles" size={40} color="#8B2252" />
                </View>
                <Text className="text-wishy-black font-bold text-2xl mb-2 text-center">
                  {wish.status === "fulfilled" ? "Edit Rating" : "Rate This Wish"}
                </Text>
                <Text className="text-wishy-gray text-center text-sm">
                  How satisfied are you with this experience?
                </Text>
              </View>

              {/* Magic Wands Rating */}
              <View className="mb-6">
                <Text className="text-wishy-black font-semibold mb-3 text-center">
                  Magic Wands
                </Text>
                <View className="flex-row justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((wand) => (
                    <Pressable
                      key={wand}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRating(wand);
                      }}
                      className="items-center"
                    >
                      <Ionicons
                        name={rating >= wand ? "sparkles" : "sparkles-outline"}
                        size={36}
                        color={rating >= wand ? "#8B2252" : "#9A8A8A"}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text className="text-center text-wishy-gray text-sm mt-2">
                  {rating === 0 && "Tap to rate"}
                  {rating === 1 && "Poor"}
                  {rating === 2 && "Fair"}
                  {rating === 3 && "Good"}
                  {rating === 4 && "Very Good"}
                  {rating === 5 && "Excellent!"}
                </Text>
              </View>

              {/* Heart/Cuoricino */}
              <View className="mb-6">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setPraised(!praised);
                  }}
                  className={cn(
                    "flex-row items-center justify-center p-4 rounded-2xl border-2",
                    praised
                      ? "bg-wishy-paleBlush border-wishy-pink"
                      : "bg-gray-50 border-gray-300"
                  )}
                >
                  <Ionicons
                    name={praised ? "heart" : "heart-outline"}
                    size={28}
                    color={praised ? "#D4536B" : "#9A8A8A"}
                  />
                  <Text
                    className={cn(
                      "ml-3 font-semibold text-base",
                      praised ? "text-wishy-darkPink" : "text-wishy-gray"
                    )}
                  >
                    {praised ? "With Love ❤️" : "Add a Heart"}
                  </Text>
                </Pressable>
              </View>

              {/* Review Text */}
              <View className="mb-6">
                <Text className="text-wishy-black font-semibold mb-2">
                  Review (optional)
                </Text>
                <TextInput
                  value={review}
                  onChangeText={setReview}
                  placeholder="Share your thoughts about this experience..."
                  placeholderTextColor="#9A8A8A"
                  multiline
                  numberOfLines={4}
                  className="bg-wishy-paleBlush/30 p-4 rounded-xl text-wishy-black text-base min-h-[100px]"
                  style={{ textAlignVertical: "top" }}
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    setShowRatingModal(false);
                    setRating(0);
                    setPraised(false);
                    setReview("");
                  }}
                  className="flex-1 py-3 rounded-xl items-center border-2 border-wishy-paleBlush active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={confirmFulfill}
                  disabled={rating === 0}
                  className={cn(
                    "flex-1 py-3 rounded-xl items-center active:opacity-90",
                    rating === 0
                      ? "bg-gray-300"
                      : "bg-wishy-black"
                  )}
                >
                  <Text className={cn(
                    "font-semibold",
                    rating === 0 ? "text-gray-500" : "text-wishy-white"
                  )}>
                    Confirm
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={proposedDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate && event.type === "set") {
              // Keep the existing time, only update the date
              const newDate = new Date(selectedDate);
              newDate.setHours(proposedDate.getHours());
              newDate.setMinutes(proposedDate.getMinutes());
              setProposedDate(newDate);
            }
          }}
        />
      )}

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={proposedDate}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            setShowTimePicker(false);
            if (selectedTime && event.type === "set") {
              // Keep the existing date, only update the time
              const newDate = new Date(proposedDate);
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setProposedDate(newDate);
            }
          }}
        />
      )}

      {/* Send To User Modal */}
      <Modal
        visible={showSendToModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowSendToModal(false);
          setSelectedUserIds([]);
        }}
      >
        <Pressable
          onPress={() => {
            setShowSendToModal(false);
            setSelectedUserIds([]);
          }}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-t-3xl"
              style={{ paddingBottom: insets.bottom }}
            >
              <View className="p-4 border-b border-wishy-paleBlush">
                <View className="w-12 h-1 bg-wishy-paleBlush rounded-full self-center mb-4" />
                <Text className="text-wishy-black font-bold text-xl text-center">
                  {wish.creatorRole === "wisher" ? "Send Offer To" : "Send Request To"}
                </Text>
                <Text className="text-wishy-gray text-center mt-1">
                  {wish.creatorRole === "wisher"
                    ? "Choose who you want to fulfill this wish for"
                    : "Choose who you want to fulfill this wish"}
                </Text>
                {selectedUserIds.length > 0 && (
                  <Text className="text-wishy-darkPink text-center mt-2 font-semibold">
                    {selectedUserIds.length} selected
                  </Text>
                )}
              </View>
              {connectedUsers.length === 0 ? (
                <View className="p-6 items-center">
                  <View className="w-16 h-16 bg-wishy-paleBlush rounded-full items-center justify-center mb-3">
                    <Ionicons name="people-outline" size={32} color="#8B2252" />
                  </View>
                  <Text className="text-wishy-black font-semibold text-lg mb-2">
                    No Connected Users
                  </Text>
                  <Text className="text-wishy-gray text-center mb-4">
                    Connect with others first to send them wishes
                  </Text>
                  <Pressable
                    onPress={() => setShowSendToModal(false)}
                    className="bg-wishy-black px-6 py-3 rounded-xl"
                  >
                    <Text className="text-wishy-white font-semibold">Close</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ScrollView className="max-h-96">
                    {connectedUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <Pressable
                          key={user.id}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            if (isSelected) {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                            } else {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            }
                          }}
                          className={cn(
                            "flex-row items-center p-4 border-b border-wishy-paleBlush active:bg-wishy-paleBlush/30",
                            isSelected && "bg-wishy-paleBlush/30"
                          )}
                        >
                          {user.profilePhoto ? (
                            <Image
                              source={{ uri: user.profilePhoto }}
                              style={{ width: 56, height: 56 }}
                              className="rounded-full mr-4"
                            />
                          ) : (
                            <View className="w-14 h-14 rounded-full bg-wishy-paleBlush items-center justify-center mr-4">
                              <Ionicons name="person" size={28} color="#4A1528" />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="text-wishy-black font-semibold text-base">
                              {user.name}
                            </Text>
                            {user.bio && (
                              <Text className="text-wishy-gray text-sm mt-1" numberOfLines={2}>
                                {user.bio}
                              </Text>
                            )}
                            <Text className="text-wishy-darkPink text-xs mt-1 capitalize">
                              {user.role}
                            </Text>
                          </View>
                          {isSelected ? (
                            <Ionicons name="checkmark-circle" size={24} color="#4A1528" />
                          ) : (
                            <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {selectedUserIds.length > 0 && (
                    <View className="p-4 border-t border-wishy-paleBlush">
                      <Pressable
                        onPress={handleSendToUsers}
                        className="bg-wishy-black py-4 rounded-xl items-center"
                      >
                        <Text className="text-wishy-white font-semibold text-base">
                          Send to {selectedUserIds.length} {selectedUserIds.length === 1 ? "user" : "users"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Date Modal */}
      <Modal
        visible={showEditDateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditDateModal(false)}
      >
        <Pressable
          onPress={() => setShowEditDateModal(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-t-3xl p-6"
            >
              <View className="w-12 h-1 bg-wishy-paleBlush rounded-full self-center mb-6" />

              <Text className="text-wishy-black font-bold text-xl mb-2">
                Edit Date & Time
              </Text>
              <Text className="text-wishy-gray mb-6">
                Change the date and time for this wish. The other person will be notified.
              </Text>

              {/* Date and Time Selection */}
              <View className="gap-3 mb-4">
                <Pressable
                  onPress={() => {
                    setShowEditDatePicker(!showEditDatePicker);
                    setShowEditTimePicker(false);
                  }}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {editDate.toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name={showEditDatePicker ? "chevron-down" : "chevron-forward"} size={20} color="#8B2252" />
                </Pressable>

                {showEditDatePicker && (
                  <View className="bg-white rounded-xl overflow-hidden">
                    <DateTimePicker
                      value={editDate}
                      mode="date"
                      display="spinner"
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          const newDate = new Date(selectedDate);
                          newDate.setHours(editDate.getHours());
                          newDate.setMinutes(editDate.getMinutes());
                          setEditDate(newDate);
                        }
                      }}
                    />
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    setShowEditTimePicker(!showEditTimePicker);
                    setShowEditDatePicker(false);
                  }}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {editDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Ionicons name={showEditTimePicker ? "chevron-down" : "chevron-forward"} size={20} color="#8B2252" />
                </Pressable>

                {showEditTimePicker && (
                  <View className="bg-white rounded-xl overflow-hidden">
                    <DateTimePicker
                      value={editDate}
                      mode="time"
                      display="spinner"
                      onChange={(event, selectedTime) => {
                        if (selectedTime) {
                          const newDate = new Date(editDate);
                          newDate.setHours(selectedTime.getHours());
                          newDate.setMinutes(selectedTime.getMinutes());
                          setEditDate(newDate);
                        }
                      }}
                    />
                  </View>
                )}
              </View>

              {/* Optional Message */}
              <TextInput
                value={proposalMessage}
                onChangeText={setProposalMessage}
                placeholder="Add a message about the change (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                className="bg-wishy-paleBlush/30 rounded-xl p-4 text-wishy-black mb-4 min-h-[80px]"
                style={{ textAlignVertical: "top" }}
              />

              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => setShowEditDateModal(false)}
                  className="flex-1 py-4 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={handleUpdateDate}
                  className="flex-1 py-4 rounded-xl items-center bg-wishy-black active:opacity-90"
                >
                  <Text className="text-wishy-white font-semibold">Update</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
