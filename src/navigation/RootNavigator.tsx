import React from "react";
import { View, Text } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import useNotificationStore from "../state/notificationStore";
import useUserStore from "../state/userStore";

// Screens
import WelcomeScreen from "../screens/WelcomeScreen";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import RoleSelectionScreen from "../screens/RoleSelectionScreen";
import ProfileSetupScreen from "../screens/ProfileSetupScreen";
import LandingScreen from "../screens/LandingScreen";
import DiscoveryScreen from "../screens/DiscoveryScreen";
import MyWishesScreen from "../screens/MyWishesScreen";
import ConnectionsScreen from "../screens/ConnectionsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import CreateWishScreen from "../screens/CreateWishScreen";
import WishDetailScreen from "../screens/WishDetailScreen";
import ChatScreen from "../screens/ChatScreen";
import QRCodeScreen from "../screens/QRCodeScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import EditProfileScreen from "../screens/EditProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ManageConnectionScreen from "../screens/ManageConnectionScreen";
import PushDebugScreen from "../screens/PushDebugScreen";
import PrivacyScreen from "../screens/PrivacyScreen";
import CalendarScreen from "../screens/CalendarScreen";

// Types
export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  RoleSelection: undefined;
  ProfileSetup: undefined;
  Landing: undefined;
  MainTabs: { screen?: keyof MainTabsParamList } | undefined;
  CreateWish: { mode: "wishlist" | "portfolio"; editWishId?: string };
  WishDetail: { wishId: string };
  Chat: { wishId: string; chatId?: string };
  QRCode: undefined;
  UserProfile: { userId: string; userList?: string[]; userIndex?: number; animationDirection?: "forward" | "backward" };
  Notifications: undefined;
  EditProfile: undefined;
  Settings: undefined;
  ManageConnection: { userId: string };
  PushDebug: undefined;
  Privacy: undefined;
  Calendar: undefined;
  QRScanner: undefined;
};

export type MainTabsParamList = {
  Discovery: undefined;
  MyWishes: undefined;
  Connections: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabsParamList>();

// Component for Profile tab icon with notification badge
function ProfileTabIcon({ color, size }: { color: string; size: number }) {
  const currentUser = useUserStore((s) => s.currentUser);
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);

  const unreadCount = currentUser ? getUnreadCount(currentUser.id) : 0;

  return (
    <View>
      <Ionicons name="person" size={size} color={color} />
      {unreadCount > 0 && (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -10,
            backgroundColor: "#EF4444",
            borderRadius: 10,
            minWidth: 20,
            height: 20,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 4,
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: 11,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#FFE5F1",
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerTintColor: "#000000",
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerShadowVisible: false,
      }}
    >
      <Tab.Screen
        name="Discovery"
        component={DiscoveryScreen}
        options={{
          title: "Wishy Stage",
          headerTitle: "Wishy Stage",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyWishes"
        component={MyWishesScreen}
        options={{
          title: "My Wishes",
          headerTitle: "My Wishes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{
          title: "Connect",
          headerTitle: "Connections",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Profile",
          headerTitle: "My Profile",
          tabBarIcon: ({ color, size }) => (
            <ProfileTabIcon color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFFFFF" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="CreateWish"
        component={CreateWishScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="WishDetail"
        component={WishDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTintColor: "#000000",
        }}
      />
      <Stack.Screen
        name="QRCode"
        component={QRCodeScreen}
        options={{
          presentation: "modal",
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen
        name="UserProfile"
        component={UserProfileScreen}
        options={({ route }) => ({
          headerShown: false,
          animation: route.params?.animationDirection === "backward" ? "slide_from_left" : "slide_from_right",
        })}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ManageConnection"
        component={ManageConnectionScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PushDebug"
        component={PushDebugScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
