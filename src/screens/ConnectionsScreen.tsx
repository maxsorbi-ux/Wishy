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
import { Connection, User, ContactRequest, ConnectionType, RelationshipUpgradeRequest } from "../types/wishy";
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
  const getPendingRequestsSent = useConnectionStore((s) => s.getPendingRequestsSent);
  const getPendingUpgradeRequestsReceived = useConnectionStore((s) => s.getPendingUpgradeRequestsReceived);
  const getPendingUpgradeRequestsSent = useConnectionStore((s) => s.getPendingUpgradeRequestsSent);
  const sendContactRequest = useConnectionStore((s) => s.sendContactRequest);
  const syncConnections = useConnectionStore((s) => s.syncConnections);
  const isSyncing = useConnectionStore((s) => s.isSyncing);
  const showToast = useToastStore((s) => s.showToast);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = currentUser?.id || "";
  const acceptedConnections = getAcceptedConnections(userId);
  const pendingRequestsReceived = getPendingRequestsReceived(userId);
  const pendingRequestsSent = getPendingRequestsSent(userId);
  const pendingUpgradesReceived = getPendingUpgradeRequestsReceived(userId);
  const pendingUpgradesSent = getPendingUpgradeRequestsSent(userId);

  useFocusEffect(
    useCallback(() => {
      syncConnections();
      fetchAllUsers();
    }, [])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([syncConnections(), fetchAllUsers()]);
    setRefreshing(false);
  }, []);

  const searchResults = searchQuery.trim()
    ? allUsers.filter((user) => {
        if (user.id === currentUser?.id) return false;
        const prefs = currentUser?.searchPreferences;
        if (prefs) {
          if (prefs.roles.length > 0 && !prefs.roles.includes(user.role)) return false;
          if (prefs.genders.length > 0 && (!user.gender || !prefs.genders.includes(user.gender))) return false;
          if (
            prefs.relationshipPreferences.length > 0 &&
            (!user.relationshipPreference || !prefs.relationshipPreferences.includes(user.relationshipPreference))
          ) return false;
        }
        const query = searchQuery.toLowerCase();
        return (
          user.name.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        );
      })
    : [];

  const searchResultIds = searchResults.map((u) => u.id);

  const handleToggleSearch = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowSearch(!showSearch);
    if (showSearch) setSearchQuery("");
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
      await syncConnections();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(
        error instanceof Error ? error.message : "Failed to send request",
        "error"
      );
    }
  };

  const hasPendingRequests =
    pendingRequestsReceived.length > 0 ||
    pendingRequestsSent.length > 0 ||
    pendingUpgradesReceived.length > 0 ||
    pendingUpgradesSent.length > 0;

  const prefs = currentUser?.searchPreferences;
  const activeFilterCount =
    (prefs?.roles?.length ?? 0) +
    (prefs?.genders?.length ?? 0) +
    (prefs?.relationshipPreferences?.length ?? 0);
  const hasActiveFilters = activeFilterCount > 0;

  const handleSearchSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("Settings");
  };

  return (
    <View className="flex-1 bg-wishy-white">
      <ScrollView
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
        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View className="flex-row gap-3 mb-2 items-center">
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
                  <Text className="text-wishy-black font-semibold ml-2">Search Users</Text>
                </Pressable>
              )}
            </View>

            {/* Search Settings Button */}
            <Pressable
              onPress={handleSearchSettings}
              className="w-12 h-12 bg-white rounded-2xl items-center justify-center active:opacity-70 border-2 border-wishy-paleBlush"
            >
              <Ionicons name="options-outline" size={22} color="#8B2252" />
              {activeFilterCount > 0 && (
                <View
                  style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#8B2252", alignItems: "center", justifyContent: "center", paddingHorizontal: 3 }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>
                    {activeFilterCount}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Active filters summary */}
          {hasActiveFilters && (
            <View className="flex-row items-center gap-2 flex-wrap mt-1">
              <Ionicons name="funnel" size={12} color="#8B2252" />
              {(prefs?.roles?.length ?? 0) > 0 && (
                <View className="bg-wishy-pink/40 px-2 py-0.5 rounded-full">
                  <Text className="text-wishy-black text-xs">{prefs!.roles.join(", ")}</Text>
                </View>
              )}
              {(prefs?.genders?.length ?? 0) > 0 && (
                <View className="bg-wishy-pink/40 px-2 py-0.5 rounded-full">
                  <Text className="text-wishy-black text-xs">{prefs!.genders.join(", ")}</Text>
                </View>
              )}
              {(prefs?.relationshipPreferences?.length ?? 0) > 0 && (
                <View className="bg-wishy-pink/40 px-2 py-0.5 rounded-full">
                  <Text className="text-wishy-black text-xs">{prefs!.relationshipPreferences.join(", ")}</Text>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* ── Section 1: Search Results ── */}
        {showSearch && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <Text className="text-wishy-black font-bold text-xl mb-3">Search Results</Text>
            {!searchQuery.trim() ? (
              <View className="bg-white rounded-2xl p-6 items-center">
                <Ionicons name="search-outline" size={40} color="#9A8A8A" />
                <Text className="text-wishy-gray text-center mt-2">
                  Type a name or email to find users
                </Text>
              </View>
            ) : searchResults.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 items-center">
                <Ionicons name="search-outline" size={40} color="#9A8A8A" />
                <Text className="text-wishy-gray text-center mt-2">
                  No users found matching &quot;{searchQuery}&quot;
                </Text>
              </View>
            ) : (
              <View className="space-y-3">
                {searchResults.map((user, index) => (
                  <UserSearchCard
                    key={user.id}
                    user={user}
                    onConnect={handleConnectUser}
                    userList={searchResultIds}
                    userIndex={index}
                  />
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {/* ── Section 2: Your Connections ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text className="text-wishy-black font-bold text-xl mb-3">Your Connections</Text>
          {acceptedConnections.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center">
              <View className="w-20 h-20 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
                <Ionicons name="people-outline" size={40} color="#8B2252" />
              </View>
              <Text className="text-wishy-black font-semibold text-base">No connections yet</Text>
              <Text className="text-wishy-gray text-center mt-2 text-sm">
                Search for users above to start connecting
              </Text>
            </View>
          ) : (
            <View className="space-y-3">
              {acceptedConnections.map((connection) => {
                const connectedUserId =
                  connection.senderId === userId ? connection.receiverId : connection.senderId;
                const connectedUser = allUsers.find((u) => u.id === connectedUserId);
                if (!connectedUser) return null;
                return (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    connectedUser={connectedUser}
                  />
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* ── Section 3: Pending Requests ── */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text className="text-wishy-black font-bold text-xl mb-3">Pending Requests</Text>
          {!hasPendingRequests ? (
            <View className="bg-white rounded-2xl p-6 items-center">
              <Ionicons name="time-outline" size={40} color="#9A8A8A" />
              <Text className="text-wishy-gray text-center mt-2">No pending requests</Text>
            </View>
          ) : (
            <View className="space-y-3">
              {/* Received contact requests */}
              {pendingRequestsReceived.length > 0 && (
                <>
                  <Text className="text-wishy-gray text-sm font-medium px-1">Received</Text>
                  {pendingRequestsReceived.map((request) => {
                    const requesterUser = allUsers.find((u) => u.id === request.senderId);
                    return (
                      <ContactRequestCard
                        key={request.id}
                        request={request}
                        requesterUser={requesterUser}
                      />
                    );
                  })}
                </>
              )}

              {/* Received relationship upgrade requests */}
              {pendingUpgradesReceived.length > 0 && (
                <>
                  <Text className="text-wishy-gray text-sm font-medium px-1 mt-1">Relationship Requests</Text>
                  {pendingUpgradesReceived.map((request) => {
                    const senderUser = allUsers.find((u) => u.id === request.senderId);
                    return (
                      <RelationshipUpgradeCard
                        key={request.id}
                        request={request}
                        senderUser={senderUser}
                      />
                    );
                  })}
                </>
              )}

              {/* Sent contact requests */}
              {pendingRequestsSent.length > 0 && (
                <>
                  <Text className="text-wishy-gray text-sm font-medium px-1 mt-1">Sent</Text>
                  {pendingRequestsSent.map((request) => {
                    const receiverUser = allUsers.find((u) => u.id === request.receiverId);
                    return (
                      <SentRequestCard
                        key={request.id}
                        request={request}
                        receiverUser={receiverUser}
                      />
                    );
                  })}
                </>
              )}

              {/* Sent relationship upgrade requests */}
              {pendingUpgradesSent.length > 0 && (
                <>
                  <Text className="text-wishy-gray text-sm font-medium px-1 mt-1">Sent Relationship Requests</Text>
                  {pendingUpgradesSent.map((request) => {
                    const receiverUser = allUsers.find((u) => u.id === request.receiverId);
                    return (
                      <SentRelationshipUpgradeCard
                        key={request.id}
                        request={request}
                        receiverUser={receiverUser}
                      />
                    );
                  })}
                </>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ── ConnectionCard ──────────────────────────────────────────────────────────

function ConnectionCard({
  connection,
  connectedUser,
}: {
  connection: Connection;
  connectedUser?: User;
}) {
  const navigation = useNavigation<NavigationProp>();
  const showToast = useToastStore((s) => s.showToast);

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
    <Pressable
      onPress={handleViewProfile}
      className="bg-white rounded-xl p-4 flex-row items-center active:opacity-80"
    >
      <View className="w-20 h-20 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
        {connectedUser?.profilePhoto ? (
          <Image
            source={{ uri: connectedUser.profilePhoto }}
            style={{ width: 80, height: 80 }}
            contentFit="cover"
          />
        ) : (
          <Ionicons name="person" size={40} color="#8B2252" />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-wishy-black font-bold text-base">
          {connectedUser?.name || "Unknown User"}
        </Text>
        {connectedUser?.bio && (
          <Text className="text-wishy-gray text-sm mt-1" numberOfLines={1}>
            {connectedUser.bio}
          </Text>
        )}
        <View className="flex-row items-center mt-1">
          {connection.type === "relationship" ? (
            <View className="flex-row items-center">
              <Ionicons name="heart" size={12} color="#8B2252" />
              <Text className="text-wishy-pink text-xs ml-1 font-semibold">In a Relationship</Text>
            </View>
          ) : (
            <Text className="text-wishy-gray text-xs">Friend</Text>
          )}
        </View>
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          handleManageConnection();
        }}
        className="w-10 h-10 bg-wishy-paleBlush rounded-full items-center justify-center active:opacity-70"
      >
        <Ionicons name="settings-outline" size={20} color="#8B2252" />
      </Pressable>
    </Pressable>
  );
}

// ── ContactRequestCard (received) ──────────────────────────────────────────

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
    await acceptContactRequest(request.id, connectionType);
    if (connectionType === "relationship" && currentUser && requesterUser) {
      setTimeout(async () => {
        const connection = getConnectionBetweenUsers(currentUser.id, requesterUser.id);
        if (connection) await updateConnectionType(connection.id, "relationship");
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
        <Pressable onPress={handleViewProfile} className="flex-row items-center flex-1 active:opacity-80">
          <View className="w-20 h-20 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
            {requesterUser?.profilePhoto ? (
              <Image
                source={{ uri: requesterUser.profilePhoto }}
                style={{ width: 80, height: 80 }}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="person" size={40} color="#8B2252" />
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
              <Text className="text-wishy-gray text-sm mt-1">wants to connect with you</Text>
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

      {/* Connection Type Modal */}
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
                <Pressable
                  onPress={() => handleAccept("friend")}
                  className="flex-row items-center p-4 bg-wishy-paleBlush/30 rounded-xl mb-3 active:opacity-80"
                >
                  <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
                    <Ionicons name="people" size={24} color="#3B82F6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-wishy-black font-semibold text-base">Friend</Text>
                    <Text className="text-wishy-gray text-sm mt-0.5">Connect as friends to share wishes</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
                </Pressable>
                <Pressable
                  onPress={() => handleAccept("relationship")}
                  className="flex-row items-center p-4 bg-pink-50 rounded-xl active:opacity-80"
                >
                  <View className="w-12 h-12 bg-pink-100 rounded-full items-center justify-center mr-3">
                    <Ionicons name="heart" size={24} color="#EC4899" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-wishy-black font-semibold text-base">Relationship</Text>
                    <Text className="text-wishy-gray text-sm mt-0.5">Connect as partners for couple mode</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
                </Pressable>
              </View>
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

// ── SentRequestCard ─────────────────────────────────────────────────────────

function SentRequestCard({
  request,
  receiverUser,
}: {
  request: ContactRequest;
  receiverUser?: User;
}) {
  const navigation = useNavigation<NavigationProp>();

  const handleViewProfile = () => {
    if (receiverUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("UserProfile", { userId: receiverUser.id });
    }
  };

  return (
    <Pressable
      onPress={handleViewProfile}
      className="bg-white rounded-xl p-4 flex-row items-center active:opacity-80"
    >
      <View className="w-20 h-20 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
        {receiverUser?.profilePhoto ? (
          <Image
            source={{ uri: receiverUser.profilePhoto }}
            style={{ width: 80, height: 80 }}
            contentFit="cover"
          />
        ) : (
          <Ionicons name="person" size={40} color="#8B2252" />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-wishy-black font-bold text-base">
          {receiverUser?.name || "Unknown User"}
        </Text>
        <Text className="text-wishy-gray text-sm mt-1">Awaiting their reply</Text>
      </View>
      <View className="bg-orange-100 px-3 py-1.5 rounded-full">
        <Text className="text-orange-700 font-semibold text-xs">Pending</Text>
      </View>
    </Pressable>
  );
}

// ── RelationshipUpgradeCard (received) ──────────────────────────────────────

function RelationshipUpgradeCard({
  request,
  senderUser,
}: {
  request: RelationshipUpgradeRequest;
  senderUser?: User;
}) {
  const navigation = useNavigation<NavigationProp>();
  const acceptRelationshipUpgradeRequest = useConnectionStore((s) => s.acceptRelationshipUpgradeRequest);
  const rejectRelationshipUpgradeRequest = useConnectionStore((s) => s.rejectRelationshipUpgradeRequest);
  const showToast = useToastStore((s) => s.showToast);

  const handleAccept = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await acceptRelationshipUpgradeRequest(request.id);
    showToast("Relationship request accepted!");
  };

  const handleDecline = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await rejectRelationshipUpgradeRequest(request.id);
    showToast("Relationship request declined", "info");
  };

  const handleViewProfile = () => {
    if (senderUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("UserProfile", { userId: senderUser.id });
    }
  };

  return (
    <View className="bg-white rounded-xl p-4 flex-row items-center border border-wishy-paleBlush">
      <Pressable onPress={handleViewProfile} className="flex-row items-center flex-1 active:opacity-80">
        <View className="w-14 h-14 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
          {senderUser?.profilePhoto ? (
            <Image
              source={{ uri: senderUser.profilePhoto }}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
            />
          ) : (
            <Ionicons name="person" size={28} color="#8B2252" />
          )}
        </View>
        <View className="flex-1 ml-3">
          <Text className="text-wishy-black font-bold text-base">
            {senderUser?.name || "Unknown User"}
          </Text>
          <View className="flex-row items-center mt-1">
            <Ionicons name="heart" size={12} color="#8B2252" />
            <Text className="text-wishy-pink text-xs ml-1">wants to be in a relationship</Text>
          </View>
        </View>
      </Pressable>
      <View className="flex-row gap-2 ml-2">
        <Pressable
          onPress={handleDecline}
          className="w-10 h-10 bg-wishy-white rounded-full items-center justify-center border border-wishy-paleBlush"
        >
          <Ionicons name="close" size={20} color="#8B2252" />
        </Pressable>
        <Pressable
          onPress={handleAccept}
          className="w-10 h-10 bg-wishy-pink rounded-full items-center justify-center"
        >
          <Ionicons name="heart" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

// ── SentRelationshipUpgradeCard ──────────────────────────────────────────────

function SentRelationshipUpgradeCard({
  request,
  receiverUser,
}: {
  request: RelationshipUpgradeRequest;
  receiverUser?: User;
}) {
  const navigation = useNavigation<NavigationProp>();

  const handleViewProfile = () => {
    if (receiverUser) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate("UserProfile", { userId: receiverUser.id });
    }
  };

  return (
    <Pressable
      onPress={handleViewProfile}
      className="bg-white rounded-xl p-4 flex-row items-center active:opacity-80 border border-wishy-paleBlush"
    >
      <View className="w-14 h-14 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
        {receiverUser?.profilePhoto ? (
          <Image
            source={{ uri: receiverUser.profilePhoto }}
            style={{ width: 56, height: 56 }}
            contentFit="cover"
          />
        ) : (
          <Ionicons name="person" size={28} color="#8B2252" />
        )}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-wishy-black font-bold text-base">
          {receiverUser?.name || "Unknown User"}
        </Text>
        <View className="flex-row items-center mt-1">
          <Ionicons name="heart-outline" size={12} color="#8B2252" />
          <Text className="text-wishy-gray text-xs ml-1">Relationship request sent</Text>
        </View>
      </View>
      <View className="bg-orange-100 px-3 py-1.5 rounded-full">
        <Text className="text-orange-700 font-semibold text-xs">Pending</Text>
      </View>
    </Pressable>
  );
}

// ── UserSearchCard ──────────────────────────────────────────────────────────

function UserSearchCard({
  user,
  onConnect,
  userList,
  userIndex,
}: {
  user: User;
  onConnect: (userId: string) => void;
  userList: string[];
  userIndex: number;
}) {
  const navigation = useNavigation<NavigationProp>();
  const connections = useConnectionStore((s) => s.connections);
  const contactRequests = useConnectionStore((s) => s.contactRequests);
  const currentUser = useUserStore((s) => s.currentUser);

  const existingConnection = connections.find(
    (conn) =>
      ((conn.senderId === currentUser?.id && conn.receiverId === user.id) ||
        (conn.receiverId === currentUser?.id && conn.senderId === user.id)) &&
      conn.status === "accepted"
  );

  const pendingRequest = contactRequests.find(
    (req) =>
      ((req.senderId === currentUser?.id && req.receiverId === user.id) ||
        (req.receiverId === currentUser?.id && req.senderId === user.id)) &&
      req.status === "pending"
  );

  const acceptedRequest = contactRequests.find(
    (req) =>
      ((req.senderId === currentUser?.id && req.receiverId === user.id) ||
        (req.receiverId === currentUser?.id && req.senderId === user.id)) &&
      req.status === "accepted"
  );

  const isConnected = !!existingConnection || !!acceptedRequest;
  const isPending = !!pendingRequest;

  const handleViewProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("UserProfile", { userId: user.id, userList, userIndex });
  };

  return (
    <Pressable
      onPress={handleViewProfile}
      className="bg-white rounded-xl p-4 flex-row items-center active:opacity-80"
    >
      <View className="w-20 h-20 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-2 border-wishy-pink">
        {user.profilePhoto ? (
          <Image
            source={{ uri: user.profilePhoto }}
            style={{ width: 80, height: 80 }}
            contentFit="cover"
          />
        ) : (
          <Ionicons name="person" size={40} color="#8B2252" />
        )}
      </View>
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
      {isConnected ? (
        <View className="bg-green-100 px-3 py-1.5 rounded-full">
          <Text className="text-green-700 font-semibold text-xs">Connected</Text>
        </View>
      ) : isPending ? (
        <View className="bg-orange-100 px-3 py-1.5 rounded-full">
          <Text className="text-orange-700 font-semibold text-xs">Pending</Text>
        </View>
      ) : (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onConnect(user.id);
          }}
          className="bg-wishy-pink px-3 py-1.5 rounded-full active:opacity-80"
        >
          <Text className="text-wishy-black font-semibold text-xs">Connect</Text>
        </Pressable>
      )}
    </Pressable>
  );
}
