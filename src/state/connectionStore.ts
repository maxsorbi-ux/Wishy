import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Connection, ConnectionStatus, ConnectionType, Chat, ChatMessage, SharedWish, ContactRequest, BlockedUser, RelationshipUpgradeRequest } from "../types/wishy";
import { v4 as uuidv4 } from "uuid";
import useNotificationStore from "./notificationStore";
import { supabaseDb, supabaseRealtime, setSession } from "../api/supabase";
import useUserStore from "./userStore";
import {
  sendConnectionRequestNotification,
  sendConnectionAcceptedNotification,
  sendMessageNotification,
} from "../api/pushNotifications";

interface ConnectionState {
  connections: Connection[];
  contactRequests: ContactRequest[];
  relationshipUpgradeRequests: RelationshipUpgradeRequest[];
  blockedUsers: BlockedUser[];
  chats: Chat[];
  sharedWishes: SharedWish[];
  isSyncing: boolean;
  messageSubscription: { unsubscribe: () => void } | null;

  // Contact Request actions
  sendContactRequest: (senderId: string, receiverId: string, message?: string) => Promise<string>;
  acceptContactRequest: (requestId: string, connectionType?: ConnectionType) => Promise<void>;
  rejectContactRequest: (requestId: string) => Promise<void>;
  getPendingRequestsReceived: (userId: string) => ContactRequest[];
  getPendingRequestsSent: (userId: string) => ContactRequest[];

  // Relationship Upgrade Request actions
  sendRelationshipUpgradeRequest: (connectionId: string, senderId: string, receiverId: string) => Promise<string>;
  acceptRelationshipUpgradeRequest: (requestId: string) => Promise<void>;
  rejectRelationshipUpgradeRequest: (requestId: string) => Promise<void>;
  getPendingUpgradeRequestsReceived: (userId: string) => RelationshipUpgradeRequest[];
  getPendingUpgradeRequestForConnection: (connectionId: string) => RelationshipUpgradeRequest | undefined;
  getPendingUpgradeRequestBetweenUsers: (userId1: string, userId2: string) => RelationshipUpgradeRequest | undefined;

  // Connection actions
  createConnection: (senderId: string, receiverId: string, type: ConnectionType) => Promise<string>;
  updateConnectionType: (connectionId: string, newType: ConnectionType) => Promise<void>;
  updateConnectionStatus: (id: string, status: ConnectionStatus) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  getConnectionsForUser: (userId: string) => Connection[];
  getAcceptedConnections: (userId: string) => Connection[];
  getRelationshipConnections: (userId: string) => Connection[];
  getConnectionBetweenUsers: (userId1: string, userId2: string) => Connection | undefined;

  // Blocking actions
  blockUser: (blockerId: string, blockedUserId: string) => Promise<void>;
  unblockUser: (blockerId: string, blockedUserId: string) => Promise<void>;
  isUserBlocked: (blockerId: string, blockedUserId: string) => boolean;
  getBlockedUsers: (userId: string) => BlockedUser[];

  // Chat actions
  createChat: (wishId: string, participants: string[]) => Promise<string>;
  addMessage: (chatId: string, senderId: string, text: string) => Promise<void>;
  getChatByWishId: (wishId: string) => Chat | undefined;
  getChatsForUser: (userId: string) => Chat[];
  markMessagesAsRead: (chatId: string, userId: string) => Promise<void>;

  // Shared Wish actions
  shareWish: (wishId: string, senderId: string, recipientId: string, message?: string) => string;
  getSharedWishesForUser: (userId: string) => SharedWish[];
  markSharedWishAsRead: (id: string) => void;

  // Sync actions
  syncConnections: () => Promise<void>;
  syncChats: () => Promise<void>;
  subscribeToMessages: (chatId: string) => void;
  unsubscribeFromMessages: () => void;

  // Debug actions
  debugClearAllConnections: () => Promise<void>;
  debugFetchAllConnectionsRaw: () => Promise<{ connections: unknown; requests: unknown } | null>;
}

// Helper to restore Supabase session
const restoreSupabaseSession = () => {
  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  }
};

const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      contactRequests: [],
      relationshipUpgradeRequests: [],
      blockedUsers: [],
      chats: [],
      sharedWishes: [],
      isSyncing: false,
      messageSubscription: null,

      // Contact Request Actions
      sendContactRequest: async (senderId, receiverId, message) => {
        const id = uuidv4();
        const now = Date.now();


        // First save to Supabase - this is the source of truth
        restoreSupabaseSession();
        const session = useUserStore.getState().supabaseSession;

        if (!session?.access_token) {
          throw new Error("Non sei autenticato. Effettua il login.");
        }

        try {
          const insertData = {
            id,
            from_user_id: senderId,
            to_user_id: receiverId,
            message: message || null,
            status: "pending",
            request_type: "connection",
          };

          const insertResult = await supabaseDb.insert("connection_requests", insertData);

          if (insertResult.error) {
            throw new Error("Impossibile inviare la richiesta. Riprova.");
          }


          // Now add locally after successful Supabase save
          const newRequest: ContactRequest = {
            id,
            senderId,
            receiverId,
            message,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            contactRequests: [...state.contactRequests, newRequest],
          }));

          // Create in-app notification for the receiver
          useNotificationStore.getState().addNotification(
            receiverId,
            "connection_request",
            "New Connection Request",
            "Someone wants to connect with you",
            id
          );

          // Send push notification
          const currentUser = useUserStore.getState().currentUser;
          if (currentUser) {
            sendConnectionRequestNotification(receiverId, currentUser.name, id);
          }

          return id;
        } catch (error) {
          throw error;
        }
      },

      acceptContactRequest: async (requestId, connectionType: ConnectionType = "friend") => {
        const request = get().contactRequests.find((r) => r.id === requestId);
        if (!request) {
          throw new Error("Richiesta non trovata");
        }

        if (request.status !== "pending") {
          throw new Error("Questa richiesta è già stata gestita");
        }


        // First update Supabase - this is the source of truth
        restoreSupabaseSession();
        const session = useUserStore.getState().supabaseSession;

        if (!session?.access_token) {
          throw new Error("Non sei autenticato. Effettua il login.");
        }

        try {
          // Update request status in Supabase
          const updateResult = await supabaseDb.update("connection_requests", { status: "accepted" }, { id: requestId });

          if (updateResult.error) {
            throw new Error("Impossibile accettare la richiesta. Riprova.");
          }

          // Update locally
          set((state) => ({
            contactRequests: state.contactRequests.map((r) =>
              r.id === requestId
                ? { ...r, status: "accepted", updatedAt: Date.now() }
                : r
            ),
          }));

          // Create connection with the specified type (friend or relationship)
          await get().createConnection(request.senderId, request.receiverId, connectionType);

          // In-app notification
          useNotificationStore.getState().addNotification(
            request.senderId,
            "connection_accepted",
            "Connection Accepted",
            connectionType === "relationship"
              ? "Your connection request was accepted as a relationship!"
              : "Your connection request was accepted",
            requestId
          );

          // Send push notification
          const currentUser = useUserStore.getState().currentUser;
          if (currentUser) {
            sendConnectionAcceptedNotification(request.senderId, currentUser.name);
          }

        } catch (error) {
          throw error;
        }
      },

      rejectContactRequest: async (requestId) => {
        set((state) => ({
          contactRequests: state.contactRequests.map((r) =>
            r.id === requestId
              ? { ...r, status: "rejected", updatedAt: Date.now() }
              : r
          ),
        }));

        restoreSupabaseSession();
        await supabaseDb.update("connection_requests", { status: "rejected" }, { id: requestId });
      },

      getPendingRequestsReceived: (userId) => {
        return get().contactRequests.filter(
          (r) => r.receiverId === userId && r.status === "pending"
        );
      },

      getPendingRequestsSent: (userId) => {
        return get().contactRequests.filter(
          (r) => r.senderId === userId && r.status === "pending"
        );
      },

      // Relationship Upgrade Request Actions
      sendRelationshipUpgradeRequest: async (connectionId, senderId, receiverId) => {
        const id = uuidv4();
        const now = Date.now();


        const newRequest: RelationshipUpgradeRequest = {
          id,
          connectionId,
          senderId,
          receiverId,
          status: "pending",
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          relationshipUpgradeRequests: [...state.relationshipUpgradeRequests, newRequest],
        }));

        restoreSupabaseSession();
        const session = useUserStore.getState().supabaseSession;

        if (!session?.access_token) {
          throw new Error("Non sei autenticato. Effettua il login.");
        }

        try {
          const insertData = {
            id,
            from_user_id: senderId,
            to_user_id: receiverId,
            status: "pending",
            request_type: "relationship_upgrade",
            connection_id: connectionId,
          };

          const insertResult = await supabaseDb.insert("connection_requests", insertData);

          if (insertResult.error) {
            throw new Error("Impossibile inviare la richiesta. Riprova.");
          }

          // In-app notification
          useNotificationStore.getState().addNotification(
            receiverId,
            "relationship_upgrade_request",
            "Relationship Upgrade Request",
            "Someone wants to upgrade your connection to a relationship",
            id
          );

          // Send push notification
          const currentUser = useUserStore.getState().currentUser;
          if (currentUser) {
            sendConnectionRequestNotification(receiverId, currentUser.name, id);
          }

          return id;
        } catch (error) {
          throw error;
        }
      },

      acceptRelationshipUpgradeRequest: async (requestId) => {
        const request = get().relationshipUpgradeRequests.find((r) => r.id === requestId);
        if (request && request.status === "pending") {

          set((state) => ({
            relationshipUpgradeRequests: state.relationshipUpgradeRequests.map((r) =>
              r.id === requestId
                ? { ...r, status: "accepted", updatedAt: Date.now() }
                : r
            ),
          }));

          restoreSupabaseSession();
          await supabaseDb.update("connection_requests", { status: "accepted" }, { id: requestId });

          // Find the connection between these two users
          let connectionId = request.connectionId;
          if (!connectionId) {
            // If connectionId is empty, find the connection between the two users
            const connection = get().getConnectionBetweenUsers(request.senderId, request.receiverId);
            if (connection) {
              connectionId = connection.id;
            } else {
            }
          }

          if (connectionId) {
            await get().updateConnectionType(connectionId, "relationship");
          }

          useNotificationStore.getState().addNotification(
            request.senderId,
            "relationship_upgraded",
            "Relationship Upgraded",
            "Your relationship upgrade request was accepted",
            requestId
          );

          // Send push notification
          const currentUser = useUserStore.getState().currentUser;
          if (currentUser) {
            sendConnectionAcceptedNotification(request.senderId, currentUser.name);
          }
        }
      },

      rejectRelationshipUpgradeRequest: async (requestId) => {
        set((state) => ({
          relationshipUpgradeRequests: state.relationshipUpgradeRequests.map((r) =>
            r.id === requestId
              ? { ...r, status: "rejected", updatedAt: Date.now() }
              : r
          ),
        }));

        restoreSupabaseSession();
        await supabaseDb.update("connection_requests", { status: "rejected" }, { id: requestId });
      },

      getPendingUpgradeRequestsReceived: (userId) => {
        return get().relationshipUpgradeRequests.filter(
          (r) => r.receiverId === userId && r.status === "pending"
        );
      },

      getPendingUpgradeRequestForConnection: (connectionId) => {
        const allRequests = get().relationshipUpgradeRequests;
        if (allRequests.length > 0) {
        }
        const found = allRequests.find(
          (r) => r.connectionId === connectionId && r.status === "pending"
        );
        return found;
      },

      // Alternative: Get pending upgrade request between two users
      getPendingUpgradeRequestBetweenUsers: (userId1: string, userId2: string) => {
        const allRequests = get().relationshipUpgradeRequests;
        return allRequests.find(
          (r) =>
            r.status === "pending" &&
            ((r.senderId === userId1 && r.receiverId === userId2) ||
             (r.senderId === userId2 && r.receiverId === userId1))
        );
      },

      // Connection Actions
      createConnection: async (senderId, receiverId, type) => {
        const id = uuidv4();
        const now = Date.now();


        // First save to Supabase - this is the source of truth
        restoreSupabaseSession();
        const session = useUserStore.getState().supabaseSession;

        if (!session?.access_token) {
          throw new Error("Non sei autenticato. Effettua il login.");
        }

        try {
          const insertData = {
            id,
            user_id: senderId,
            connected_user_id: receiverId,
            status: type,
          };

          const insertResult = await supabaseDb.insert("connections", insertData);

          if (insertResult.error) {
            throw new Error("Impossibile creare la connessione. Riprova.");
          }

          // Now add locally after successful Supabase save
          const newConnection: Connection = {
            id,
            senderId,
            receiverId,
            type,
            status: "accepted",
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            connections: [...state.connections, newConnection],
          }));

          return id;
        } catch (error) {
          throw error;
        }
      },

      updateConnectionType: async (connectionId, newType) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === connectionId
              ? { ...conn, type: newType, updatedAt: Date.now() }
              : conn
          ),
        }));

        restoreSupabaseSession();
        await supabaseDb.update("connections", { status: newType }, { id: connectionId });
      },

      updateConnectionStatus: async (id, status) => {
        set((state) => ({
          connections: state.connections.map((conn) =>
            conn.id === id
              ? { ...conn, status, updatedAt: Date.now() }
              : conn
          ),
        }));
      },

      deleteConnection: async (connectionId) => {
        const connection = get().connections.find((c) => c.id === connectionId);

        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== connectionId),
          contactRequests: state.contactRequests.filter(
            (req) =>
              !(
                req.status === "accepted" &&
                connection &&
                ((req.senderId === connection.senderId && req.receiverId === connection.receiverId) ||
                  (req.senderId === connection.receiverId && req.receiverId === connection.senderId))
              )
          ),
        }));

        restoreSupabaseSession();
        await supabaseDb.delete("connections", { id: connectionId });

        if (connection) {
          await supabaseDb.delete("connection_requests", {
            from_user_id: connection.senderId,
            to_user_id: connection.receiverId,
          });
          await supabaseDb.delete("connection_requests", {
            from_user_id: connection.receiverId,
            to_user_id: connection.senderId,
          });
        }
      },

      getConnectionsForUser: (userId) => {
        return get().connections.filter(
          (conn) => (conn.senderId === userId || conn.receiverId === userId) && conn.status === "accepted"
        );
      },

      getAcceptedConnections: (userId) => {
        const allConnections = get().connections;
        if (allConnections.length > 0) {
        }
        const filtered = allConnections.filter(
          (conn) =>
            (conn.senderId === userId || conn.receiverId === userId) &&
            conn.status === "accepted"
        );
        return filtered;
      },

      getRelationshipConnections: (userId) => {
        return get().connections.filter(
          (conn) =>
            (conn.senderId === userId || conn.receiverId === userId) &&
            conn.status === "accepted" &&
            conn.type === "relationship"
        );
      },

      getConnectionBetweenUsers: (userId1, userId2) => {
        return get().connections.find(
          (conn) =>
            ((conn.senderId === userId1 && conn.receiverId === userId2) ||
             (conn.senderId === userId2 && conn.receiverId === userId1)) &&
            conn.status === "accepted"
        );
      },

      // Blocking Actions
      blockUser: async (blockerId, blockedUserId) => {
        const existingConnection = get().getConnectionBetweenUsers(blockerId, blockedUserId);
        if (existingConnection) {
          await get().deleteConnection(existingConnection.id);
        }

        set((state) => ({
          contactRequests: state.contactRequests.filter(
            (r) =>
              !((r.senderId === blockerId && r.receiverId === blockedUserId) ||
                (r.senderId === blockedUserId && r.receiverId === blockerId))
          ),
        }));

        const id = uuidv4();
        const newBlock: BlockedUser = {
          id,
          blockerId,
          blockedUserId,
          createdAt: Date.now(),
        };

        set((state) => ({
          blockedUsers: [...state.blockedUsers, newBlock],
        }));

        restoreSupabaseSession();
        await supabaseDb.insert("blocked_users", {
          id,
          user_id: blockerId,
          blocked_user_id: blockedUserId,
        });
      },

      unblockUser: async (blockerId, blockedUserId) => {
        const block = get().blockedUsers.find(
          (b) => b.blockerId === blockerId && b.blockedUserId === blockedUserId
        );

        set((state) => ({
          blockedUsers: state.blockedUsers.filter(
            (b) => !(b.blockerId === blockerId && b.blockedUserId === blockedUserId)
          ),
        }));

        if (block) {
          restoreSupabaseSession();
          await supabaseDb.delete("blocked_users", { id: block.id });
        }
      },

      isUserBlocked: (blockerId, blockedUserId) => {
        return get().blockedUsers.some(
          (b) => b.blockerId === blockerId && b.blockedUserId === blockedUserId
        );
      },

      getBlockedUsers: (userId) => {
        return get().blockedUsers.filter((b) => b.blockerId === userId);
      },

      // Chat Actions
      createChat: async (wishId, participants) => {
        const existingChat = get().chats.find((chat) => chat.wishId === wishId);
        if (existingChat) return existingChat.id;

        const id = uuidv4();
        const newChat: Chat = {
          id,
          wishId,
          participants,
          messages: [],
          lastMessageAt: Date.now(),
        };

        set((state) => ({ chats: [...state.chats, newChat] }));

        // Create chat in Supabase
        restoreSupabaseSession();
        await supabaseDb.insert("chats", {
          id,
          wish_id: wishId,
        });

        // Add participants
        for (const participantId of participants) {
          await supabaseDb.insert("chat_participants", {
            chat_id: id,
            user_id: participantId,
          });
        }

        return id;
      },

      addMessage: async (chatId, senderId, text) => {
        const id = uuidv4();
        const now = Date.now();

        const chat = get().chats.find((c) => c.id === chatId);
        const newMessage: ChatMessage = {
          id,
          wishId: chat?.wishId || chatId,
          senderId,
          text,
          createdAt: now,
          read: false,
        };

        // Add locally first
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [...chat.messages, newMessage],
                  lastMessageAt: now,
                }
              : chat
          ),
        }));

        // Sync to Supabase
        restoreSupabaseSession();
        await supabaseDb.insert("messages", {
          id,
          chat_id: chatId,
          sender_id: senderId,
          content: text,
          is_read: false,
        });

        // Send notification to other participants
        if (chat) {
          const currentUser = useUserStore.getState().currentUser;
          const otherParticipants = chat.participants.filter((p) => p !== senderId);
          otherParticipants.forEach((recipientId) => {
            // In-app notification
            useNotificationStore.getState().addNotification(
              recipientId,
              "message_received",
              "New Message",
              text.substring(0, 50) + (text.length > 50 ? "..." : ""),
              chatId
            );

            // Push notification
            if (currentUser) {
              sendMessageNotification(
                recipientId,
                currentUser.name,
                text,
                chatId
              );
            }
          });
        }
      },

      getChatByWishId: (wishId) => {
        return get().chats.find((chat) => chat.wishId === wishId);
      },

      getChatsForUser: (userId) => {
        return get().chats.filter((chat) =>
          chat.participants.includes(userId)
        );
      },

      markMessagesAsRead: async (chatId, userId) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg) =>
                    msg.senderId !== userId ? { ...msg, read: true } : msg
                  ),
                }
              : chat
          ),
        }));

        // Update in Supabase
        restoreSupabaseSession();
        // Mark all messages in this chat as read where sender is not the current user
        const chat = get().chats.find((c) => c.id === chatId);
        if (chat) {
          const unreadMessages = chat.messages.filter((m) => m.senderId !== userId && !m.read);
          for (const msg of unreadMessages) {
            await supabaseDb.update("messages", { is_read: true }, { id: msg.id });
          }
        }
      },

      shareWish: (wishId, senderId, recipientId, message) => {
        const newSharedWish: SharedWish = {
          id: uuidv4(),
          wishId,
          senderId,
          recipientId,
          message,
          createdAt: Date.now(),
          read: false,
        };
        set((state) => ({
          sharedWishes: [...state.sharedWishes, newSharedWish],
        }));
        return newSharedWish.id;
      },

      getSharedWishesForUser: (userId) => {
        return get().sharedWishes.filter((sw) => sw.recipientId === userId);
      },

      markSharedWishAsRead: (id) => {
        set((state) => ({
          sharedWishes: state.sharedWishes.map((sw) =>
            sw.id === id ? { ...sw, read: true } : sw
          ),
        }));
      },

      // Sync Actions
      syncConnections: async () => {
        const currentUser = useUserStore.getState().currentUser;

        if (!currentUser) {
          return;
        }

        const userId = currentUser.id;

        set({ isSyncing: true });
        restoreSupabaseSession();

        try {
          // Fetch connections where I am user_id
          const conn1Result = await supabaseDb.select<Record<string, unknown>[]>("connections", {
            filter: { user_id: userId },
          });
          if (conn1Result.error) {
          }

          // Fetch connections where I am connected_user_id
          const conn2Result = await supabaseDb.select<Record<string, unknown>[]>("connections", {
            filter: { connected_user_id: userId },
          });
          if (conn2Result.error) {
          }

          const allConnections = [...(conn1Result.data || []), ...(conn2Result.data || [])];
          // Remove duplicates by ID
          const uniqueConnections = Array.from(new Map(allConnections.map(c => [c.id, c])).values());

          if (uniqueConnections.length > 0) {
          }

          const supabaseConnections: Connection[] = uniqueConnections.map((c) => ({
            id: c.id as string,
            senderId: c.user_id as string,
            receiverId: c.connected_user_id as string,
            type: (c.status as ConnectionType) || "friend",
            status: "accepted" as ConnectionStatus,
            createdAt: new Date(c.created_at as string).getTime(),
            updatedAt: new Date(c.updated_at as string).getTime(),
          }));

          // Fetch connection requests received by me
          const reqReceivedResult = await supabaseDb.select<Record<string, unknown>[]>("connection_requests", {
            filter: { to_user_id: userId },
          });

          // Fetch connection requests sent by me
          const reqSentResult = await supabaseDb.select<Record<string, unknown>[]>("connection_requests", {
            filter: { from_user_id: userId },
          });

          const allRequests = [...(reqReceivedResult.data || []), ...(reqSentResult.data || [])];
          // Remove duplicate requests
          const uniqueRequests = Array.from(new Map(allRequests.map(r => [r.id, r])).values());


          // Separate contact requests and relationship upgrade requests from Supabase
          const supabaseContactRequests: ContactRequest[] = uniqueRequests
            .filter((r) => r.request_type === "connection" || !r.request_type)
            .map((r) => ({
              id: r.id as string,
              senderId: r.from_user_id as string,
              receiverId: r.to_user_id as string,
              message: r.message as string | undefined,
              status: r.status as "pending" | "accepted" | "rejected",
              createdAt: new Date(r.created_at as string).getTime(),
              updatedAt: new Date(r.updated_at as string || r.created_at as string).getTime(),
            }));

          const supabaseRelationshipUpgradeRequests: RelationshipUpgradeRequest[] = uniqueRequests
            .filter((r) => r.request_type === "relationship_upgrade")
            .map((r) => ({
              id: r.id as string,
              connectionId: r.connection_id as string || "",
              senderId: r.from_user_id as string,
              receiverId: r.to_user_id as string,
              status: r.status as "pending" | "accepted" | "rejected",
              createdAt: new Date(r.created_at as string).getTime(),
              updatedAt: new Date(r.updated_at as string || r.created_at as string).getTime(),
            }));

          // Debug: Show all request_types found
          const requestTypes = [...new Set(uniqueRequests.map(r => r.request_type))];

          if (supabaseConnections.length > 0) {
          }
          if (supabaseRelationshipUpgradeRequests.length > 0) {
          }

          // Check if we have local data that needs to be migrated to Supabase
          const localConnections = get().connections;
          const localRequests = get().contactRequests;

          // Migrate local connections to Supabase if they don't exist there
          if (localConnections.length > 0 && supabaseConnections.length === 0) {
            for (const conn of localConnections) {
              // Check if this connection involves the current user
              const involvesCurrentUser = conn.senderId === userId || conn.receiverId === userId;
              if (involvesCurrentUser) {
                try {
                  const insertResult = await supabaseDb.insert("connections", {
                    id: conn.id,
                    user_id: conn.senderId,
                    connected_user_id: conn.receiverId,
                    status: conn.type,
                  });
                  if (insertResult.error) {
                  } else {
                    // Add to supabaseConnections so it's included in the final set
                    supabaseConnections.push(conn);
                  }
                } catch (e) {
                }
              }
            }
          }

          // Migrate local contact requests to Supabase if they don't exist there
          if (localRequests.length > 0 && supabaseContactRequests.length === 0) {
            for (const req of localRequests) {
              // Check if this request involves the current user
              const involvesCurrentUser = req.senderId === userId || req.receiverId === userId;
              if (involvesCurrentUser) {
                try {
                  const insertResult = await supabaseDb.insert("connection_requests", {
                    id: req.id,
                    from_user_id: req.senderId,
                    to_user_id: req.receiverId,
                    message: req.message || null,
                    status: req.status,
                    request_type: "connection",
                  });
                  if (insertResult.error) {
                  } else {
                    // Add to supabaseContactRequests so it's included in the final set
                    supabaseContactRequests.push(req);
                  }
                } catch (e) {
                }
              }
            }
          }

          // Check for accepted requests that don't have a corresponding connection.
          // Only recreate if both users still have the request in DB (not intentionally deleted).
          // We use the DB-fetched supabaseContactRequests here — if the request was deleted
          // by deleteConnection, it won't be in this list and no recreation happens.
          const acceptedRequests = supabaseContactRequests.filter(r => r.status === "accepted");

          for (const acceptedReq of acceptedRequests) {
            // Check if a connection already exists between these users
            const connectionExists = supabaseConnections.some(
              (conn) =>
                (conn.senderId === acceptedReq.senderId && conn.receiverId === acceptedReq.receiverId) ||
                (conn.senderId === acceptedReq.receiverId && conn.receiverId === acceptedReq.senderId)
            );

            if (!connectionExists) {

              try {
                const connId = uuidv4();
                const insertResult = await supabaseDb.insert("connections", {
                  id: connId,
                  user_id: acceptedReq.senderId,
                  connected_user_id: acceptedReq.receiverId,
                  status: "friend",
                });

                if (insertResult.error) {
                } else {
                  // Add to local array
                  const newConnection: Connection = {
                    id: connId,
                    senderId: acceptedReq.senderId,
                    receiverId: acceptedReq.receiverId,
                    type: "friend",
                    status: "accepted",
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  supabaseConnections.push(newConnection);
                }
              } catch (e) {
              }
            }
          }

          set({
            connections: supabaseConnections,
            contactRequests: supabaseContactRequests,
            relationshipUpgradeRequests: supabaseRelationshipUpgradeRequests,
            isSyncing: false,
          });

          // Create notifications for pending requests received by current user (if not already created)
          const finalRequests = get().contactRequests;
          const pendingRequestsReceived = finalRequests.filter(
            (r) => r.receiverId === userId && r.status === "pending"
          );

          const notificationStore = useNotificationStore.getState();
          const existingNotifications = notificationStore.getNotificationsForUser(currentUser.id);

          pendingRequestsReceived.forEach((request) => {
            // Check if notification already exists for this request
            const hasNotification = existingNotifications.some(
              (n) => n.type === "connection_request" && n.relatedId === request.id
            );

            if (!hasNotification) {
              // Create notification for this pending request
              notificationStore.addNotification(
                currentUser.id,
                "connection_request",
                "New Connection Request",
                "Someone wants to connect with you",
                request.id
              );
            }
          });

          // Also create notifications for pending relationship upgrade requests
          const finalUpgradeRequests = get().relationshipUpgradeRequests;
          const pendingUpgradeRequestsReceived = finalUpgradeRequests.filter(
            (r) => r.receiverId === userId && r.status === "pending"
          );

          pendingUpgradeRequestsReceived.forEach((request) => {
            // Check if notification already exists for this request
            const hasNotification = existingNotifications.some(
              (n) => n.type === "relationship_upgrade_request" && n.relatedId === request.id
            );

            if (!hasNotification) {
              // Create notification for this pending upgrade request
              notificationStore.addNotification(
                currentUser.id,
                "relationship_upgrade_request",
                "Relationship Upgrade Request",
                "Someone wants to upgrade your connection to a relationship",
                request.id
              );
            }
          });

        } catch (error) {
          set({ isSyncing: false });
        }
      },

      syncChats: async () => {
        const currentUser = useUserStore.getState().currentUser;
        if (!currentUser) return;

        restoreSupabaseSession();

        try {
          // Fetch chat participants where I am a participant
          const participantResult = await supabaseDb.select<Record<string, unknown>[]>("chat_participants", {
            filter: { user_id: currentUser.id },
          });

          const chatIds = participantResult.data?.map((p) => p.chat_id as string) || [];

          const chats: Chat[] = [];

          for (const chatId of chatIds) {
            // Fetch chat
            const chatResult = await supabaseDb.select<Record<string, unknown>[]>("chats", {
              filter: { id: chatId },
            });

            if (!chatResult.data?.[0]) continue;

            const chat = chatResult.data[0];

            // Fetch participants
            const participantsResult = await supabaseDb.select<Record<string, unknown>[]>("chat_participants", {
              filter: { chat_id: chatId },
            });

            const participants = participantsResult.data?.map((p) => p.user_id as string) || [];

            // Fetch messages
            const messagesResult = await supabaseDb.select<Record<string, unknown>[]>("messages", {
              filter: { chat_id: chatId },
            });

            const messages: ChatMessage[] = (messagesResult.data || []).map((m) => ({
              id: m.id as string,
              wishId: chat.wish_id as string,
              senderId: m.sender_id as string,
              text: m.content as string,
              createdAt: new Date(m.created_at as string).getTime(),
              read: m.is_read as boolean,
            }));

            chats.push({
              id: chatId,
              wishId: chat.wish_id as string,
              participants,
              messages: messages.sort((a, b) => a.createdAt - b.createdAt),
              lastMessageAt: messages.length > 0 ? messages[messages.length - 1].createdAt : new Date(chat.created_at as string).getTime(),
            });
          }

          set({ chats });
        } catch (error) {
        }
      },

      subscribeToMessages: (chatId) => {
        // Unsubscribe from previous subscription
        get().unsubscribeFromMessages();

        const subscription = supabaseRealtime.subscribe(
          "messages",
          (payload) => {
            if (payload.eventType === "INSERT") {
              const newMsg = payload.new;
              const currentUser = useUserStore.getState().currentUser;

              // Only add if not from current user (they already have it)
              if (newMsg.sender_id !== currentUser?.id) {
                const message: ChatMessage = {
                  id: newMsg.id as string,
                  wishId: chatId,
                  senderId: newMsg.sender_id as string,
                  text: newMsg.content as string,
                  createdAt: new Date(newMsg.created_at as string).getTime(),
                  read: false,
                };

                set((state) => ({
                  chats: state.chats.map((chat) =>
                    chat.id === chatId
                      ? {
                          ...chat,
                          messages: [...chat.messages, message],
                          lastMessageAt: message.createdAt,
                        }
                      : chat
                  ),
                }));
              }
            }
          },
          { column: "chat_id", value: chatId }
        );

        set({ messageSubscription: subscription });
      },

      unsubscribeFromMessages: () => {
        const { messageSubscription } = get();
        if (messageSubscription) {
          messageSubscription.unsubscribe();
          set({ messageSubscription: null });
        }
      },

      // DEBUG: Clear all connection data from Supabase and local store
      debugClearAllConnections: async () => {
        const currentUser = useUserStore.getState().currentUser;
        if (!currentUser) {
          return;
        }

        restoreSupabaseSession();

        try {
          // First, fetch all connection_requests involving this user
          const reqReceived = await supabaseDb.select<Record<string, unknown>[]>("connection_requests", {
            filter: { to_user_id: currentUser.id },
          });
          const reqSent = await supabaseDb.select<Record<string, unknown>[]>("connection_requests", {
            filter: { from_user_id: currentUser.id },
          });

          const allRequests = [...(reqReceived.data || []), ...(reqSent.data || [])];

          // Delete each request
          for (const req of allRequests) {
            await supabaseDb.delete("connection_requests", { id: req.id });
          }

          // Fetch all connections involving this user
          const conn1 = await supabaseDb.select<Record<string, unknown>[]>("connections", {
            filter: { user_id: currentUser.id },
          });
          const conn2 = await supabaseDb.select<Record<string, unknown>[]>("connections", {
            filter: { connected_user_id: currentUser.id },
          });

          const allConns = [...(conn1.data || []), ...(conn2.data || [])];

          // Delete each connection
          for (const conn of allConns) {
            await supabaseDb.delete("connections", { id: conn.id });
          }

          // Clear local store
          set({
            connections: [],
            contactRequests: [],
            relationshipUpgradeRequests: [],
          });

        } catch (error) {
        }
      },

      // DEBUG: Fetch ALL connections from Supabase (no filter) to see what exists
      debugFetchAllConnectionsRaw: async () => {
        restoreSupabaseSession();

        try {
          // Fetch ALL connections without any filter
          const response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/connections?select=*`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "apikey": process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
                "Authorization": `Bearer ${useUserStore.getState().supabaseSession?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
              },
            }
          );
          const data = await response.json();

          // Also fetch all connection_requests
          const reqResponse = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/connection_requests?select=*`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "apikey": process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
                "Authorization": `Bearer ${useUserStore.getState().supabaseSession?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
              },
            }
          );
          const reqData = await reqResponse.json();

          return { connections: data, requests: reqData };
        } catch (error) {
          return null;
        }
      },
    }),
    {
      name: "wishy-connections-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        connections: state.connections,
        contactRequests: state.contactRequests,
        relationshipUpgradeRequests: state.relationshipUpgradeRequests,
        blockedUsers: state.blockedUsers,
        chats: state.chats,
        sharedWishes: state.sharedWishes,
      }),
    }
  )
);

export default useConnectionStore;
