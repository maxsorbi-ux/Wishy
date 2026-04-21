import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import RootNavigator from "./src/navigation/RootNavigator";
import { Toast } from "./src/components/Toast";
import DevAccountSwitcher from "./src/components/DevAccountSwitcher";
import { useToastStore } from "./src/state/toastStore";
import useUserStore from "./src/state/userStore";
import useConnectionStore from "./src/state/connectionStore";
import useWishStore from "./src/state/wishStore";
import useNotificationStore from "./src/state/notificationStore";
import {
  registerForPushNotifications,
  savePushTokenToSupabase,
  addNotificationResponseListener,
  addNotificationReceivedListener,
  debugGetAllPushTokens,
} from "./src/api/pushNotifications";

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project.
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

export default function App() {
  const { visible, message, type, hideToast } = useToastStore();
  const currentUser = useUserStore((s) => s.currentUser);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const restoreSession = useUserStore((s) => s.restoreSession);
  const syncConnections = useConnectionStore((s) => s.syncConnections);
  const syncChats = useConnectionStore((s) => s.syncChats);
  const syncWishes = useWishStore((s) => s.syncWishes);
  const syncNotifications = useNotificationStore((s) => s.syncNotifications);

  const notificationListener = useRef<Notifications.Subscription>(null);
  const responseListener = useRef<Notifications.Subscription>(null);

  // Restore session and sync data on app start
  useEffect(() => {
    const initializeApp = async () => {
      console.log("=== APP INITIALIZING ===");
      await restoreSession();
      console.log("Session restored, isLoggedIn:", useUserStore.getState().isLoggedIn);

      // After session restore, sync data if logged in
      const state = useUserStore.getState();
      if (state.isLoggedIn && state.currentUser) {
        console.log("User logged in, syncing data for:", state.currentUser.name);
        await syncConnections();
        await syncChats();
        await syncWishes();
        await syncNotifications();
        // Fetch all users for search functionality
        console.log("Fetching all users from Supabase...");
        await useUserStore.getState().fetchAllUsers();
        console.log("=== APP INITIALIZATION COMPLETE ===");
      } else {
        console.log("=== APP INITIALIZATION COMPLETE (not logged in) ===");
      }
    };
    initializeApp();
  }, []);

  // Sync connections, chats, wishes and notifications when user is logged in
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      // Sync all data from Supabase
      syncConnections();
      syncChats();
      syncWishes();
      syncNotifications();
    }
  }, [isLoggedIn, currentUser?.id]);

  // Register for push notifications when user logs in
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      console.log("=== REGISTERING PUSH NOTIFICATIONS ===");
      console.log("User:", currentUser.name, "ID:", currentUser.id);

      registerForPushNotifications()
        .then((token) => {
          if (token) {
            console.log("Got push token, saving to Supabase...");
            savePushTokenToSupabase(currentUser.id, token);

            // Debug: Show all tokens in the database after a short delay
            setTimeout(() => {
              console.log("=== DEBUG: Checking all tokens in database ===");
              debugGetAllPushTokens();
            }, 2000);
          }
        })
        .catch((error) => {
          console.log("Failed to register push notifications:", error);
          // Continue app initialization even if push notifications fail
        });
    }
  }, [isLoggedIn, currentUser?.id]);

  // Set up notification listeners
  useEffect(() => {
    // Handle notification received while app is in foreground
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification);
      const data = notification.request.content.data as Record<string, unknown>;

      // Sync wishes and notifications when receiving wish-related notifications
      if (data?.type === "wish_accepted" || data?.type === "wish_received" ||
          data?.type === "date_proposed" || data?.type === "wish_fulfilled" ||
          data?.type === "date_changed" || data?.type === "date_confirmed") {
        console.log("Wish notification received, syncing wishes and notifications...");
        syncWishes();
        syncNotifications();
      }

      // Sync notifications for all notification types
      syncNotifications();
    });

    // Handle notification tap (user tapped on notification)
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      console.log("Notification tapped:", data);
      // Navigation will be handled by the navigation container
      // Also sync wishes and notifications when user taps on a notification
      syncWishes();
      syncNotifications();
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [syncWishes, syncNotifications]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <View style={{ flex: 1 }}>
            <RootNavigator />
            <Toast
              visible={visible}
              message={message}
              type={type}
              onHide={hideToast}
            />
            {/* DevAccountSwitcher temporarily disabled for push notification testing */}
            {/* <DevAccountSwitcher /> */}
          </View>
          <StatusBar style="dark" />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
