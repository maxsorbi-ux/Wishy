import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Modal, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useNotificationStore from "../state/notificationStore";
import useUserStore from "../state/userStore";
import useConnectionStore from "../state/connectionStore";
import { useToastStore } from "../state/toastStore";
import { cn } from "../utils/cn";
import { ConnectionType, Notification } from "../types/wishy";
import * as Notifications from "expo-notifications";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();

  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const fetchAllUsers = useUserStore((s) => s.fetchAllUsers);
  const allNotificationsRaw = useNotificationStore((s) => s.notifications);
  const syncNotifications = useNotificationStore((s) => s.syncNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const deleteNotification = useNotificationStore((s) => s.deleteNotification);
  const relationshipUpgradeRequests = useConnectionStore((s) => s.relationshipUpgradeRequests);
  const contactRequests = useConnectionStore((s) => s.contactRequests);
  const acceptContactRequest = useConnectionStore((s) => s.acceptContactRequest);
  const rejectContactRequest = useConnectionStore((s) => s.rejectContactRequest);
  const syncConnections = useConnectionStore((s) => s.syncConnections);
  const showToast = useToastStore((s) => s.showToast);
  const getChatByUser = useConnectionStore((s) => s.getChatsForUser);
  const [refreshing, setRefreshing] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [selectedSenderName, setSelectedSenderName] = useState<string>("");

  const userId = currentUser?.id || "";
  const notifications = React.useMemo(
    () =>
      allNotificationsRaw
        .filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [allNotificationsRaw, userId]
  );
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Sync connections and notifications when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      syncConnections();
      fetchAllUsers();
      syncNotifications();
      Notifications.setBadgeCountAsync(unreadCount);

    }, [syncConnections, fetchAllUsers, syncNotifications, unreadCount])
  );

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([syncConnections(), fetchAllUsers(), syncNotifications()]);
    setRefreshing(false);
  }, [syncConnections, fetchAllUsers, syncNotifications]);

  // Find pending contact request by ID
  const findPendingContactRequest = (requestId: string) => {
    return contactRequests.find(
      (r) => r.id === requestId && r.status === "pending"
    );
  };

  const handleAcceptRequest = async (connectionType: ConnectionType) => {
    if (!selectedRequestId || !currentUser) {
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowTypeModal(false);

    try {
      // Accept the request with the specified connection type directly
      await acceptContactRequest(selectedRequestId, connectionType);

      showToast(
        connectionType === "relationship"
          ? "Connessione accettata come relazione!"
          : "Connessione accettata come amicizia!"
      );

      // Sync to get all the latest data
      await syncConnections();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Errore nell'accettare la richiesta";
      showToast(errorMessage, "error");
    }

    setSelectedRequestId(null);
    setSelectedSenderId(null);
    setSelectedSenderName("");
  };

  const handleRejectRequest = (requestId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rejectContactRequest(requestId);
    showToast("Contact request declined", "info");
  };

  const handleNotificationPress = async(notificationId: string, type: string, relatedId?: string) => {

    const wissiDD = getChatByUser(currentUser?.id ?? "").find(i => i.id === relatedId)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAsRead(notificationId);


    // Navigate based on notification type
    if (!relatedId) {
      return;
    }

    switch (type) {
      case "connection_request":
        // For connection requests, check if there is a pending request and show the accept modal
        const pendingRequest = findPendingContactRequest(relatedId);
        if (pendingRequest) {
          const sender = allUsers.find((u) => u.id === pendingRequest.senderId);
          setSelectedRequestId(relatedId);
          setSelectedSenderId(pendingRequest.senderId);
          setSelectedSenderName(sender?.name || "this person");
          setShowTypeModal(true);
        } else {
          // Request already handled, go to connections
          navigation.navigate("MainTabs", { screen: "Connections" });
        }
        break;

      case "connection_accepted":
        // Navigate to Connections tab
        navigation.navigate("MainTabs", { screen: "Connections" });
        break;

      case "relationship_upgrade_request":
      case "relationship_upgraded":
        // Find the upgrade request and navigate to manage connection
        const upgradeRequest = relationshipUpgradeRequests.find(r => r.id === relatedId);
        if (upgradeRequest) {
          // Determine the other user ID
          const otherUserId = upgradeRequest.senderId === currentUser?.id
            ? upgradeRequest.receiverId
            : upgradeRequest.senderId;
          navigation.navigate("ManageConnection", { userId: otherUserId });
        }
        break;

      case "wish_received":
        navigation.navigate("WishDetail", { wishId: relatedId ?? ""});
        break;
                    
      case "wish_accepted":
                navigation.navigate("WishDetail", { wishId: relatedId ?? ""});
                break;

      case "date_proposed":
        navigation.navigate("WishDetail", { wishId: relatedId ?? ""});
        break;
      case "date_changed":
        navigation.navigate("WishDetail", { wishId: relatedId ?? ""});
        break;
      case "date_confirmed":
        navigation.navigate("WishDetail", { wishId: relatedId ?? ""});
        break;

      default:
        navigation.navigate("Chat", { wishId: wissiDD?.wishId ?? "" });
    }
  };

  const handleMarkAllRead = () => {
    if (!currentUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Notifications.setBadgeCountAsync(0);
    markAllAsRead(currentUser.id);
  };

  const handleDelete = (notificationId: string, event: any) => {
    event.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deleteNotification(notificationId);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "wish_received":
        return "gift";
      case "wish_accepted":
        return "checkmark-circle";
      case "date_proposed":
      case "date_changed":
      case "date_confirmed":
        return "calendar";
      case "connection_request":
        return "person-add";
      case "connection_accepted":
        return "people";
      case "relationship_upgrade_request":
        return "heart-circle";
      case "relationship_upgraded":
        return "heart";
      case "message_received":
        return "chatbubble";
      default:
        return "notifications";
    }
  };

  // Check if notification is a pending connection request
  const isActionableConnectionRequest = (notification: Notification) => {
    if (notification.type !== "connection_request" || !notification.relatedId) {
      return false;
    }
    return !!findPendingContactRequest(notification.relatedId);
  };

  // Render notification card with action buttons for connection requests
  const renderNotificationCard = (notification: Notification, index: number) => {
    const isPendingRequest = isActionableConnectionRequest(notification);
    const request = isPendingRequest && notification.relatedId
      ? findPendingContactRequest(notification.relatedId)
      : null;
    const sender = request ? allUsers.find((u) => u.id === request.senderId) : null;

    return (
      <Animated.View
        key={notification.id}
        entering={FadeInDown.delay(index * 50).duration(300)}
      >
        <Pressable
          onPress={() => handleNotificationPress(notification.id, notification.type, notification.relatedId)}
          className={cn(
            "mx-4 mt-3 p-4 rounded-xl border",
            notification.read
              ? "bg-white border-wishy-paleBlush"
              : "bg-wishy-paleBlush/30 border-wishy-pink"
          )}
        >
          <View className="flex-row">
            {/* Icon or Sender Photo */}
            {isPendingRequest && sender?.profilePhoto ? (
              <View className="w-12 h-12 rounded-full overflow-hidden mr-3 border-2 border-wishy-pink">
                <Image
                  source={{ uri: sender.profilePhoto }}
                  style={{ width: 48, height: 48 }}
                  contentFit="cover"
                />
              </View>
            ) : (
              <View
                className={cn(
                  "w-12 h-12 rounded-full items-center justify-center mr-3",
                  notification.read ? "bg-wishy-paleBlush" : "bg-wishy-pink"
                )}
              >
                <Ionicons
                  name={getNotificationIcon(notification.type) as any}
                  size={24}
                  color="#4A1528"
                />
              </View>
            )}

            <View className="flex-1">
              <Text className="text-wishy-black font-semibold text-base mb-1">
                {notification.title}
              </Text>
              <Text className="text-wishy-gray text-sm mb-2">{notification.message}</Text>

              {/* Action Buttons for Pending Connection Requests */}
              {isPendingRequest && request && (
                <View className="flex-row space-x-2 mt-2">
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      handleRejectRequest(request.id);
                    }}
                    className="flex-1 py-2 px-4 bg-wishy-white rounded-full items-center border border-wishy-paleBlush active:opacity-70"
                  >
                    <Text className="text-wishy-black font-medium">Decline</Text>
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedRequestId(request.id);
                      setSelectedSenderId(request.senderId);
                      setSelectedSenderName(sender?.name || "this person");
                      setShowTypeModal(true);
                    }}
                    className="flex-1 py-2 px-4 bg-wishy-black rounded-full items-center active:opacity-80"
                  >
                    <Text className="text-wishy-white font-medium">Accept</Text>
                  </Pressable>
                </View>
              )}

              <Text className="text-wishy-gray text-xs mt-2">
                {new Date(notification.createdAt).toLocaleString()}
              </Text>
            </View>

            <Pressable
              onPress={(e) => handleDelete(notification.id, e)}
              className="w-8 h-8 items-center justify-center"
            >
              <Ionicons name="close" size={20} color="#9A8A8A" />
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <View className="flex-1 bg-wishy-white">
      {/* Header */}
      <View style={{ paddingTop: insets.top }} className="bg-white border-b border-wishy-paleBlush">
        <View className="flex-row items-center justify-between px-4 py-3">
          <View className="flex-row items-center">
            <Pressable
              onPress={() => navigation.goBack()}
              className="w-10 h-10 items-center justify-center mr-2"
            >
              <Ionicons name="chevron-back" size={24} color="#4A1528" />
            </Pressable>
            <Text className="text-wishy-black font-bold text-xl">Notifications</Text>
            {unreadCount > 0 && (
              <View className="ml-2 bg-wishy-pink px-2 py-0.5 rounded-full">
                <Text className="text-wishy-black text-xs font-semibold">{unreadCount}</Text>
              </View>
            )}
          </View>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead} className="px-3 py-2">
              <Text className="text-wishy-black font-medium text-sm">Mark all read</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Notifications List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
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
        {notifications.length === 0 ? (
          <View className="items-center justify-center py-20">
            <View className="w-20 h-20 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
              <Ionicons name="notifications-outline" size={40} color="#8B2252" />
            </View>
            <Text className="text-wishy-black font-semibold text-lg">No Notifications</Text>
            <Text className="text-wishy-gray text-center mt-2 px-8">
              When you receive wishes or updates, they will appear here
            </Text>
          </View>
        ) : (
          notifications.map((notification, index) => renderNotificationCard(notification, index))
        )}
      </ScrollView>

      {/* Connection Type Selection Modal */}
      <Modal
        visible={showTypeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <Pressable
          onPress={() => setShowTypeModal(false)}
          className="flex-1 bg-black/50 justify-center items-center px-6"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden"
            >
              <View className="p-5 border-b border-wishy-paleBlush">
                <Text className="text-wishy-black font-bold text-lg text-center">
                  Choose Connection Type
                </Text>
                <Text className="text-wishy-gray text-center mt-1 text-sm">
                  How do you want to connect with {selectedSenderName}?
                </Text>
              </View>

              <View className="p-4">
                {/* Friend Option */}
                <Pressable
                  onPress={() => handleAcceptRequest("friend")}
                  className="flex-row items-center p-4 bg-wishy-paleBlush/30 rounded-xl mb-3 active:opacity-80"
                >
                  <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
                    <Ionicons name="people" size={24} color="#3B82F6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-wishy-black font-semibold text-base">Friend</Text>
                    <Text className="text-wishy-gray text-sm mt-0.5">
                      Connect as friends to share wishes
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
                </Pressable>

                {/* Relationship Option */}
                <Pressable
                  onPress={() => handleAcceptRequest("relationship")}
                  className="flex-row items-center p-4 bg-pink-50 rounded-xl active:opacity-80"
                >
                  <View className="w-12 h-12 bg-pink-100 rounded-full items-center justify-center mr-3">
                    <Ionicons name="heart" size={24} color="#EC4899" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-wishy-black font-semibold text-base">Relationship</Text>
                    <Text className="text-wishy-gray text-sm mt-0.5">
                      Connect as partners for couple mode
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
                </Pressable>
              </View>

              {/* Cancel Button */}
              <Pressable
                onPress={() => setShowTypeModal(false)}
                className="p-4 border-t border-wishy-paleBlush"
              >
                <Text className="text-wishy-gray font-semibold text-center">Cancel</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
