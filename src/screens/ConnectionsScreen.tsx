import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, TextInput, RefreshControl, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useConnectionStore from "../state/connectionStore";
import useUserStore from "../state/userStore";
import { useToastStore } from "../state/toastStore";
import { Connection, User, ContactRequest, ConnectionType } from "../types/wishy";
import { cn } from "../utils/cn";
import { useModalState } from "../hooks/useModalState";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ConnectionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const fetchAllUsers = useUserStore((s) => s.fetchAllUsers);
  const getAcceptedConnections = useConnectionStore((s) => s.getAcceptedConnections);
  const getPendingRequestsReceived = useConnectionStore((s) => s.getPendingRequestsReceived);
  const sendContactRequest = useConnectionStore((s) => s.sendContactRequest);
  const syncConnections = useConnectionStore((s) => s.syncConnections);
  const isSyncing = useConnectionStore((s) => s.isSyncing);
  const showToast = useToastStore((s) => s.showToast);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = currentUser?.id || "";
  const acceptedConnections = getAcceptedConnections(userId);
  const pendingRequests = getPendingRequestsReceived(userId);

  // Sync connections when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      syncConnections();
      fetchAllUsers();
    }, [])
  );

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([syncConnections(), fetchAllUsers()]);
    // Get the updated allUsers after fetch
    const updatedUsers = useUserStore.getState().allUsers;
    if (updatedUsers.length > 0) {
    }
    setRefreshing(false);
  }, [currentUser?.id, currentUser?.name]);

  // Filter users based on search query only (removed preference filters for simplicity)
  // This ensures all users can find each other regardless of preference settings
  const searchResults = searchQuery.trim()
    ? allUsers.filter((user) => {
        // Don't show current user in search
        if (user.id === currentUser?.id) return false;

        // Check if the search query matches name or email
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query);

        return matchesQuery;
      })
    : [];

  // Log search results when searching
  if (searchQuery.trim()) {
    if (allUsers.length > 0) {
    }
  }

  const handleQRCode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("QRCode");
  };

  const handleToggleSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchQuery("");
    }
  };

  const handleConnectUser = async (targetUserId: string) => {
    if (!currentUser) {
      showToast("Please login first", "error");
      return;
    }


    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await sendContactRequest(currentUser.id, targetUserId);
      setSearchQuery("");
      showToast("Connection request sent!");
      // Sync to update the UI
      await syncConnections();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(
        error instanceof Error ? error.message : "Failed to send request",
        "error"
      );
    }
  };

  const handleLogoPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Landing");
  };

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

      <ScrollView
        style={{ paddingTop: insets.top }}
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isSyncing}
            onRefresh={onRefresh}
            tintColor="#8B2252"
            colors={["#8B2252"]}
          />
        }
      >
        {/* Search and QR Code Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View className="flex-row gap-3 mb-2">
            {/* Search Button/Input */}
            <View className="flex-1">
              {showSearch ? (
                <View className="bg-white rounded-2xl px-4 py-3 flex-row items-center border-2 border-wishy-pink">
                  <Ionicons name="search" size={20} color="#8B2252" />
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search by name or email..."
                    placeholderTextColor="#9A8A8A"
                    autoFocus
                    className="flex-1 ml-2 text-wishy-black text-base"
                  />
                  <Pressable onPress={handleToggleSearch}>
                    <Ionicons name="close-circle" size={20} color="#8B2252" />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleToggleSearch}
                  className="bg-wishy-pink/30 rounded-2xl p-4 flex-row items-center justify-center active:opacity-95 border-2 border-wishy-pink"
                >
                  <Ionicons name="search" size={24} color="#000000" />
                  <Text className="text-wishy-black font-semibold ml-2">
                    Search Users
                  </Text>
                </Pressable>
              )}
            </View>

            {/* QR Code Button */}
            <Pressable
              onPress={handleQRCode}
              className="bg-wishy-pink rounded-2xl p-4 items-center justify-center active:opacity-95"
            >
              <Ionicons name="qr-code" size={24} color="#000000" />
            </Pressable>
          </View>
        </Animated.View>

        {/* Search Results */}
        {showSearch && searchQuery.trim() && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text className="text-wishy-black font-semibold text-lg mb-3">
              Search Results
            </Text>
            {searchResults.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 items-center">
                <Ionicons name="search-outline" size={40} color="#9A8A8A" />
                <Text className="text-wishy-gray text-center mt-2">
                  No users found matching &quot;{searchQuery}&quot;
                </Text>
              </View>
            ) : (
              <View className="space-y-3">
                {searchResults.map((user) => (
                  <UserSearchCard
                    key={user.id}
                    user={user}
                    onConnect={handleConnectUser}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text className="text-wishy-black font-semibold text-lg mb-3">
              Pending Requests
            </Text>
            <View className="space-y-3">
              {pendingRequests.map((request) => {
                // Get the user who sent the request
                const requesterUser = allUsers.find((u) => u.id === request.senderId);

                return (
                  <ContactRequestCard
                    key={request.id}
                    request={request}
                    requesterUser={requesterUser}
                  />
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Active Connections */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text className="text-wishy-black font-semibold text-lg mb-3">
            Your Connections
          </Text>
          {acceptedConnections.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <View className="w-20 h-20 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
                <Ionicons name="people-outline" size={40} color="#8B2252" />
              </View>
              <Text className="text-wishy-black font-semibold text-base">
                No connections yet
              </Text>
              <Text className="text-wishy-gray text-center mt-2 text-sm">
                Share your QR code or search for users to start connecting
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {acceptedConnections.map((connection) => {
                // Get the connected user (the one who is not current user)
                const connectedUserId = connection.senderId === userId
                  ? connection.receiverId
                  : connection.senderId;
                const connectedUser = allUsers.find((u) => u.id === connectedUserId);

                if (!connectedUser) return null;

                return (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    connectedUser={connectedUser}
                    isPending={false}
                  />
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Tips Section */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View className="bg-wishy-paleBlush/50 rounded-2xl p-5">
            <View className="flex-row items-center mb-3">
              <Ionicons name="bulb" size={20} color="#8B2252" />
              <Text className="text-wishy-black font-semibold ml-2">
                Connection Tips
              </Text>
            </View>
            <Text className="text-wishy-black text-sm leading-5">
              • Share your QR code at Wishy Parties{"\n"}
              • Connect with your partner for couple mode{"\n"}
              • Use the Search Users button to find people
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ConnectionCard({
  connection,
  connectedUser,
  isPending,
}: {
  connection: Connection;
  connectedUser?: User;
  isPending: boolean;
}) {
  const navigation = useNavigation<NavigationProp>();
  const updateStatus = useConnectionStore((s) => s.updateConnectionStatus);
  const showToast = useToastStore((s) => s.showToast);

  const handleAccept = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateStatus(connection.id, "accepted");
    showToast("Connection accepted!");
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateStatus(connection.id, "blocked");
    showToast("Connection declined", "info");
  };

  const handleViewProfile = () => {
    if (connectedUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("UserProfile", { userId: connectedUser.id });
    }
  };

  const handleManageConnection = () => {
    if (connectedUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("ManageConnection", { userId: connectedUser.id });
    }
  };

  return (
    <View className="bg-white rounded-xl p-4 flex-row items-center">
      <Pressable
        onPress={!isPending ? handleViewProfile : undefined}
        className="flex-row items-center flex-1 active:opacity-80"
      >
        <View className="w-14 h-14 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
          {connectedUser?.profilePhoto ? (
            <Image
              source={{ uri: connectedUser.profilePhoto }}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="person" size={28} color="#8B2252" />
          )}
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-wishy-black font-bold text-base">
            {isPending ? "New Connection Request" : connectedUser?.name || "Unknown User"}
          </Text>
          {connectedUser?.bio && !isPending && (
            <Text className="text-wishy-gray text-sm mt-1" numberOfLines={1}>
              {connectedUser.bio}
            </Text>
          )}
          {!isPending && (
            <View className="flex-row items-center mt-1">
              {connection.type === "relationship" && (
                <View className="flex-row items-center">
                  <Ionicons name="heart" size={12} color="#8B2252" />
                  <Text className="text-wishy-pink text-xs ml-1 font-semibold">
                    In a Relationship
                  </Text>
                </View>
              )}
              {connection.type === "friend" && (
                <Text className="text-wishy-gray text-xs">
                  Friend
                </Text>
              )}
            </View>
          )}
        </View>
      </Pressable>
      {isPending ? (
        <View className="flex-row space-x-2">
          <Pressable
            onPress={handleDecline}
            className="w-10 h-10 bg-wishy-white rounded-full items-center justify-center border border-wishy-paleBlush"
          >
            <Ionicons name="close" size={20} color="#8B2252" />
          </Pressable>
          <Pressable
            onPress={handleAccept}
            className="w-10 h-10 bg-wishy-black rounded-full items-center justify-center"
          >
            <Ionicons name="checkmark" size={20} color="#FFF8F0" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={handleManageConnection}
          className="w-10 h-10 bg-wishy-paleBlush rounded-full items-center justify-center active:opacity-70"
        >
          <Ionicons name="settings-outline" size={20} color="#8B2252" />
        </Pressable>
      )}
    </View>
  );
}

function ContactRequestCard({
  request,
  requesterUser,
}: {
  request: ContactRequest;
  requesterUser?: User;
}) {
  const navigation = useNavigation<NavigationProp>();
  const acceptContactRequest = useConnectionStore((s) => s.acceptContactRequest);
  const rejectContactRequest = useConnectionStore((s) => s.rejectContactRequest);
  const updateConnectionType = useConnectionStore((s) => s.updateConnectionType);
  const getConnectionBetweenUsers = useConnectionStore((s) => s.getConnectionBetweenUsers);
  const currentUser = useUserStore((s) => s.currentUser);
  const showToast = useToastStore((s) => s.showToast);
  const { show: showModal, hide: hideModal, isVisible } = useModalState("type");

  const handleAccept = async (connectionType: ConnectionType) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    hideModal("type");

    // Accept the request (creates connection as "friend" by default)
    await acceptContactRequest(request.id);

    // If relationship was selected, update the connection type
    if (connectionType === "relationship" && currentUser && requesterUser) {
      // Wait a moment for the connection to be created
      setTimeout(async () => {
        const connection = getConnectionBetweenUsers(currentUser.id, requesterUser.id);
        if (connection) {
          await updateConnectionType(connection.id, "relationship");
        }
      }, 500);
    }

    showToast(
      connectionType === "relationship"
        ? "Connection accepted as relationship!"
        : "Connection accepted as friend!"
    );
  };

  const handleDecline = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rejectContactRequest(request.id);
    showToast("Contact request declined", "info");
  };

  const handleViewProfile = () => {
    if (requesterUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("UserProfile", { userId: requesterUser.id });
    }
  };

  return (
    <>
      <View className="bg-white rounded-xl p-4 flex-row items-center">
        <Pressable onPress={handleViewProfile} className="flex-row items-center flex-1">
          <View className="w-14 h-14 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
            {requesterUser?.profilePhoto ? (
              <Image
                source={{ uri: requesterUser.profilePhoto }}
                style={{ width: 56, height: 56 }}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="person" size={28} color="#8B2252" />
            )}
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-wishy-black font-bold text-base">
              {requesterUser?.name || "Unknown User"}
            </Text>
            {request.message ? (
              <Text className="text-wishy-gray text-sm mt-1" numberOfLines={2}>
                {request.message}
              </Text>
            ) : (
              <Text className="text-wishy-gray text-sm mt-1">
                wants to connect with you
              </Text>
            )}
          </View>
        </Pressable>
        <View className="flex-row space-x-2 ml-2">
          <Pressable
            onPress={handleDecline}
            className="w-10 h-10 bg-wishy-white rounded-full items-center justify-center border border-wishy-paleBlush"
          >
            <Ionicons name="close" size={20} color="#8B2252" />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              showModal("type");
            }}
            className="w-10 h-10 bg-wishy-black rounded-full items-center justify-center"
          >
            <Ionicons name="checkmark" size={20} color="#FFF8F0" />
          </Pressable>
        </View>
      </View>

      {/* Connection Type Selection Modal */}
      <Modal
        visible={isVisible("type")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("type")}
      >
        <Pressable
          onPress={() => hideModal("type")}
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
                  How do you want to connect with {requesterUser?.name || "this person"}?
                </Text>
              </View>

              <View className="p-4">
                {/* Friend Option */}
                <Pressable
                  onPress={() => handleAccept("friend")}
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
                  onPress={() => handleAccept("relationship")}
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
                onPress={() => hideModal("type")}
                className="p-4 border-t border-wishy-paleBlush"
              >
                <Text className="text-wishy-gray font-semibold text-center">Cancel</Text>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function UserSearchCard({
  user,
  onConnect,
}: {
  user: User;
  onConnect: (userId: string) => void;
}) {
  const connections = useConnectionStore((s) => s.connections);
  const contactRequests = useConnectionStore((s) => s.contactRequests);
  const currentUser = useUserStore((s) => s.currentUser);

  // Check if already connected
  const existingConnection = connections.find(
    (conn) =>
      ((conn.senderId === currentUser?.id && conn.receiverId === user.id) ||
       (conn.receiverId === currentUser?.id && conn.senderId === user.id)) &&
      conn.status === "accepted"
  );

  // Check for pending request (only status "pending", not accepted)
  const pendingRequest = contactRequests.find(
    (req) =>
      ((req.senderId === currentUser?.id && req.receiverId === user.id) ||
       (req.receiverId === currentUser?.id && req.senderId === user.id)) &&
      req.status === "pending"
  );

  // Check for accepted request (connection might not be created yet)
  const acceptedRequest = contactRequests.find(
    (req) =>
      ((req.senderId === currentUser?.id && req.receiverId === user.id) ||
       (req.receiverId === currentUser?.id && req.senderId === user.id)) &&
      req.status === "accepted"
  );

  const isConnected = !!existingConnection || !!acceptedRequest;
  const isPending = !!pendingRequest;

  return (
    <View className="bg-white rounded-xl p-4 flex-row items-center">
      {/* Profile Photo */}
      <View className="w-14 h-14 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
        {user.profilePhoto ? (
          <Image
            source={{ uri: user.profilePhoto }}
            style={{ width: 56, height: 56 }}
            contentFit="cover"
          />
        ) : (
          <Ionicons name="person" size={28} color="#8B2252" />
        )}
      </View>

      {/* User Info */}
      <View className="flex-1 ml-3">
        <Text className="text-wishy-black font-bold text-base">{user.name}</Text>
        <Text className="text-wishy-gray text-sm mt-0.5">{user.email}</Text>
        <View className="flex-row items-center mt-1">
          <View className="bg-wishy-paleBlush px-2 py-1 rounded-full">
            <Text className="text-wishy-black text-xs capitalize">
              {user.role === "both" ? "Wisher & Wished" : user.role}
            </Text>
          </View>
        </View>
      </View>

      {/* Connect Button */}
      {isConnected ? (
        <View className="bg-green-100 px-4 py-2 rounded-full">
          <Text className="text-green-700 font-semibold text-sm">Connected</Text>
        </View>
      ) : isPending ? (
        <View className="bg-orange-100 px-4 py-2 rounded-full">
          <Text className="text-orange-700 font-semibold text-sm">Pending</Text>
        </View>
      ) : (
        <Pressable
          onPress={() => onConnect(user.id)}
          className="bg-wishy-pink px-4 py-2 rounded-full active:opacity-80"
        >
          <Text className="text-wishy-black font-semibold">Connect</Text>
        </Pressable>
      )}
    </View>
  );
}
