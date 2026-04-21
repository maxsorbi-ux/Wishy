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
  console.log("=== PUSH NOTIFICATION REGISTRATION START ===");
  console.log("Device.isDevice:", Device.isDevice);
  console.log("Device.modelName:", Device.modelName);
  console.log("Platform:", Platform.OS);

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log("Existing permission status:", existingStatus);
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== "granted") {
      console.log("Requesting push notification permissions...");
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log("New permission status:", finalStatus);
    }

    if (finalStatus !== "granted") {
      console.log("Push notification permissions not granted. Final status:", finalStatus);
      return null;
    }

    console.log("Permissions granted. Getting Expo push token...");

    // Get Expo push token - need to pass projectId for standalone builds
    // The projectId is read dynamically from Constants.expoConfig.extra.eas.projectId
    const projectId = getProjectId();
    console.log("Using projectId from config:", projectId);
    let tokenData;

    // First, try to get the native device token (this should always work on iOS)
    // Add timeout because this can hang indefinitely if APNs is not properly configured
    let devicePushToken: string | null = null;
    try {
      console.log("Getting native device push token first...");
      console.log("(This may take up to 15 seconds - if it hangs, APNs key may be misconfigured)");

      const deviceTokenPromise = Notifications.getDevicePushTokenAsync();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT: Device token request timed out after 15 seconds. This usually means APNs credentials are not properly configured in Expo/EAS.")), 15000)
      );

      const deviceTokenResult = await Promise.race([deviceTokenPromise, timeoutPromise]);
      devicePushToken = deviceTokenResult.data as string;
      console.log("Native device token obtained:", devicePushToken?.substring(0, 20) + "...");
    } catch (deviceError) {
      console.log("Failed to get device token:", deviceError);
      console.log("=== IMPORTANT ===");
      console.log("If you see TIMEOUT, check:");
      console.log("1. APNs Push Key is uploaded to Expo Dashboard -> Credentials");
      console.log("2. Bundle ID matches between app.json and Apple Developer Portal");
      console.log("3. Push Notifications capability is enabled for your App ID");
      console.log("=================");
    }

    // Now try to get Expo push token
    try {
      console.log("Attempting to get Expo push token with projectId:", projectId);
      if (!projectId) {
        console.log("WARNING: No projectId found in config. Check app.json extra.eas.projectId");
      }
      const tokenOptions: Notifications.ExpoPushTokenOptions = {
        devicePushToken: devicePushToken ? { data: devicePushToken, type: "ios" } : undefined,
      };
      if (projectId) {
        tokenOptions.projectId = projectId;
      }
      tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
      console.log("Got Expo token with projectId:", projectId ? "yes" : "no");
    } catch (tokenError) {
      console.log("Failed to get Expo token with projectId:", tokenError);

      // Try without projectId
      try {
        console.log("Trying without projectId...");
        tokenData = await Notifications.getExpoPushTokenAsync({
          devicePushToken: devicePushToken ? { data: devicePushToken, type: "ios" } : undefined,
        });
        console.log("Got Expo token without projectId");
      } catch (fallbackError) {
        console.log("Failed to get Expo token:", fallbackError);

        if (!tokenData) {
          console.log("ERROR: Could not get Expo push token");
          return null;
        }
      }
    }

    if (!tokenData) {
      console.log("ERROR: No token data available");
      return null;
    }

    currentPushToken = tokenData.data;
    console.log("=== PUSH TOKEN OBTAINED SUCCESSFULLY ===");
    console.log("Push token:", currentPushToken);

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
    console.log("Error registering for push notifications:", error);
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
  console.log("=== SAVE PUSH TOKEN TO SUPABASE ===");
  console.log("User ID:", userId);
  console.log("Token:", token);
  console.log("Token length:", token?.length || 0);

  if (!userId || !token) {
    console.log("ERROR: Missing userId or token");
    console.log("=== SAVE PUSH TOKEN ABORTED ===");
    return;
  }

  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
    console.log("Session set for Supabase operations");
  } else {
    console.log("WARNING: No session available - this might cause permission issues");
  }

  try {
    // Use the transfer_push_token function to handle device ownership transfer
    // This function safely transfers token ownership when a user logs in on a device
    console.log("Transferring push token ownership to current user...");
    
    const transferResult = await supabaseDb.rpc<null>("transfer_push_token", {
      p_token: token,
      p_user_id: userId,
      p_platform: Platform.OS,
    });

    if (transferResult.error) {
      console.log("!!! ERROR transferring push token:", transferResult.error.message);
      console.log("Error details:", JSON.stringify(transferResult.error));
      
      // Fallback: Try the old method (delete + upsert)
      console.log("Fallback: Trying delete + upsert method...");
      
      // Step 1: Try to delete the token (might fail due to RLS, that's okay)
      const deleteResult = await supabaseDb.delete("push_tokens", { token: token });
      if (deleteResult.error) {
        console.log("Note: Delete operation had an error (may be expected):", deleteResult.error.message);
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
          console.log("Token exists, trying update...");
          const updateResult = await supabaseDb.update(
            "push_tokens",
            { user_id: userId, platform: Platform.OS, updated_at: new Date().toISOString() },
            { token: token }
          );
          if (updateResult.error) {
            console.log("!!! ERROR updating push token:", updateResult.error.message);
            console.log("This may be due to RLS policies. Token may need to be manually transferred.");
          } else {
            console.log("*** SUCCESS: Push token updated for user:", userId);
          }
        } else {
          console.log("!!! ERROR: Failed to save push token after all attempts");
        }
      } else {
        console.log("*** SUCCESS: Push token inserted for user:", userId);
      }
    } else {
      console.log("*** SUCCESS: Push token transferred to user:", userId);
    }

    // Step 3: Verify the token was saved
    console.log("Step 3: Verifying token was saved...");
    const verifyResult = await supabaseDb.select<{ token: string; user_id: string }[]>("push_tokens", {
      filter: { user_id: userId },
    });
    console.log("Verify result:", JSON.stringify(verifyResult));

    if (verifyResult.data && verifyResult.data.length > 0) {
      console.log("*** VERIFIED: User now has", verifyResult.data.length, "push token(s)");
    } else {
      console.log("!!! WARNING: Verification failed - no tokens found for user after save");
    }

    console.log("=== SAVE PUSH TOKEN COMPLETE ===");
  } catch (error) {
    console.log("!!! EXCEPTION saving push token:", error);
    console.log("Error details:", JSON.stringify(error));
    console.log("=== SAVE PUSH TOKEN FAILED ===");
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
    console.log("Error removing push token:", error);
  }
}

/**
 * Get push tokens for a specific user
 */
export async function getUserPushTokens(userId: string): Promise<string[]> {
  console.log("=== GET USER PUSH TOKENS ===");
  console.log("Looking for tokens for user ID:", userId);

  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
    console.log("Session restored for token lookup");
  } else {
    console.log("WARNING: No session available for token lookup");
  }

  try {
    const result = await supabaseDb.select<{ token: string; user_id: string; platform: string }[]>("push_tokens", {
      filter: { user_id: userId },
    });

    console.log("Query result:", JSON.stringify(result));

    if (result.error) {
      console.log("ERROR fetching push tokens:", result.error.message);
      return [];
    }

    const tokens = result.data?.map((t) => t.token) || [];
    console.log("Found", tokens.length, "tokens for user");
    tokens.forEach((t, i) => console.log(`Token ${i + 1}:`, t));

    return tokens;
  } catch (error) {
    console.log("Error getting push tokens:", error);
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
  console.log("=== SEND PUSH NOTIFICATION START ===");
  console.log("Target user ID:", targetUserId);
  console.log("Notification title:", notification.title);
  console.log("Notification body:", notification.body);
  console.log("Notification data:", JSON.stringify(notification.data));

  // Validate targetUserId
  if (!targetUserId || targetUserId.trim() === "") {
    console.log("ERROR: Target user ID is empty or invalid");
    console.log("=== SEND PUSH NOTIFICATION ABORTED (invalid target) ===");
    return;
  }

  try {
    console.log("Fetching push tokens for user:", targetUserId);
    const tokens = await getUserPushTokens(targetUserId);
    console.log("Found", tokens.length, "push tokens for user");

    if (tokens.length === 0) {
      console.log("!!! NO PUSH TOKENS FOUND for user:", targetUserId);
      console.log("This means either:");
      console.log("  1. The user has never opened the app on a physical device");
      console.log("  2. The user denied push notification permissions");
      console.log("  3. The push token was not saved to Supabase correctly");
      console.log("=== SEND PUSH NOTIFICATION ABORTED (no tokens) ===");

      // Debug: Check all tokens in database
      await debugGetAllPushTokens();
      return;
    }

    console.log("Push tokens found:", tokens);
    const notifResult = await supabaseDb.select<{ id: string; is_read: boolean }[]>("notifications", {
      filter: { user_id: targetUserId, is_read: false },
    });
    // Get badge count - use provided value or query from database
    let badgeCount = notifResult?.data?.length ;

    if (badgeCount === undefined) {
      console.log("No badge count provided, fetching from database...");
      const session = useUserStore.getState().supabaseSession;
      if (session) {
        setSession(session);
      }

      badgeCount = 1; // Default to 1 if we can't get the count
      try {
       

        if (!notifResult.error && notifResult.data) {
          badgeCount = notifResult.data.length - 1;
          console.log("Current unread count from DB:", badgeCount);
        }
      } catch (error) {
        console.log("Could not fetch unread count, using default badge:", error);
      }
    } else {
      console.log("Using provided badge count:", badgeCount);
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

    console.log("Sending to Expo Push API...");
    console.log("Request payload:", JSON.stringify(messages, null, 2));

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

    console.log("Expo Push API response status:", response.status);
    const result = await response.json();
    console.log("=== EXPO PUSH API RESPONSE ===");
    console.log("Full response:", JSON.stringify(result, null, 2));

    // Check for errors in the response and handle invalid tokens
    if (result.data) {
      const invalidTokens: string[] = [];
      
      result.data.forEach((item: { status: string; message?: string; details?: { error?: string; expoPushToken?: string } }, index: number) => {
        if (item.status === "error") {
          console.log("!!! ERROR for token", index, ":");
          console.log("  Message:", item.message);
          console.log("  Error code:", item.details?.error);

          // Handle specific error cases
          if (item.details?.error === "DeviceNotRegistered" || item.details?.error === "InvalidCredentials") {
            console.log("  -> This device/token is invalid. Token should be removed.");
            // Extract the token that failed
            const failedToken = tokens[index];
            if (failedToken) {
              invalidTokens.push(failedToken);
            }
          } else if (item.details?.error === "MessageTooBig") {
            console.log("  -> Notification payload is too large. Consider reducing message size.");
          } else if (item.details?.error === "MessageRateExceeded") {
            console.log("  -> Rate limit exceeded. Please slow down notification sending.");
          }
        } else {
          console.log("*** SUCCESS for token", index, "- Notification sent!");
        }
      });

      // Remove invalid tokens from database
      if (invalidTokens.length > 0) {
        console.log(`Removing ${invalidTokens.length} invalid token(s) from database...`);
        // Restore session for database operations
        const session = useUserStore.getState().supabaseSession;
        if (session) {
          setSession(session);
        }
        
        for (const invalidToken of invalidTokens) {
          try {
            const deleteResult = await supabaseDb.delete("push_tokens", { token: invalidToken });
            if (deleteResult.error) {
              console.log(`Failed to remove invalid token: ${deleteResult.error.message}`);
            } else {
              console.log(`Removed invalid token: ${invalidToken.substring(0, 20)}...`);
            }
          } catch (error) {
            console.log(`Error removing invalid token: ${error}`);
          }
        }
      }
    } else {
      console.log("WARNING: No data array in response");
    }

    console.log("=== SEND PUSH NOTIFICATION COMPLETE ===");
  } catch (error) {
    console.log("!!! EXCEPTION sending push notification:", error);
    console.log("Error details:", JSON.stringify(error));
    console.log("=== SEND PUSH NOTIFICATION FAILED ===");
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
    console.log("Error getting unread count:", error);
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
  console.log("=== DEBUG: GET ALL PUSH TOKENS ===");

  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  }

  try {
    const result = await supabaseDb.select<{ user_id: string; token: string; platform: string }[]>("push_tokens", {
      limit: 100,
    });

    console.log("All tokens in database:", JSON.stringify(result.data, null, 2));

    if (result.error) {
      console.log("ERROR:", result.error.message);
      return [];
    }

    return result.data || [];
  } catch (error) {
    console.log("Error getting all push tokens:", error);
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
