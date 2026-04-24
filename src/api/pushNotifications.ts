/**
 * Push Notification Service for Wishy App
 * Uses Expo Push Notifications for cross-platform push support
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabaseDb, setSession } from "./supabase";
import useUserStore from "../state/userStore";
import useNotificationStore from "../state/notificationStore";
/**
 * Get the EAS project ID from Expo config (single source of truth)
 * Priority: Constants.expoConfig.extra.eas.projectId
 */
function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Use the badge count from the notification payload
    // The notification will be synced and badge updated in App.tsx listener
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

// Store for the current push token
let currentPushToken: string | null = null;

/**
 * Register for push notifications and get the Expo push token
 */
export async function registerForPushNotifications(): Promise<string | null> {

  if (!Device.isDevice) {
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }


    // Get Expo push token - need to pass projectId for standalone builds
    // The projectId is read dynamically from Constants.expoConfig.extra.eas.projectId
    const projectId = getProjectId();
    let tokenData;

    // First, try to get the native device token (this should always work on iOS)
    // Add timeout because this can hang indefinitely if APNs is not properly configured
    let devicePushToken: string | null = null;
    try {

      const deviceTokenPromise = Notifications.getDevicePushTokenAsync();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Device token request timed out after 15 seconds. This usually means APNs credentials are not properly configured in Expo/EAS.")), 15000)
      );

      const deviceTokenResult = await Promise.race([deviceTokenPromise, timeoutPromise]);
      devicePushToken = deviceTokenResult.data as string;
    } catch (deviceError) {
    }

    // Now try to get Expo push token
    try {
      if (!projectId) {
      }
      const tokenOptions: Notifications.ExpoPushTokenOptions = {
        devicePushToken: devicePushToken ? { data: devicePushToken, type: "ios" } : undefined,
      };
      if (projectId) {
        tokenOptions.projectId = projectId;
      }
      tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
    } catch (tokenError) {

      // Try without projectId
      try {
        tokenData = await Notifications.getExpoPushTokenAsync({
          devicePushToken: devicePushToken ? { data: devicePushToken, type: "ios" } : undefined,
        });
      } catch (fallbackError) {

        if (!tokenData) {
          return null;
        }
      }
    }

    if (!tokenData) {
      return null;
    }

    currentPushToken = tokenData.data;

    // Configure Android channel
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FFB6D9",
      });
    }

    return currentPushToken;
  } catch (error) {
    return null;
  }
}

/**
 * Save the push token to Supabase for the current user
 * IMPORTANT: A push token is unique to a device, not a user.
 * When a user logs in on a device, we must:
 * 1. Remove this token from ALL other users (since the device now belongs to this user)
 * 2. Associate the token with the current user
 */
export async function savePushTokenToSupabase(userId: string, token: string): Promise<void> {

  if (!userId || !token) {
    return;
  }

  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  } else {
  }

  try {
    // Use the transfer_push_token function to handle device ownership transfer
    // This function safely transfers token ownership when a user logs in on a device
    
    const transferResult = await supabaseDb.rpc<null>("transfer_push_token", {
      p_token: token,
      p_user_id: userId,
      p_platform: Platform.OS,
    });

    if (transferResult.error) {
      
      // Fallback: Try the old method (delete + upsert)
      
      // Step 1: Try to delete the token (might fail due to RLS, that's okay)
      const deleteResult = await supabaseDb.delete("push_tokens", { token: token });
      if (deleteResult.error) {
      }

      // Step 2: Try to insert the token
      const insertResult = await supabaseDb.insert("push_tokens", {
        user_id: userId,
        token,
        platform: Platform.OS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertResult.error) {
        if (insertResult.error.code === "23505" || insertResult.error.message?.includes("duplicate")) {
          const updateResult = await supabaseDb.update(
            "push_tokens",
            { user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
            { token: token }
          );
          if (updateResult.error) {
          } else {
          }
        } else {
        }
      } else {
      }
    } else {
    }

    // Step 3: Verify the token was saved
    const verifyResult = await supabaseDb.select<{ token: string; user_id: string }[]>("push_tokens", {
      filter: { user_id: userId },
    });

    if (verifyResult.data && verifyResult.data.length > 0) {
    } else {
    }

  } catch (error) {
  }
}

/**
 * Remove push token from Supabase (on logout)
 */
export async function removePushTokenFromSupabase(userId: string): Promise<void> {
  if (!currentPushToken) return;

  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  }

  try {
    await supabaseDb.delete("push_tokens", {
      user_id: userId,
      token: currentPushToken,
    });
  } catch (error) {
  }
}

/**
 * Get push tokens for a specific user
 */
export async function getUserPushTokens(userId: string): Promise<string[]> {

  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  } else {
  }

  try {
    const result = await supabaseDb.select<{ token: string; user_id: string; platform: string }[]>("push_tokens", {
      filter: { user_id: userId },
    });


    if (result.error) {
      return [];
    }

    const tokens = result.data?.map((t) => t.token) || [];
    tokens.forEach((t, i) => console.log(`Token ${i + 1}:`, t));

    return tokens;
  } catch (error) {
    return [];
  }
}

/**
 * Send a push notification to a specific user via Expo Push API
 */
export async function sendPushNotification(
  targetUserId: string,
  notification: PushNotificationData
): Promise<void> {

  // Validate targetUserId
  if (!targetUserId || targetUserId.trim() === "") {
    return;
  }

  try {
    const tokens = await getUserPushTokens(targetUserId);

    if (tokens.length === 0) {

      // Debug: Check all tokens in database
      await debugGetAllPushTokens();
      return;
    }

    const notifResult = await supabaseDb.select<{ id: string; is_read: boolean }[]>("notifications", {
      filter: { user_id: targetUserId, is_read: false },
    });
    // Get badge count - use provided value or query from database
    let badgeCount = notifResult?.data?.length ;

    if (badgeCount === undefined) {
      const session = useUserStore.getState().supabaseSession;
      if (session) {
        setSession(session);
      }

      badgeCount = 1; // Default to 1 if we can't get the count
      try {
       

        if (!notifResult.error && notifResult.data) {
          badgeCount = notifResult.data.length - 1;
        }
      } catch (error) {
      }
    } else {
    }

    // Send to all user's devices
    const messages = tokens.map((token) => ({
      to: token,
      sound: "default" as const,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority: "high" as const,
      badge: badgeCount,
    }));


    // Send via Expo Push API
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // Check for errors in the response and handle invalid tokens
    if (result.data) {
      const invalidTokens: string[] = [];
      
      result.data.forEach((item: { status: string; message?: string; details?: { error?: string; expoPushToken?: string } }, index: number) => {
        if (item.status === "error") {

          // Handle specific error cases
          if (item.details?.error === "DeviceNotRegistered" || item.details?.error === "InvalidCredentials") {
            // Extract the token that failed
            const failedToken = tokens[index];
            if (failedToken) {
              invalidTokens.push(failedToken);
            }
          } else if (item.details?.error === "MessageTooBig") {
          } else if (item.details?.error === "MessageRateExceeded") {
          }
        } else {
        }
      });

      // Remove invalid tokens from database
      if (invalidTokens.length > 0) {
        // Restore session for database operations
        const session = useUserStore.getState().supabaseSession;
        if (session) {
          setSession(session);
        }
        
        for (const invalidToken of invalidTokens) {
          try {
            const deleteResult = await supabaseDb.delete("push_tokens", { token: invalidToken });
            if (deleteResult.error) {
            } else {
            }
          } catch (error) {
          }
        }
      }
    } else {
    }

  } catch (error) {
  }
}

/**
 * Get unread notification count for a user from database
 */
async function getUnreadCountForUser(userId: string): Promise<number> {
  try {
    const session = useUserStore.getState().supabaseSession;
    if (session) {
      setSession(session);
    }

    const result = await supabaseDb.select<{ id: string }[]>("notifications", {
      filter: { user_id: userId, is_read: false },
    });

    if (!result.error && result.data) {
      return result.data.length;
    }
  } catch (error) {
  }
  return 0;
}

/**
 * Send push notification for a new wish received
 */
export async function sendWishReceivedNotification(
  targetUserId: string,
  senderName: string,
  wishTitle: string,
  wishId: string
): Promise<void> {
  // Get current unread count (notification is already saved to DB before this is called)
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "New Wish Received!",
    body: `${senderName} sent you a wish: "${wishTitle}"`,
    data: { type: "wish_received", wishId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for wish accepted
 */
export async function sendWishAcceptedNotification(
  targetUserId: string,
  accepterName: string,
  wishTitle: string,
  wishId: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "Wish Accepted!",
    body: `${accepterName} accepted your wish: "${wishTitle}"`,
    data: { type: "wish_accepted", wishId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for new message
 */
export async function sendMessageNotification(
  targetUserId: string,
  senderName: string,
  messagePreview: string,
  chatId: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: `Message from ${senderName}`,
    body: messagePreview.length > 50 ? messagePreview.substring(0, 50) + "..." : messagePreview,
    data: { type: "message_received", chatId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for connection request
 */
export async function sendConnectionRequestNotification(
  targetUserId: string,
  senderName: string,
  requestId: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "New Connection Request",
    body: `${senderName} wants to connect with you`,
    data: { type: "connection_request", requestId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for connection accepted
 */
export async function sendConnectionAcceptedNotification(
  targetUserId: string,
  accepterName: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "Connection Accepted!",
    body: `${accepterName} accepted your connection request`,
    data: { type: "connection_accepted" },
    badge: badgeCount,
  });
}

/**
 * Send push notification for date proposed
 */
export async function sendDateProposedNotification(
  targetUserId: string,
  proposerName: string,
  wishTitle: string,
  wishId: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "Date Proposed!",
    body: `${proposerName} proposed a date for: "${wishTitle}"`,
    data: { type: "date_proposed", wishId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for date confirmed
 */
export async function sendDateConfirmedNotification(
  targetUserId: string,
  confirmerName: string,
  wishTitle: string,
  wishId: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "Date Confirmed!",
    body: `${confirmerName} confirmed the date for: "${wishTitle}"`,
    data: { type: "date_confirmed", wishId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for wish fulfilled
 */
export async function sendWishFulfilledNotification(
  targetUserId: string,
  fulfillerName: string,
  wishTitle: string,
  rating: number,
  wishId: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "Wish Fulfilled!",
    body: `${fulfillerName} rated "${wishTitle}" with ${rating} magic wands!`,
    data: { type: "wish_fulfilled", wishId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for wish edited
 */
export async function sendWishEditedNotification(
  targetUserId: string,
  editorName: string,
  wishTitle: string,
  wishId: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "Wish Updated",
    body: `${editorName} updated the wish: "${wishTitle}"`,
    data: { type: "wish_edited", wishId },
    badge: badgeCount,
  });
}

/**
 * Send push notification for wish deleted
 */
export async function sendWishDeletedNotification(
  targetUserId: string,
  deleterName: string,
  wishTitle: string
): Promise<void> {
  const badgeCount = await getUnreadCountForUser(targetUserId);

  await sendPushNotification(targetUserId, {
    title: "Wish Deleted",
    body: `${deleterName} deleted the wish: "${wishTitle}"`,
    data: { type: "wish_deleted" },
    badge: badgeCount,
  });
}

/**
 * Add notification response listener (for handling tap on notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Add notification received listener (for handling notification while app is open)
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Get current push token
 */
export function getCurrentPushToken(): string | null {
  return currentPushToken;
}

/**
 * Debug function: Get ALL push tokens from the database
 * This helps diagnose if tokens are being saved correctly
 */
export async function debugGetAllPushTokens(): Promise<{ user_id: string; token: string; platform: string }[]> {

  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  }

  try {
    const result = await supabaseDb.select<{ user_id: string; token: string; platform: string }[]>("push_tokens", {
      limit: 100,
    });


    if (result.error) {
      return [];
    }

    return result.data || [];
  } catch (error) {
    return [];
  }
}

export default {
  registerForPushNotifications,
  savePushTokenToSupabase,
  removePushTokenFromSupabase,
  sendPushNotification,
  sendWishReceivedNotification,
  sendWishAcceptedNotification,
  sendMessageNotification,
  sendConnectionRequestNotification,
  sendConnectionAcceptedNotification,
  sendDateProposedNotification,
  sendDateConfirmedNotification,
  sendWishFulfilledNotification,
  sendWishEditedNotification,
  sendWishDeletedNotification,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  getCurrentPushToken,
  debugGetAllPushTokens,
};
