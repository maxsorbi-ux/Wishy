import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import useWishStore from "../state/wishStore";
import useUserStore from "../state/userStore";
import useConnectionStore from "../state/connectionStore";
import { Wish, WishCategory, CATEGORY_LABELS, User } from "../types/wishy";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type DirectionFilter = "all" | "sent" | "received";
type StatusFilter = "all" | "fulfilled" | "pending";
type RoleFilter = "all" | "wisher" | "wished";

const CATEGORIES: (WishCategory | "all")[] = [
  "all", "dining", "travel", "experience", "gift",
  "entertainment", "wellness", "adventure", "romantic",
];

const BRAND = "#8B2252";

function getStatusConfig(status: string) {
  switch (status) {
    case "fulfilled":
      return { label: "Fulfilled", color: "#15803d", bg: "#dcfce7", icon: "checkmark-circle" };
    case "accepted":
      return { label: "Accepted", color: "#1d4ed8", bg: "#dbeafe", icon: "thumbs-up" };
    case "date_set":
      return { label: "Date Set", color: "#7c3aed", bg: "#ede9fe", icon: "calendar" };
    case "confirmed":
      return { label: "Confirmed", color: "#0369a1", bg: "#e0f2fe", icon: "checkmark-done" };
    case "rejected":
      return { label: "Declined", color: "#dc2626", bg: "#fee2e2", icon: "close-circle" };
    case "sent":
      return { label: "Sent", color: BRAND, bg: "#FFE5F1", icon: "paper-plane" };
    default:
      return { label: "Created", color: "#6B7280", bg: "#f3f4f6", icon: "create-outline" };
  }
}

export default function DiscoveryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const syncWishes = useWishStore((s) => s.syncWishes);
  const wishes = useWishStore((s) => s.wishes);
  const hiddenWishes = useWishStore((s) => s.hiddenWishes);
  const currentUser = useUserStore((s) => s.currentUser);
  const allUsers = useUserStore((s) => s.allUsers);
  const syncConnections = useConnectionStore((s) => s.syncConnections);
  const connections = useConnectionStore((s) => s.connections);
  const getAcceptedConnections = useConnectionStore((s) => s.getAcceptedConnections);

  const [selectedCategory, setSelectedCategory] = useState<WishCategory | "all">("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = currentUser?.id || "";

  const connectedUsers = useMemo(() => {
    if (!userId) return [];
    const myConnections = getAcceptedConnections(userId);
    const connectedIds = myConnections.map((c) =>
      c.senderId === userId ? c.receiverId : c.senderId
    );
    return allUsers.filter((u) => connectedIds.includes(u.id));
  }, [userId, connections, allUsers, getAcceptedConnections]);

  const stageWishes = useMemo(() => {
    if (!userId) return [];

    const myWishes = wishes.filter(
      (w) => w.creatorId === userId && !hiddenWishes.includes(w.id)
    );

    const myConnections = getAcceptedConnections(userId);
    const connectionWishMap = new Map<string, Wish>();

    myConnections.forEach((conn) => {
      const connectedUserId =
        conn.senderId === userId ? conn.receiverId : conn.senderId;
      const connectedUser = allUsers.find((u) => u.id === connectedUserId);
      if (!connectedUser) return;

      const isRelationship = conn.type === "relationship";

      wishes
        .filter((w) => w.creatorId === connectedUserId && !hiddenWishes.includes(w.id))
        .forEach((wish) => {
          const privacy =
            wish.creatorRole === "wisher"
              ? connectedUser.privacySettings?.wishPortfolio || "public"
              : connectedUser.privacySettings?.wishList || "public";

          const hasAccess =
            privacy === "public" ||
            privacy === "friends" ||
            (privacy === "relationship" && isRelationship);

          if (hasAccess) connectionWishMap.set(wish.id, wish);
        });
    });

    const receivedWishes = wishes.filter((w) => {
      const targeted =
        w.targetUserId === userId ||
        (w.targetUserIds && w.targetUserIds.includes(userId));
      return targeted && w.creatorId !== userId && !hiddenWishes.includes(w.id);
    });

    const merged = new Map<string, Wish>();
    [...myWishes, ...Array.from(connectionWishMap.values()), ...receivedWishes].forEach(
      (w) => merged.set(w.id, w)
    );

    return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [wishes, hiddenWishes, userId, connections, allUsers, getAcceptedConnections]);

  const filteredWishes = useMemo(() => {
    let result = stageWishes;

    if (selectedCategory !== "all") {
      result = result.filter((w) => w.category === selectedCategory);
    }

    if (directionFilter === "sent") {
      result = result.filter(
        (w) =>
          w.creatorId === userId &&
          ((w.targetUserIds && w.targetUserIds.length > 0) || !!w.targetUserId)
      );
    } else if (directionFilter === "received") {
      result = result.filter((w) => {
        const targeted =
          w.targetUserId === userId ||
          (w.targetUserIds && w.targetUserIds.includes(userId));
        return targeted && w.creatorId !== userId;
      });
    }

    if (statusFilter === "fulfilled") {
      result = result.filter((w) => w.status === "fulfilled");
    } else if (statusFilter === "pending") {
      result = result.filter(
        (w) => w.status !== "fulfilled" && w.status !== "rejected" && w.status !== "deleted"
      );
    }

    if (roleFilter === "wisher") {
      result = result.filter((w) => w.creatorRole === "wisher");
    } else if (roleFilter === "wished") {
      result = result.filter((w) => w.creatorRole === "wished");
    }

    if (selectedContactIds.length > 0) {
      result = result.filter((w) => selectedContactIds.includes(w.creatorId));
    }

    return result;
  }, [stageWishes, selectedCategory, directionFilter, statusFilter, roleFilter, selectedContactIds, userId]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (directionFilter !== "all") n++;
    if (statusFilter !== "all") n++;
    if (roleFilter !== "all") n++;
    if (selectedContactIds.length > 0) n++;
    return n;
  }, [directionFilter, statusFilter, roleFilter, selectedContactIds]);

  useFocusEffect(
    useCallback(() => {
      syncWishes();
      syncConnections();
    }, [syncWishes, syncConnections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([syncWishes(), syncConnections()]);
    setRefreshing(false);
  }, [syncWishes, syncConnections]);

  const handleWishPress = (wishId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("WishDetail", { wishId });
  };

  const handleUserPress = (uid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("UserProfile", { userId: uid });
  };

  const resetFilters = () => {
    setDirectionFilter("all");
    setStatusFilter("all");
    setRoleFilter("all");
    setSelectedContactIds([]);
  };

  return (
    <View className="flex-1 bg-wishy-white">
      {/* Header */}
      <View style={{ paddingTop:insets.top }} className="bg-wishy-white border-b border-wishy-paleBlush">
        <View className="flex-row items-center px-4 py-3">
          <View className="flex-1">
            <Text className="text-wishy-gray text-xs">
              {filteredWishes.length} {filteredWishes.length === 1 ? "wish" : "wishes"} accessible
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowFilterModal(true);
            }}
            style={
              activeFilterCount > 0
                ? { backgroundColor: BRAND }
                : { backgroundColor: "white", borderWidth: 1, borderColor: "#FFE5F1" }
            }
            className="flex-row items-center px-3 py-2 rounded-full"
          >
            <Ionicons
              name="options-outline"
              size={15}
              color={activeFilterCount > 0 ? "#fff" : BRAND}
            />
            <Text
              style={{ color: activeFilterCount > 0 ? "#fff" : BRAND }}
              className="text-sm font-medium ml-1"
            >
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : "Filter"}
            </Text>
          </Pressable>
        </View>

        {/* Category filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-11"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}
        >
          {CATEGORIES.map((category) => (
            <Pressable
              key={category}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCategory(category);
              }}
              className={cn(
                "px-4 py-1.5 rounded-full",
                selectedCategory === category
                  ? "bg-wishy-black"
                  : "bg-white border border-wishy-paleBlush"
              )}
            >
              <Text
                className={cn(
                  "text-sm font-medium",
                  selectedCategory === category ? "text-wishy-white" : "text-wishy-black"
                )}
              >
                {category === "all" ? "All" : CATEGORY_LABELS[category]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="max-h-10 border-b border-wishy-paleBlush bg-wishy-white"
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 6, gap: 6, alignItems: "center" }}
        >
          {directionFilter !== "all" && (
            <ActiveChip
              label={directionFilter === "sent" ? "Sent" : "Received"}
              onRemove={() => setDirectionFilter("all")}
            />
          )}
          {statusFilter !== "all" && (
            <ActiveChip
              label={statusFilter === "fulfilled" ? "Fulfilled" : "To Be Fulfilled"}
              onRemove={() => setStatusFilter("all")}
            />
          )}
          {roleFilter !== "all" && (
            <ActiveChip
              label={roleFilter === "wisher" ? "From Wisher" : "From Wished"}
              onRemove={() => setRoleFilter("all")}
            />
          )}
          {selectedContactIds.length > 0 && (
            <ActiveChip
              label={
                selectedContactIds.length === 1
                  ? allUsers.find((u) => u.id === selectedContactIds[0])?.name || "1 contact"
                  : `${selectedContactIds.length} contacts`
              }
              onRemove={() => setSelectedContactIds([])}
            />
          )}
          <Pressable
            onPress={() => {
              resetFilters();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            className="px-2 py-1"
          >
            <Text style={{ color: BRAND }} className="text-xs font-medium">Clear all</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Wish Feed */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={BRAND} />
        }
      >
        {filteredWishes.length === 0 ? (
          <EmptyState hasFilters={activeFilterCount > 0} />
        ) : (
          filteredWishes.map((wish, index) => {
            const creator = allUsers.find((u) => u.id === wish.creatorId);
            return (
              <Animated.View
                key={wish.id}
                entering={FadeInDown.delay(Math.min(index * 60, 300)).duration(400)}
              >
                <WishCard
                  wish={wish}
                  creator={creator}
                  currentUserId={userId}
                  allUsers={allUsers}
                  onPress={() => handleWishPress(wish.id)}
                  onUserPress={() => creator && handleUserPress(creator.id)}
                />
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        directionFilter={directionFilter}
        statusFilter={statusFilter}
        roleFilter={roleFilter}
        selectedContactIds={selectedContactIds}
        allUsers={allUsers}
        onDirectionChange={setDirectionFilter}
        onStatusChange={setStatusFilter}
        onRoleChange={setRoleFilter}
        onReset={resetFilters}
        onOpenContactPicker={() => {
          setShowFilterModal(false);
          setShowContactPicker(true);
        }}
      />

      <ContactPickerModal
        visible={showContactPicker}
        onClose={() => {
          setShowContactPicker(false);
          setShowFilterModal(true);
        }}
        connectedUsers={connectedUsers}
        selectedIds={selectedContactIds}
        onApply={(ids) => {
          setSelectedContactIds(ids);
          setShowContactPicker(false);
          setShowFilterModal(true);
        }}
      />
    </View>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <View className="flex-row items-center bg-wishy-paleBlush rounded-full px-3 py-1">
      <Text className="text-wishy-black text-xs font-medium mr-1">{label}</Text>
      <Pressable onPress={onRemove} hitSlop={6}>
        <Ionicons name="close" size={12} color="#6B7280" />
      </Pressable>
    </View>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <View className="flex-1 items-center justify-center py-20">
      <View className="w-20 h-20 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
        <Ionicons name="sparkles-outline" size={40} color={BRAND} />
      </View>
      <Text className="text-wishy-black font-semibold text-lg">
        {hasFilters ? "No Wishes Match" : "The Stage Is Empty"}
      </Text>
      <Text className="text-wishy-gray mt-2 text-center px-8 text-sm leading-5">
        {hasFilters
          ? "Try adjusting your filters to see more wishes"
          : "Connect with others to see their wishes appear here"}
      </Text>
    </View>
  );
}

function WishCard({
  wish,
  creator,
  currentUserId,
  allUsers,
  onPress,
  onUserPress,
}: {
  wish: Wish;
  creator?: User;
  currentUserId: string;
  allUsers: User[];
  onPress: () => void;
  onUserPress: () => void;
}) {
  const isMyWish = wish.creatorId === currentUserId;
  const isSentByMe =
    isMyWish &&
    ((wish.targetUserIds && wish.targetUserIds.length > 0) || !!wish.targetUserId);
  const isReceivedByMe =
    !isMyWish &&
    (wish.targetUserId === currentUserId ||
      (wish.targetUserIds && wish.targetUserIds.includes(currentUserId)));

  const recipientNames = useMemo(() => {
    if (!isSentByMe) return [];
    const ids = wish.targetUserIds || (wish.targetUserId ? [wish.targetUserId] : []);
    return ids
      .slice(0, 2)
      .map((id) => allUsers.find((u) => u.id === id)?.name || "Someone");
  }, [isSentByMe, wish.targetUserIds, wish.targetUserId, allUsers]);

  const extraRecipients =
    wish.targetUserIds && wish.targetUserIds.length > 2
      ? wish.targetUserIds.length - 2
      : 0;

  const sourceLabel = isMyWish
    ? wish.creatorRole === "wisher"
      ? "My Portfolio"
      : "My Wish List"
    : null;

  const statusConfig = getStatusConfig(wish.status);

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl overflow-hidden shadow-sm active:opacity-95"
    >
      {wish.image && (
        <Image
          source={{ uri: wish.image }}
          style={{ width: "100%", height: 180 }}
          contentFit="cover"
        />
      )}
      <View className="p-4">
        {/* Creator row + status */}
        <View className="flex-row items-center justify-between mb-3">
          <Pressable onPress={onUserPress} className="flex-row items-center flex-1 mr-2">
            {creator?.profilePhoto ? (
              <Image
                source={{ uri: creator.profilePhoto }}
                style={{ width: 30, height: 30 }}
                className="rounded-full mr-2"
              />
            ) : (
              <View className="w-8 h-8 rounded-full bg-wishy-paleBlush items-center justify-center mr-2">
                <Ionicons name="person" size={15} color={BRAND} />
              </View>
            )}
            <View className="flex-1">
              <Text className="text-wishy-black font-semibold text-sm" numberOfLines={1}>
                {isMyWish ? "You" : creator?.name || "Unknown"}
              </Text>
              {sourceLabel ? (
                <Text className="text-wishy-gray text-xs">{sourceLabel}</Text>
              ) : null}
            </View>
          </Pressable>

          <View
            style={{ backgroundColor: statusConfig.bg }}
            className="flex-row items-center px-2 py-1 rounded-full"
          >
            <Ionicons name={statusConfig.icon as "home"} size={10} color={statusConfig.color} />
            <Text style={{ color: statusConfig.color }} className="text-xs ml-1 font-medium">
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Category + role badges */}
        <View className="flex-row gap-2 mb-2">
          <View className="bg-wishy-paleBlush px-2 py-0.5 rounded-full">
            <Text className="text-wishy-black text-xs font-medium">
              {CATEGORY_LABELS[wish.category]}
            </Text>
          </View>
          <View
            style={{ backgroundColor: wish.creatorRole === "wisher" ? "#FFE5F1" : "#FFF0E6" }}
            className="px-2 py-0.5 rounded-full"
          >
            <Text
              style={{ color: wish.creatorRole === "wisher" ? BRAND : "#B45309" }}
              className="text-xs font-medium"
            >
              {wish.creatorRole === "wisher" ? "Wisher" : "Wished"}
            </Text>
          </View>
        </View>

        {/* Title + description */}
        <Text className="text-wishy-black font-semibold text-base mt-1">{wish.title}</Text>
        <Text className="text-wishy-gray text-sm mt-1 leading-5" numberOfLines={2}>
          {wish.description}
        </Text>

        {/* Direction indicators */}
        {isSentByMe && recipientNames.length > 0 && (
          <View className="flex-row items-center mt-3 bg-wishy-paleBlush rounded-xl px-3 py-2">
            <Ionicons name="arrow-forward-outline" size={12} color={BRAND} />
            <Text className="text-wishy-gray text-xs ml-1 flex-1" numberOfLines={1}>
              {"Sent to "}
              {recipientNames.join(", ")}
              {extraRecipients > 0 ? ` +${extraRecipients} more` : ""}
            </Text>
          </View>
        )}
        {isReceivedByMe && creator && (
          <View className="flex-row items-center mt-3 bg-wishy-paleBlush rounded-xl px-3 py-2">
            <Ionicons name="arrow-down-outline" size={12} color={BRAND} />
            <Text className="text-wishy-gray text-xs ml-1">
              {"Received from "}{creator.name}
            </Text>
          </View>
        )}

        {/* Location */}
        {wish.location && (
          <View className="flex-row items-center mt-2">
            <Ionicons name="location-outline" size={12} color="#9A8A8A" />
            <Text className="text-wishy-gray text-xs ml-1">{wish.location}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  directionFilter: DirectionFilter;
  statusFilter: StatusFilter;
  roleFilter: RoleFilter;
  selectedContactIds: string[];
  allUsers: User[];
  onDirectionChange: (v: DirectionFilter) => void;
  onStatusChange: (v: StatusFilter) => void;
  onRoleChange: (v: RoleFilter) => void;
  onReset: () => void;
  onOpenContactPicker: () => void;
}

function FilterModal({
  visible,
  onClose,
  directionFilter,
  statusFilter,
  roleFilter,
  selectedContactIds,
  allUsers,
  onDirectionChange,
  onStatusChange,
  onRoleChange,
  onReset,
  onOpenContactPicker,
}: FilterModalProps) {
  const insets = useSafeAreaInsets();

  const contactLabel = useMemo(() => {
    if (selectedContactIds.length === 0) return "All contacts";
    const names = selectedContactIds
      .slice(0, 2)
      .map((id) => allUsers.find((u) => u.id === id)?.name || "")
      .filter(Boolean)
      .join(", ");
    const extra = selectedContactIds.length > 2 ? ` +${selectedContactIds.length - 2}` : "";
    return names + extra;
  }, [selectedContactIds, allUsers]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: "white",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: insets.bottom + 20,
          }}
        >
          <View style={{ width: 40, height: 4, backgroundColor: "#FFE5F1", borderRadius: 2, alignSelf: "center", marginBottom: 20 }} />

          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-wishy-black font-bold text-xl">Filters</Text>
            <Pressable onPress={onReset}>
              <Text style={{ color: BRAND }} className="text-sm font-medium">Reset all</Text>
            </Pressable>
          </View>

          <FilterSection title="Direction">
            <FilterGroup
              options={[
                { value: "all", label: "All" },
                { value: "sent", label: "Sent" },
                { value: "received", label: "Received" },
              ]}
              value={directionFilter}
              onChange={(v) => onDirectionChange(v as DirectionFilter)}
            />
          </FilterSection>

          <FilterSection title="Status">
            <FilterGroup
              options={[
                { value: "all", label: "All" },
                { value: "pending", label: "To Be Fulfilled" },
                { value: "fulfilled", label: "Fulfilled" },
              ]}
              value={statusFilter}
              onChange={(v) => onStatusChange(v as StatusFilter)}
            />
          </FilterSection>

          <FilterSection title="Creator Role">
            <FilterGroup
              options={[
                { value: "all", label: "All" },
                { value: "wisher", label: "From Wisher" },
                { value: "wished", label: "From Wished" },
              ]}
              value={roleFilter}
              onChange={(v) => onRoleChange(v as RoleFilter)}
            />
          </FilterSection>

          <FilterSection title="Contact" last>
            <Pressable
              onPress={onOpenContactPicker}
              className="flex-row items-center justify-between bg-wishy-paleBlush rounded-xl px-4 py-3"
            >
              <View className="flex-row items-center flex-1 mr-2">
                <Ionicons name="people-outline" size={18} color={BRAND} />
                <Text className="text-wishy-darkGray text-sm ml-2 flex-1" numberOfLines={1}>
                  {contactLabel}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#6B7280" />
            </Pressable>
          </FilterSection>

          <Pressable
            onPress={onClose}
            style={{ backgroundColor: BRAND }}
            className="mt-6 py-4 rounded-2xl items-center"
          >
            <Text className="text-white font-semibold text-base">Apply Filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function FilterSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={{ marginBottom: last ? 0 : 20 }}>
      <Text className="text-wishy-gray text-xs font-semibold uppercase mb-3">{title}</Text>
      {children}
    </View>
  );
}

function FilterGroup({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => {
            onChange(opt.value);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          style={{ backgroundColor: value === opt.value ? BRAND : "#FFE5F1" }}
          className="px-4 py-2 rounded-full"
        >
          <Text
            style={{ color: value === opt.value ? "#fff" : BRAND }}
            className="text-sm font-medium"
          >
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

interface ContactPickerModalProps {
  visible: boolean;
  onClose: () => void;
  connectedUsers: User[];
  selectedIds: string[];
  onApply: (ids: string[]) => void;
}

function ContactPickerModal({
  visible,
  onClose,
  connectedUsers,
  selectedIds,
  onApply,
}: ContactPickerModalProps) {
  const insets = useSafeAreaInsets();
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds);
  const [search, setSearch] = useState("");

  React.useEffect(() => {
    if (visible) {
      setLocalSelected(selectedIds);
      setSearch("");
    }
  }, [visible]);

  const filtered = useMemo(
    () =>
      connectedUsers.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase())
      ),
    [connectedUsers, search]
  );

  const toggle = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLocalSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (localSelected.length === connectedUsers.length) {
      setLocalSelected([]);
    } else {
      setLocalSelected(connectedUsers.map((u) => u.id));
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: "white",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            maxHeight: "78%",
          }}
        >
          {/* Header */}
          <View className="px-6 pt-5 pb-4 border-b border-wishy-paleBlush">
            <View style={{ width: 40, height: 4, backgroundColor: "#FFE5F1", borderRadius: 2, alignSelf: "center", marginBottom: 16 }} />
            <View className="flex-row items-center justify-between mb-4">
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="arrow-back" size={22} color="#6B7280" />
              </Pressable>
              <Text className="text-wishy-black font-bold text-lg">Select Contacts</Text>
              <Pressable onPress={toggleAll}>
                <Text style={{ color: BRAND }} className="text-sm font-medium">
                  {localSelected.length === connectedUsers.length ? "None" : "All"}
                </Text>
              </Pressable>
            </View>
            <View className="flex-row items-center bg-wishy-paleBlush rounded-xl px-3 py-2">
              <Ionicons name="search" size={16} color="#6B7280" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search contacts..."
                placeholderTextColor="#6B7280"
                className="flex-1 ml-2 text-wishy-black text-sm"
                autoCapitalize="none"
                returnKeyType="search"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch("")} hitSlop={6}>
                  <Ionicons name="close-circle" size={16} color="#6B7280" />
                </Pressable>
              )}
            </View>
          </View>

          {/* List */}
          {connectedUsers.length === 0 ? (
            <View className="py-14 items-center">
              <Ionicons name="people-outline" size={44} color="#FFE5F1" />
              <Text className="text-wishy-gray text-sm mt-3">No connected users yet</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8 }}
              renderItem={({ item }) => {
                const isSelected = localSelected.includes(item.id);
                return (
                  <Pressable
                    onPress={() => toggle(item.id)}
                    className="flex-row items-center py-3 border-b border-wishy-paleBlush"
                  >
                    {item.profilePhoto ? (
                      <Image
                        source={{ uri: item.profilePhoto }}
                        style={{ width: 44, height: 44 }}
                        className="rounded-full"
                      />
                    ) : (
                      <View className="w-11 h-11 rounded-full bg-wishy-paleBlush items-center justify-center">
                        <Ionicons name="person" size={20} color={BRAND} />
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Text className="text-wishy-black font-medium text-sm">{item.name}</Text>
                      {item.location ? (
                        <Text className="text-wishy-gray text-xs">{item.location}</Text>
                      ) : null}
                    </View>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 2,
                        borderColor: isSelected ? BRAND : "#FFE5F1",
                        backgroundColor: isSelected ? BRAND : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          )}

          {/* Apply */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: insets.bottom + 12,
              borderTopWidth: 1,
              borderTopColor: "#FFE5F1",
            }}
          >
            <Pressable
              onPress={() => onApply(localSelected)}
              style={{ backgroundColor: BRAND }}
              className="py-4 rounded-2xl items-center"
            >
              <Text className="text-white font-semibold text-base">
                {localSelected.length === 0
                  ? "Show All Contacts"
                  : `Show ${localSelected.length} Contact${localSelected.length !== 1 ? "s" : ""}`}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
