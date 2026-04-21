import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, Pressable, TextInput, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
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

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ChatRouteProp>();
  const { wishId, chatId } = route.params;

  const flatListRef = useRef<FlatList>(null);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getWishById = useWishStore((s) => s.getWishById);
  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const getChatByWishId = useConnectionStore((s) => s.getChatByWishId);
  const addMessage = useConnectionStore((s) => s.addMessage);
  const createChat = useConnectionStore((s) => s.createChat);
  const syncChats = useConnectionStore((s) => s.syncChats);
  const subscribeToMessages = useConnectionStore((s) => s.subscribeToMessages);
  const unsubscribeFromMessages = useConnectionStore((s) => s.unsubscribeFromMessages);
  const showToast = useToastStore((s) => s.showToast);

  const wish = getWishById(wishId);
  const chat = getChatByWishId(wishId);

  // Create chat if it doesn't exist
  useEffect(() => {
    if (!chat && currentUser && wish) {
      // Include both the creator and target user as participants
      const participants: string[] = [];

      // Always include current user
      participants.push(currentUser.id);

      // Add the creator if different from current user
      if (wish.creatorId !== currentUser.id) {
        participants.push(wish.creatorId);
      }

      // Add target users from targetUserIds array (new format)
      if (wish.targetUserIds && wish.targetUserIds.length > 0) {
        wish.targetUserIds.forEach((targetId) => {
          if (targetId !== currentUser.id && !participants.includes(targetId)) {
            participants.push(targetId);
          }
        });
      }

      // Add the target user if it exists (old format - backward compatibility)
      if (wish.targetUserId && wish.targetUserId !== currentUser.id && !participants.includes(wish.targetUserId)) {
        participants.push(wish.targetUserId);
      }

      // Only create chat if we have at least 2 participants
      if (participants.length >= 2) {
        createChat(wishId, participants);
      }
    }
  }, [chat, currentUser, wish, wishId, createChat]);

  // Set navigation title
  useEffect(() => {
    if (wish) {
      navigation.setOptions({
        headerTitle: wish.title,
      });
    }
  }, [wish, navigation]);

  // Sync chats from Supabase when entering the screen
  useEffect(() => {
    console.log("ChatScreen: Syncing chats from Supabase...");
    syncChats();
  }, [syncChats]);

  // Subscribe to real-time messages when chat exists
  useEffect(() => {
    if (chat?.id) {
      console.log("ChatScreen: Subscribing to real-time messages for chat:", chat.id);
      subscribeToMessages(chat.id);

      return () => {
        console.log("ChatScreen: Unsubscribing from messages");
        unsubscribeFromMessages();
      };
    }
  }, [chat?.id, subscribeToMessages, unsubscribeFromMessages]);

  // Additional fast polling while screen is focused for more responsive updates
  useFocusEffect(
    useCallback(() => {
      console.log("ChatScreen: Setting up fast polling...");

      // Poll every 2 seconds while screen is active
      pollIntervalRef.current = setInterval(() => {
        if (chat?.id) {
          syncChats();
        }
      }, 2000);

      return () => {
        console.log("ChatScreen: Clearing fast polling");
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }, [chat?.id, syncChats])
  );

  // Scroll to bottom when new messages arrive
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
    setMessage(""); // Clear immediately for better UX

    try {
      // addMessage already handles both in-app and push notifications to other participants
      await addMessage(chat.id, currentUser.id, messageText);
    } catch (error) {
      console.log("Error sending message:", error);
      setMessage(messageText); // Restore message on error
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isOwnMessage = item.senderId === currentUser?.id;

    return (
      <View
        className={cn(
          "max-w-[80%] mb-3",
          isOwnMessage ? "self-end" : "self-start"
        )}
      >
        <View
          className={cn(
            "px-4 py-3 rounded-2xl",
            isOwnMessage
              ? "bg-wishy-black rounded-br-sm"
              : "bg-white rounded-bl-sm"
          )}
        >
          <Text
            className={cn(
              "text-base",
              isOwnMessage ? "text-wishy-white" : "text-wishy-black"
            )}
          >
            {item.text}
          </Text>
        </View>
        <Text
          className={cn(
            "text-xs mt-1 text-wishy-gray",
            isOwnMessage ? "text-right" : "text-left"
          )}
        >
          {new Date(item.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
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
            <Text className="text-wishy-black font-semibold text-base">
              Start the conversation
            </Text>
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
            <Ionicons
              name="send"
              size={18}
              color={message.trim() ? "#FFF8F0" : "#9A8A8A"}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
