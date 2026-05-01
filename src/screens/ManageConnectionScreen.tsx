import React, { useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useConnectionStore from "../state/connectionStore";
import useUserStore from "../state/userStore";
import { useToastStore } from "../state/toastStore";
import Animated, { FadeInDown } from "react-native-reanimated";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteParams = RouteProp<RootStackParamList, "ManageConnection">;

export default function ManageConnectionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteParams>();
  const insets = useSafeAreaInsets();

  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const getConnectionBetweenUsers = useConnectionStore((s) => s.getConnectionBetweenUsers);
  const sendRelationshipUpgradeRequest = useConnectionStore((s) => s.sendRelationshipUpgradeRequest);
  const acceptRelationshipUpgradeRequest = useConnectionStore((s) => s.acceptRelationshipUpgradeRequest);
  const rejectRelationshipUpgradeRequest = useConnectionStore((s) => s.rejectRelationshipUpgradeRequest);
  const getPendingUpgradeRequestForConnection = useConnectionStore((s) => s.getPendingUpgradeRequestForConnection);
  const getPendingUpgradeRequestBetweenUsers = useConnectionStore((s) => s.getPendingUpgradeRequestBetweenUsers);
  const updateConnectionType = useConnectionStore((s) => s.updateConnectionType);
  const deleteConnection = useConnectionStore((s) => s.deleteConnection);
  const blockUser = useConnectionStore((s) => s.blockUser);
  const syncConnections = useConnectionStore((s) => s.syncConnections);
  const showToast = useToastStore((s) => s.showToast);

  const { userId } = route.params;
  const otherUser = allUsers.find((u) => u.id === userId);
  const connection = currentUser ? getConnectionBetweenUsers(currentUser.id, userId) : undefined;

  // Try both methods to find pending upgrade request
  const pendingUpgradeRequestByConnection = connection ? getPendingUpgradeRequestForConnection(connection.id) : undefined;
  const pendingUpgradeRequestBetweenUsers = currentUser ? getPendingUpgradeRequestBetweenUsers(currentUser.id, userId) : undefined;
  const pendingUpgradeRequest = pendingUpgradeRequestByConnection || pendingUpgradeRequestBetweenUsers;


  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Sync connections when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      syncConnections();
    }, [syncConnections])
  );

  if (!currentUser || !otherUser || !connection) {
    return (
      <View className="flex-1 bg-wishy-white items-center justify-center">
        <Text className="text-wishy-gray">Connection not found</Text>
      </View>
    );
  }

  const handleUpgradeToRelationship = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Send upgrade request instead of directly upgrading
    updateConnectionType(connection.id, "relationship");
    // sendRelationshipUpgradeRequest(connection.id, currentUser.id, otherUser.id);
    setShowUpgradeModal(false);
    showToast("Relationship request sent!");
    navigation.goBack();
  };

  const handleDowngradeToFriend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateConnectionType(connection.id, "friend");
    showToast("Connection changed to Friend");
  };

  const handleAcceptUpgradeRequest = () => {
    if (pendingUpgradeRequest) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      acceptRelationshipUpgradeRequest(pendingUpgradeRequest.id);
      showToast("Relationship request accepted!");
    }
  };

  const handleRejectUpgradeRequest = () => {
    if (pendingUpgradeRequest) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      rejectRelationshipUpgradeRequest(pendingUpgradeRequest.id);
      showToast("Relationship request declined", "info");
    }
  };

  const handleRemoveConnection = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowRemoveModal(true);
  };

  const confirmRemoveConnection = async () => {
    setIsRemoving(true);
    try {
      await deleteConnection(connection.id);
      showToast(`${otherUser.name} removed from connections`);
    } finally {
      setIsRemoving(false);
      setShowRemoveModal(false);
      navigation.goBack();
    }
  };

  const handleBlockUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowBlockModal(true);
  };

  const confirmBlockUser = async () => {
    await blockUser(currentUser.id, otherUser.id);
    setShowBlockModal(false);
    showToast(`${otherUser.name} has been blocked`);
    navigation.goBack();
  };

  return (
    <View className="flex-1 bg-wishy-white">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top + 16 }}
        className="px-4 pb-4 bg-white border-b border-wishy-paleBlush"
      >
        <View className="flex-row items-center">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center"
          >
            <Ionicons name="chevron-back" size={28} color="#8B2252" />
          </Pressable>
          <Text className="flex-1 text-center text-wishy-black font-bold text-xl mr-10">
            Manage Connection
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* User Info Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View className="bg-white rounded-2xl p-6 items-center mb-6 border border-wishy-paleBlush">
            <View className="w-24 h-24 rounded-full bg-wishy-paleBlush items-center justify-center overflow-hidden border-4 border-wishy-pink mb-4">
              {otherUser.profilePhoto ? (
                <Image
                  source={{ uri: otherUser.profilePhoto }}
                  style={{ width: 96, height: 96 }}
                  contentFit="cover"
                />
              ) : (
                <Ionicons name="person" size={48} color="#8B2252" />
              )}
            </View>
            <Text className="text-wishy-black font-bold text-2xl mb-1">
              {otherUser.name}
            </Text>
            {otherUser.bio && (
              <Text className="text-wishy-gray text-center text-sm mb-3">
                {otherUser.bio}
              </Text>
            )}
            <View className="bg-wishy-paleBlush px-4 py-2 rounded-full">
              <Text className="text-wishy-black font-semibold capitalize">
                {connection.type === "relationship" ? "In a Relationship" : "Social Connection"}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Connection Type Management */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text className="text-wishy-black font-bold text-lg mb-3">
            Connection Type
          </Text>

          {connection.type === "friend" ? (
            <View className="bg-white rounded-2xl p-4 mb-4 border border-wishy-paleBlush">
              <View className="flex-row items-center mb-3">
                <Ionicons name="people" size={24} color="#8B2252" />
                <Text className="text-wishy-black font-semibold text-base ml-3 flex-1">
                  Friend
                </Text>
              </View>
              {pendingUpgradeRequest ? (
                <>
                  <Text className="text-wishy-gray text-sm mb-4">
                    {pendingUpgradeRequest.senderId === currentUser.id
                      ? `You sent a relationship request to ${otherUser.name}. Waiting for approval.`
                      : `${otherUser.name} wants to upgrade your connection to a relationship.`}
                  </Text>
                  {pendingUpgradeRequest.senderId === currentUser.id ? (
                    // You sent the request - show pending status
                    <View className="bg-orange-100 px-4 py-2 rounded-xl">
                      <Text className="text-orange-700 font-semibold text-center">
                        Request Pending
                      </Text>
                    </View>
                  ) : (
                    // You received the request - show accept/reject buttons
                    <View className="space-y-3">
                      <Pressable
                        onPress={handleAcceptUpgradeRequest}
                        className="bg-wishy-pink rounded-xl py-3 items-center active:opacity-80"
                      >
                        <Text className="text-white font-bold">
                          Accept Relationship
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={handleRejectUpgradeRequest}
                        className="bg-wishy-white border border-wishy-paleBlush rounded-xl py-3 items-center active:opacity-80"
                      >
                        <Text className="text-wishy-black font-semibold">
                          Decline
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text className="text-wishy-gray text-sm mb-4">
                    You and {otherUser.name} are connected as friends. Upgrade to &quot;In a Relationship&quot; to share a special bond.
                  </Text>
                  <Pressable
                    onPress={() => setShowUpgradeModal(true)}
                    className="bg-wishy-pink rounded-xl py-3 items-center active:opacity-80"
                  >
                    <Text className="text-white font-bold">
                      Propose Relationship Status
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : (
            <View className="bg-white rounded-2xl p-4 mb-4 border border-wishy-pink">
              <View className="flex-row items-center mb-3">
                <Ionicons name="heart" size={24} color="#8B2252" />
                <Text className="text-wishy-black font-semibold text-base ml-3 flex-1">
                  In a Relationship
                </Text>
              </View>
              <Text className="text-wishy-gray text-sm mb-4">
                You and {otherUser.name} are in a relationship. This status is visible on both profiles.
              </Text>
              <Pressable
                onPress={handleDowngradeToFriend}
                className="bg-wishy-white border border-wishy-paleBlush rounded-xl py-3 items-center active:opacity-80"
              >
                <Text className="text-wishy-black font-semibold">
                  Change to Friend
                </Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text className="text-wishy-black font-bold text-lg mb-3">
            Manage Connection
          </Text>

          <View className="bg-white rounded-2xl p-4 border border-red-200">
            <Pressable
              onPress={handleRemoveConnection}
              className="py-3 border-b border-wishy-paleBlush active:opacity-60"
            >
              <View className="flex-row items-center">
                <Ionicons name="remove-circle-outline" size={24} color="#DC2626" />
                <Text className="text-red-600 font-semibold ml-3">
                  Remove Connection
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={handleBlockUser}
              className="py-3 active:opacity-60"
            >
              <View className="flex-row items-center">
                <Ionicons name="ban-outline" size={24} color="#DC2626" />
                <Text className="text-red-600 font-semibold ml-3">
                  Block User
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Remove Connection Modal */}
      <Modal transparent visible={showRemoveModal} animationType="fade" onRequestClose={() => setShowRemoveModal(false)}>
        <Pressable className="flex-1 bg-black/50 items-center justify-center px-6" onPress={() => setShowRemoveModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
              <View className="items-center mb-4">
                <View className="w-14 h-14 bg-red-100 rounded-full items-center justify-center mb-3">
                  <Ionicons name="remove-circle-outline" size={28} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2">Remove Connection</Text>
                <Text className="text-wishy-gray text-center text-sm">
                  {"Are you sure you want to remove " + otherUser.name + " from your connections?"}
                </Text>
              </View>
              <Pressable
                onPress={confirmRemoveConnection}
                disabled={isRemoving}
                className="bg-red-500 rounded-xl py-3 items-center mb-3 active:opacity-80"
              >
                <Text className="text-white font-bold">{isRemoving ? "Removing..." : "Remove"}</Text>
              </Pressable>
              <Pressable onPress={() => setShowRemoveModal(false)} className="py-3 items-center active:opacity-70">
                <Text className="text-wishy-gray font-medium">Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Block User Modal */}
      <Modal transparent visible={showBlockModal} animationType="fade" onRequestClose={() => setShowBlockModal(false)}>
        <Pressable className="flex-1 bg-black/50 items-center justify-center px-6" onPress={() => setShowBlockModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
              <View className="items-center mb-4">
                <View className="w-14 h-14 bg-red-100 rounded-full items-center justify-center mb-3">
                  <Ionicons name="ban-outline" size={28} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2">Block User</Text>
                <Text className="text-wishy-gray text-center text-sm">
                  {"This will remove " + otherUser.name + " and prevent them from contacting you."}
                </Text>
              </View>
              <Pressable
                onPress={confirmBlockUser}
                className="bg-red-500 rounded-xl py-3 items-center mb-3 active:opacity-80"
              >
                <Text className="text-white font-bold">Block</Text>
              </Pressable>
              <Pressable onPress={() => setShowBlockModal(false)} className="py-3 items-center active:opacity-70">
                <Text className="text-wishy-gray font-medium">Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center">
          <Animated.View
            entering={FadeInDown.duration(300)}
            className="bg-white rounded-3xl p-6 mx-8 max-w-sm"
          >
            <View className="items-center mb-4">
              <View className="w-16 h-16 bg-wishy-paleBlush rounded-full items-center justify-center mb-3">
                <Ionicons name="heart" size={32} color="#8B2252" />
              </View>
              <Text className="text-wishy-black font-bold text-xl mb-2">
                Propose Relationship?
              </Text>
              <Text className="text-wishy-gray text-center text-sm">
                This will change your connection with {otherUser.name} to &quot;In a Relationship&quot; and will be visible on both profiles.
              </Text>
            </View>

            <View className="space-y-3">
              <Pressable
                onPress={handleUpgradeToRelationship}
                className="bg-wishy-pink rounded-xl py-4 items-center active:opacity-80"
              >
                <Text className="text-white font-bold text-base">
                  Yes, Propose Relationship
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setShowUpgradeModal(false)}
                className="bg-wishy-white border border-wishy-paleBlush rounded-xl py-4 items-center active:opacity-80"
              >
                <Text className="text-wishy-black font-semibold text-base">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
