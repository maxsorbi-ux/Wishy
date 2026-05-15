import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useWishStore from "../state/wishStore";
import useUserStore from "../state/userStore";
import useConnectionStore from "../state/connectionStore";
import { useToastStore } from "../state/toastStore";
import { ChatMessage } from "../types/wishy";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Chat">;
type ChatRouteProp = RouteProp<RootStackParamList, "Chat">;

const REPORT_REASONS = [
  "Spam",
  "Harassment or Bullying",
  "Hate Speech",
  "Sexually Explicit Content",
  "Inappropriate Behavior",
  "Other",
];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatRouteProp>();
  const { wishId, chatId } = route.params;

  const flatListRef = useRef<FlatList>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Report state
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<"message" | "user">("user");
  const [reportedMessageId, setReportedMessageId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  // Block state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const getWishById = useWishStore((s) => s.getWishById);
  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const getChatByWishId = useConnectionStore((s) => s.getChatByWishId);
  const addMessage = useConnectionStore((s) => s.addMessage);
  const createChat = useConnectionStore((s) => s.createChat);
  const syncChats = useConnectionStore((s) => s.syncChats);
  const subscribeToMessages = useConnectionStore((s) => s.subscribeToMessages);
  const unsubscribeFromMessages = useConnectionStore((s) => s.unsubscribeFromMessages);
  const blockUser = useConnectionStore((s) => s.blockUser);
  const showToast = useToastStore((s) => s.showToast);

  const wish = getWishById(wishId);
  const chat = getChatByWishId(wishId);

  const otherUserId = chat?.participants.find((p) => p !== currentUser?.id);
  const otherUser = otherUserId ? allUsers.find((u) => u.id === otherUserId) : undefined;

  // Create chat if it doesn't exist
  useEffect(() => {
    if (!chat && currentUser && wish) {
      const participants: string[] = [];
      participants.push(currentUser.id);

      if (wish.creatorId !== currentUser.id) {
        participants.push(wish.creatorId);
      }

      if (wish.targetUserIds && wish.targetUserIds.length > 0) {
        wish.targetUserIds.forEach((targetId) => {
          if (targetId !== currentUser.id && !participants.includes(targetId)) {
            participants.push(targetId);
          }
        });
      }

      if (wish.targetUserId && wish.targetUserId !== currentUser.id && !participants.includes(wish.targetUserId)) {
        participants.push(wish.targetUserId);
      }

      if (participants.length >= 2) {
        createChat(wishId, participants);
      }
    }
  }, [chat, currentUser, wish, wishId, createChat]);

  // Set navigation title and header right button
  useEffect(() => {
    if (wish) {
      navigation.setOptions({
        headerTitle: wish.title,
        headerRight: () => (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowUserMenu(true);
            }}
            style={{ marginRight: 8, padding: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="#000000" />
          </Pressable>
        ),
      });
    }
  }, [wish, navigation]);

  useEffect(() => {
    syncChats();
  }, [syncChats]);

  useEffect(() => {
    if (chat?.id) {
      subscribeToMessages(chat.id);
      return () => {
        unsubscribeFromMessages();
      };
    }
  }, [chat?.id, subscribeToMessages, unsubscribeFromMessages]);

  useFocusEffect(
    useCallback(() => {
      pollIntervalRef.current = setInterval(() => {
        if (chat?.id) {
          syncChats();
        }
      }, 2000);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }, [chat?.id, syncChats])
  );

  useEffect(() => {
    if (chat?.messages?.length) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chat?.messages?.length]);

  const handleSend = async () => {
    if (!message.trim() || !currentUser || !chat || isSending) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSending(true);

    const messageText = message.trim();
    setMessage("");

    try {
      await addMessage(chat.id, currentUser.id, messageText);
    } catch (error) {
      setMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handleReportMessage = (messageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReportTarget("message");
    setReportedMessageId(messageId);
    setSelectedReason(null);
    setReportSubmitted(false);
    setShowReportModal(true);
  };

  const handleReportUser = () => {
    setShowUserMenu(false);
    setReportTarget("user");
    setReportedMessageId(null);
    setSelectedReason(null);
    setReportSubmitted(false);
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!selectedReason) return;
    setIsSubmittingReport(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Brief delay to simulate submission
    await new Promise((resolve) => setTimeout(resolve, 800));

    setIsSubmittingReport(false);
    setReportSubmitted(true);
  };

  const handleCloseReport = () => {
    setShowReportModal(false);
    setReportSubmitted(false);
    setSelectedReason(null);
  };

  const handleBlockUser = () => {
    setShowUserMenu(false);
    setShowBlockModal(true);
  };

  const confirmBlockUser = async () => {
    if (!currentUser || !otherUserId) return;
    setIsBlocking(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      await blockUser(currentUser.id, otherUserId);
      setShowBlockModal(false);
      showToast(`${otherUser?.name ?? "User"} has been blocked`);
      navigation.goBack();
    } catch {
      setIsBlocking(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.senderId === currentUser?.id;

    return (
      <Pressable
        onLongPress={() => {
          if (!isOwnMessage) {
            handleReportMessage(item.id);
          }
        }}
        delayLongPress={400}
        className={cn("max-w-[80%] mb-3", isOwnMessage ? "self-end" : "self-start")}
      >
        <View
          className={cn(
            "px-4 py-3 rounded-2xl",
            isOwnMessage ? "bg-wishy-black rounded-br-sm" : "bg-white rounded-bl-sm"
          )}
        >
          <Text className={cn("text-base", isOwnMessage ? "text-wishy-white" : "text-wishy-black")}>
            {item.text}
          </Text>
        </View>
        <Text
          className={cn("text-xs mt-1 text-wishy-gray", isOwnMessage ? "text-right" : "text-left")}
        >
          {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </Pressable>
    );
  };

  if (!wish) {
    return (
      <View className="flex-1 bg-wishy-white items-center justify-center">
        <Text className="text-wishy-gray">Wish not found</Text>
      </View>
    );
  }

  return (
    <>
      <KeyboardAvoidingView
        className="flex-1 bg-wishy-white"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={90}
      >
        {/* Wish Header */}
        <View className="bg-white border-b border-wishy-paleBlush px-4 py-3 flex-row items-center">
          {wish.image && (
            <Image
              source={{ uri: wish.image }}
              style={{ width: 48, height: 48, borderRadius: 8 }}
              contentFit="cover"
            />
          )}
          <View className="flex-1 ml-3">
            <Text className="text-wishy-black font-semibold" numberOfLines={1}>
              {wish.title}
            </Text>
            <Text className="text-wishy-gray text-sm" numberOfLines={1}>
              {wish.description}
            </Text>
          </View>
        </View>

        {/* Long-press hint for other user messages */}
        {chat?.messages && chat.messages.some((m) => m.senderId !== currentUser?.id) && (
          <View className="bg-wishy-paleBlush/50 px-4 py-1.5 items-center">
            <Text className="text-wishy-gray text-xs">Hold a message to report it</Text>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={chat?.messages || []}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: 16,
            flexGrow: 1,
            justifyContent: chat?.messages?.length ? "flex-end" : "center",
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center py-8">
              <View className="w-16 h-16 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
                <Ionicons name="chatbubbles-outline" size={32} color="#8B2252" />
              </View>
              <Text className="text-wishy-black font-semibold text-base">Start the conversation</Text>
              <Text className="text-wishy-gray text-center mt-2 px-8">
                Send a message to discuss this wish
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View
          className="bg-white border-t border-wishy-paleBlush px-4 py-3 flex-row items-end"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor="#9A8A8A"
            multiline
            editable={!isSending}
            className="flex-1 bg-wishy-white rounded-2xl px-4 py-3 text-wishy-black text-base max-h-32"
          />
          <Pressable
            onPress={handleSend}
            disabled={!message.trim() || isSending}
            className={cn(
              "w-11 h-11 rounded-full items-center justify-center ml-2",
              isSending ? "bg-wishy-black" : message.trim() ? "bg-wishy-black" : "bg-wishy-gray/30"
            )}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFF8F0" />
            ) : (
              <Ionicons name="send" size={18} color={message.trim() ? "#FFF8F0" : "#9A8A8A"} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* User Options Menu */}
      <Modal
        transparent
        visible={showUserMenu}
        animationType="fade"
        onRequestClose={() => setShowUserMenu(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setShowUserMenu(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              className="bg-white rounded-t-3xl px-6 pt-6"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="w-10 h-1 bg-wishy-paleBlush rounded-full self-center mb-6" />

              {otherUser && (
                <Text className="text-wishy-black font-bold text-lg mb-4 text-center">
                  {otherUser.name}
                </Text>
              )}

              <Pressable
                onPress={handleReportUser}
                className="flex-row items-center py-4 border-b border-wishy-paleBlush active:opacity-60"
              >
                <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="flag-outline" size={20} color="#EA580C" />
                </View>
                <View>
                  <Text className="text-wishy-black font-semibold text-base">Report User</Text>
                  <Text className="text-wishy-gray text-sm">Flag this user for review</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={handleBlockUser}
                className="flex-row items-center py-4 active:opacity-60"
              >
                <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-4">
                  <Ionicons name="ban-outline" size={20} color="#DC2626" />
                </View>
                <View>
                  <Text className="text-red-600 font-semibold text-base">Block User</Text>
                  <Text className="text-wishy-gray text-sm">Prevent this user from contacting you</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => setShowUserMenu(false)}
                className="mt-2 py-4 items-center active:opacity-70"
              >
                <Text className="text-wishy-gray font-medium">Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report Modal */}
      <Modal
        transparent
        visible={showReportModal}
        animationType="slide"
        onRequestClose={handleCloseReport}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={handleCloseReport}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              className="bg-white rounded-t-3xl px-6 pt-6"
              style={{ paddingBottom: insets.bottom + 16 }}
            >
              <View className="w-10 h-1 bg-wishy-paleBlush rounded-full self-center mb-6" />

              {reportSubmitted ? (
                <View className="items-center py-4">
                  <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-4">
                    <Ionicons name="checkmark-circle" size={36} color="#16A34A" />
                  </View>
                  <Text className="text-wishy-black font-bold text-xl mb-2">Report Submitted</Text>
                  <Text className="text-wishy-gray text-center text-sm leading-5 mb-6">
                    {"Thank you for keeping Wishy safe. Our team will review this report within 24 hours and take appropriate action."}
                  </Text>
                  <Pressable
                    onPress={handleCloseReport}
                    className="bg-wishy-black rounded-2xl py-4 w-full items-center active:opacity-80"
                  >
                    <Text className="text-white font-bold text-base">Done</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View className="flex-row items-center mb-2">
                    <View className="w-10 h-10 bg-orange-100 rounded-full items-center justify-center mr-3">
                      <Ionicons name="flag" size={20} color="#EA580C" />
                    </View>
                    <View>
                      <Text className="text-wishy-black font-bold text-lg">
                        {reportTarget === "message" ? "Report Message" : "Report User"}
                      </Text>
                      <Text className="text-wishy-gray text-sm">Select a reason</Text>
                    </View>
                  </View>

                  <View className="mt-4 mb-5">
                    {REPORT_REASONS.map((reason) => (
                      <Pressable
                        key={reason}
                        onPress={() => setSelectedReason(reason)}
                        className={cn(
                          "flex-row items-center py-3 px-4 rounded-xl mb-2 border",
                          selectedReason === reason
                            ? "border-wishy-pink bg-wishy-paleBlush"
                            : "border-wishy-paleBlush bg-white"
                        )}
                      >
                        <View
                          className={cn(
                            "w-5 h-5 rounded-full border-2 items-center justify-center mr-3",
                            selectedReason === reason ? "border-wishy-pink bg-wishy-pink" : "border-wishy-gray"
                          )}
                        >
                          {selectedReason === reason && (
                            <View className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </View>
                        <Text
                          className={cn(
                            "text-sm font-medium",
                            selectedReason === reason ? "text-wishy-black" : "text-wishy-gray"
                          )}
                        >
                          {reason}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable
                    onPress={handleSubmitReport}
                    disabled={!selectedReason || isSubmittingReport}
                    className={cn(
                      "rounded-2xl py-4 items-center mb-3",
                      selectedReason && !isSubmittingReport ? "bg-wishy-black active:opacity-80" : "bg-wishy-gray/30"
                    )}
                  >
                    {isSubmittingReport ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text
                        className={cn(
                          "font-bold text-base",
                          selectedReason ? "text-white" : "text-wishy-gray"
                        )}
                      >
                        Submit Report
                      </Text>
                    )}
                  </Pressable>

                  <Pressable onPress={handleCloseReport} className="py-3 items-center active:opacity-70">
                    <Text className="text-wishy-gray font-medium">Cancel</Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Block Confirmation Modal */}
      <Modal
        transparent
        visible={showBlockModal}
        animationType="fade"
        onRequestClose={() => setShowBlockModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 items-center justify-center px-6"
          onPress={() => setShowBlockModal(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View className="bg-white rounded-3xl p-6 w-full max-w-sm">
              <View className="items-center mb-4">
                <View className="w-14 h-14 bg-red-100 rounded-full items-center justify-center mb-3">
                  <Ionicons name="ban-outline" size={28} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2">Block User</Text>
                <Text className="text-wishy-gray text-center text-sm">
                  {"This will prevent " + (otherUser?.name ?? "this user") + " from contacting you or seeing your content. You can unblock them from your profile settings."}
                </Text>
              </View>
              <Pressable
                onPress={confirmBlockUser}
                disabled={isBlocking}
                className="bg-red-500 rounded-xl py-3 items-center mb-3 active:opacity-80"
              >
                {isBlocking ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-bold">Block</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setShowBlockModal(false)}
                className="py-3 items-center active:opacity-70"
              >
                <Text className="text-wishy-gray font-medium">Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
