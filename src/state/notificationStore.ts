import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Notification, NotificationType } from "../types/wishy";
import { v4 as uuidv4 } from "uuid";
import { supabaseDb, setSession } from "../api/supabase";
import useUserStore from "./userStore";

// Helper to restore Supabase session
const restoreSupabaseSession = () => {
  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  }
};

interface NotificationState {
  notifications: Notification[];

  // Actions
  addNotification: (
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    relatedId?: string
  ) => string;
  getNotificationsForUser: (userId: string) => Notification[];
  getUnreadCount: (userId: string) => number;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: (userId: string) => void;
  deleteNotification: (notificationId: string) => void;
  clearAllNotifications: (userId: string) => void;
  syncNotifications: () => Promise<void>;
}

const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      addNotification: (userId, type, title, message, relatedId) => {
        const id = uuidv4();
        const now = Date.now();

        console.log("=== ADD NOTIFICATION ===");
        console.log("Notification ID:", id);
        console.log("For user:", userId);
        console.log("Type:", type);
        console.log("Title:", title);
        console.log("Message:", message);
        console.log("Related ID:", relatedId);

        const newNotification: Notification = {
          id,
          userId,
          type,
          title,
          message,
          relatedId,
          read: false,
          createdAt: now,
        };

        set((state) => {
          console.log("Adding notification to local store. Current count:", state.notifications.length);
          return {
            notifications: [newNotification, ...state.notifications],
          };
        });

        // Also save to Supabase for cross-device sync
        restoreSupabaseSession();

        const notificationData = {
          id,
          user_id: userId,
          type,
          title,
          message,
          related_id: relatedId || null,
          related_type: type,
          is_read: false,
        };

        console.log("Saving notification to Supabase:", JSON.stringify(notificationData));

        supabaseDb.insert("notifications", notificationData).then((result) => {
          if (result.error) {
            console.log("!!! FAILED to save notification to Supabase:", result.error.message);
            console.log("Error details:", JSON.stringify(result.error));
          } else {
            console.log("*** SUCCESS: Notification saved to Supabase:", id);
          }
        }).catch((error) => {
          console.log("!!! EXCEPTION saving notification to Supabase:", error);
        });

        return id;
      },

      getNotificationsForUser: (userId) => {
        return get()
          .notifications.filter((notif) => notif.userId === userId)
          .sort((a, b) => b.createdAt - a.createdAt);
      },

      getUnreadCount: (userId) => {
        return get().notifications.filter(
          (notif) => notif.userId === userId && !notif.read
        ).length;
      },

      markAsRead: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          ),
        }));

        // Update in Supabase
        restoreSupabaseSession();
        supabaseDb.update("notifications", { is_read: true }, { id: notificationId }).catch((error) => {
          console.log("Error updating notification in Supabase:", error);
        });
      },

      markAllAsRead: (userId) => {
        const unreadNotifications = get().notifications.filter(
          (notif) => notif.userId === userId && !notif.read
        );

        set((state) => ({
          notifications: state.notifications.map((notif) =>
            notif.userId === userId ? { ...notif, read: true } : notif
          ),
        }));

        // Update all in Supabase
        restoreSupabaseSession();
        unreadNotifications.forEach((notif) => {
          supabaseDb.update("notifications", { is_read: true }, { id: notif.id }).catch((error) => {
            console.log("Error updating notification in Supabase:", error);
          });
        });
      },

      deleteNotification: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.filter(
            (notif) => notif.id !== notificationId
          ),
        }));

        // Delete from Supabase
        restoreSupabaseSession();
        supabaseDb.delete("notifications", { id: notificationId }).catch((error) => {
          console.log("Error deleting notification from Supabase:", error);
        });
      },

      clearAllNotifications: (userId) => {
        const userNotifications = get().notifications.filter(
          (notif) => notif.userId === userId
        );

        set((state) => ({
          notifications: state.notifications.filter(
            (notif) => notif.userId !== userId
          ),
        }));

        // Delete all from Supabase
        restoreSupabaseSession();
        userNotifications.forEach((notif) => {
          supabaseDb.delete("notifications", { id: notif.id }).catch((error) => {
            console.log("Error deleting notification from Supabase:", error);
          });
        });
      },

      syncNotifications: async () => {
        const currentUser = useUserStore.getState().currentUser;
        if (!currentUser) {
          console.log("syncNotifications: No current user");
          return;
        }

        console.log("=== SYNC NOTIFICATIONS START ===");
        console.log("syncNotifications: Current user ID:", currentUser.id);
        console.log("syncNotifications: Current user name:", currentUser.name);
        restoreSupabaseSession();

        try {
          // Fetch notifications from Supabase
          const result = await supabaseDb.select<Record<string, unknown>[]>("notifications", {
            filter: { user_id: currentUser.id },
            order: { column: "created_at", ascending: false },
            limit: 100,
          });

          console.log("syncNotifications: Raw result:", JSON.stringify(result));

          if (result.error) {
            console.log("syncNotifications ERROR:", result.error.message);
            // On error, keep local notifications - don't clear them
            return;
          }

          const supabaseNotifications: Notification[] = (result.data || []).map((n) => ({
            id: n.id as string,
            userId: n.user_id as string,
            type: n.type as NotificationType,
            title: n.title as string,
            message: n.message as string,
            relatedId: n.related_id as string | undefined,
            read: n.is_read as boolean,
            createdAt: new Date(n.created_at as string).getTime(),
          }));

          console.log("syncNotifications: Fetched", supabaseNotifications.length, "notifications from Supabase");

          // Get current local notifications for this user
          const localNotificationsForUser = get().notifications.filter(
            (n) => n.userId === currentUser.id
          );
          const localNotificationsForOthers = get().notifications.filter(
            (n) => n.userId !== currentUser.id
          );

          console.log("syncNotifications: Local notifications for current user:", localNotificationsForUser.length);
          console.log("syncNotifications: Local notifications for other users:", localNotificationsForOthers.length);

          // Smart merge: combine Supabase notifications with local ones (avoiding duplicates)
          // Keep local notifications that are not in Supabase (they might not have synced yet)
          const supabaseIds = new Set(supabaseNotifications.map(n => n.id));
          const localOnlyNotifications = localNotificationsForUser.filter(
            (localN) => !supabaseIds.has(localN.id)
          );

          console.log("syncNotifications: Local-only notifications to keep:", localOnlyNotifications.length);

          // Combine: Supabase notifications + local-only notifications + other users' notifications
          const mergedNotifications = [
            ...supabaseNotifications,
            ...localOnlyNotifications,
            ...localNotificationsForOthers,
          ].sort((a, b) => b.createdAt - a.createdAt);

          set({
            notifications: mergedNotifications,
          });

          console.log("syncNotifications: Total notifications after sync:", get().notifications.length);
          console.log("=== SYNC NOTIFICATIONS COMPLETE ===");
        } catch (error) {
          console.log("syncNotifications ERROR:", error);
          // On error, keep local notifications - don't clear them
        }
      },
    }),
    {
      name: "wishy-notifications-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useNotificationStore;
