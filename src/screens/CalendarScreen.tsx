import React, { useState, useMemo, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  parseISO,
} from "date-fns";
import useWishStore from "../state/wishStore";
import useUserStore from "../state/userStore";
import { Wish, WishStatus } from "../types/wishy";
import { cn } from "../utils/cn";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type ViewMode = "monthly" | "weekly";

function getWishDate(wish: Wish): Date | null {
  const dateStr = wish.proposal?.proposedDate;
  if (!dateStr) return null;
  try {
    const iso = parseISO(dateStr);
    if (!isNaN(iso.getTime())) return iso;
    const fallback = new Date(dateStr);
    return isNaN(fallback.getTime()) ? null : fallback;
  } catch {
    return null;
  }
}

const PROPOSED_STATUSES: WishStatus[] = ["accepted", "date_set", "confirmed", "fulfilled"];

export default function CalendarScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const currentUser = useUserStore((s) => s.currentUser);
  const wishes = useWishStore((s) => s.wishes);
  const syncWishes = useWishStore((s) => s.syncWishes);

  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const userId = currentUser?.id ?? "";
  console.log('aa', selectedDay)


  useFocusEffect(
    useCallback(() => {
      syncWishes();
    }, [])
  );

  const myWishes = useMemo(() => {
    return wishes.filter((w) => {
      if (w.id.startsWith("sample-")) return false;
      return (
        w.creatorId === userId ||
        w.targetUserId === userId ||
        (w.targetUserIds && w.targetUserIds.includes(userId))
      );
    });
  }, [wishes, userId]);

  const datedWishes = useMemo(
    () =>
      myWishes
        .filter((w) => PROPOSED_STATUSES.includes(w.status) && !!getWishDate(w))
        .sort((a, b) => getWishDate(a)!.getTime() - getWishDate(b)!.getTime()),
    [myWishes]
  );

  const undatedWishes = useMemo(
    () =>
      myWishes.filter(
        (w) => PROPOSED_STATUSES.includes(w.status) && !getWishDate(w)
      ),
    [myWishes]
  );

  const wishesForDay = (day: Date) =>
    datedWishes.filter((w) => isSameDay(getWishDate(w)!, day));

  const handleWishPress = (wish: Wish) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("WishDetail", { wishId: wish.id });
  };

  const navigatePrev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // setSelectedDay(null);
    setCurrentDate((d) =>
      viewMode === "monthly" ? subMonths(d, 1) : subWeeks(d, 1)
    );
  };

  const navigateNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDay(null);
    setCurrentDate((d) =>
      viewMode === "monthly" ? addMonths(d, 1) : addWeeks(d, 1)
    );
  };

  const headerLabel =
    viewMode === "monthly"
      ? format(currentDate, "MMMM yyyy")
      : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d")} – ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`;

  const renderWishCard = (wish: Wish) => {
    const date = getWishDate(wish);
    const hasDate = !!date;
    const fulfilled = wish.status === "fulfilled";

    return (
      <Pressable
        key={wish.id}
        onPress={() => handleWishPress(wish)}
        className={cn(
          "rounded-xl p-3 mb-2 border active:opacity-80",
          fulfilled
            ? "bg-gray-50 border-gray-200"
            : "bg-wishy-paleBlush/40 border-wishy-pink/50"
        )}
      >
        <View className="flex-row items-center">
          <Ionicons
            name={fulfilled ? "checkmark-circle" : "time-outline"}
            size={16}
            color={fulfilled ? "#9CA3AF" : "#8B2252"}
          />
          <Text
            className={cn(
              "flex-1 font-medium text-sm ml-2",
              fulfilled ? "text-gray-400 line-through" : "text-wishy-black"
            )}
            numberOfLines={1}
          >
            {wish.title}
          </Text>
          <Ionicons name="chevron-forward" size={14} color="#9A8A8A" />
        </View>
        <View className="flex-row items-center mt-1.5 ml-6 gap-2">
          <View
            className={cn(
              "flex-row items-center gap-1 rounded-full px-2 py-0.5",
              hasDate ? "bg-wishy-pink/20" : "bg-gray-100"
            )}
          >
            <Ionicons
              name={hasDate ? "calendar" : "calendar-outline"}
              size={11}
              color={hasDate ? "#8B2252" : "#9CA3AF"}
            />
            <Text
              className={cn(
                "text-xs font-medium",
                hasDate ? "text-wishy-black" : "text-gray-400"
              )}
            >
              {hasDate
                ? format(date, "MMM d, yyyy")
                : "No date set"}
            </Text>
          </View>
          {wish.proposal?.proposedTime && (
            <Text className="text-xs text-wishy-gray">
              {wish.proposal.proposedTime}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  const renderMonthly = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calStart, end: calEnd });
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
      <>
        <View className="flex-row mb-2">
          {dayLabels.map((d) => (
            <View key={d} className="flex-1 items-center py-1">
              <Text className="text-wishy-gray text-xs font-medium">{d}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {days.map((day) => {
            const dayWishCount = wishesForDay(day).length;
            const isToday = isSameDay(day, new Date());
            const inMonth = isSameMonth(day, currentDate);

            const isSelected = selectedDay && isSameDay(day, selectedDay);

            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedDay(day);
                }}
                style={{ width: "14.28%" }}
                className="items-center justify-center py-1 active:opacity-70"
              >
                <View
                  style={{ width: 36, height: 36 }}
                  className={cn(
                    "items-center justify-center rounded-full",
                    isSelected ? "bg-wishy-black" : isToday ? "bg-wishy-pink/30" : ""
                  )}
                >
                  <Text
                    className={cn(
                      "text-sm font-medium",
                      isSelected
                        ? "text-white"
                        : isToday
                        ? "text-wishy-black font-bold"
                        : inMonth
                        ? "text-wishy-black"
                        : "text-wishy-gray/40"
                    )}
                  >
                    {format(day, "d")}
                  </Text>
                </View>
                {dayWishCount > 0 && !isSelected && (
                  <View className="w-1.5 h-1.5 bg-wishy-pink rounded-full mt-0.5" />
                )}
              </Pressable>
            );
          })}
          
        </View>

        {selectedDay &&  (
          <Animated.View entering={FadeInDown.duration(250)} className="mt-6">
            <Text className="text-wishy-black font-semibold text-base mb-3">
              {format(selectedDay, "EEEE, MMMM d")}
            </Text>
            {wishesForDay(selectedDay).length > 0
              ? wishesForDay(selectedDay).map(renderWishCard)
              : <Text className="text-wishy-gray text-sm">{"No scheduled wishes for this day"}</Text>
            }
          </Animated.View>
        )}
      </>
    );
  };

  const renderWeekly = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <View className="gap-2">
        {days.map((day) => {
          const dayWishesList = wishesForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <View key={day.toISOString()}>
              <View
                className={cn(
                  "rounded-xl px-3 py-2 mb-1",
                  isToday ? "bg-wishy-pink/20" : "bg-wishy-paleBlush/20"
                )}
              >
                <Text
                  className={cn(
                    "font-semibold text-sm",
                    isToday ? "text-wishy-black" : "text-wishy-gray"
                  )}
                >
                  {format(day, "EEEE, MMM d")}
                  {isToday && " • Today"}
                </Text>
              </View>
              {dayWishesList.length > 0 && dayWishesList.map(renderWishCard)}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-wishy-white">
      <View
        style={{ paddingTop: insets.top + 16 }}
        className="bg-wishy-white border-b border-wishy-paleBlush px-6 pb-4"
      >
        <View className="flex-row items-center mb-4">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 items-center justify-center mr-3 active:opacity-70"
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </Pressable>
          <Text className="text-wishy-black font-bold text-xl flex-1">Calendar</Text>
        </View>

        <View className="flex-row bg-wishy-paleBlush/40 rounded-2xl p-1 mb-4">
          {(["monthly", "weekly"] as ViewMode[]).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setViewMode(mode);
              }}
              className={cn(
                "flex-1 py-2 rounded-xl items-center active:opacity-80",
                viewMode === mode ? "bg-white" : ""
              )}
            >
              <Text
                className={cn(
                  "font-medium text-sm capitalize",
                  viewMode === mode ? "text-wishy-black" : "text-wishy-gray"
                )}
              >
                {mode}
              </Text>
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <Pressable onPress={navigatePrev} className="w-9 h-9 items-center justify-center active:opacity-70">
            <Ionicons name="chevron-back" size={22} color="#8B2252" />
          </Pressable>
          <Text className="text-wishy-black font-semibold text-base">{headerLabel}</Text>
          <Pressable onPress={navigateNext} className="w-9 h-9 items-center justify-center active:opacity-70">
            <Ionicons name="chevron-forward" size={22} color="#8B2252" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === "monthly" ? renderMonthly() : renderWeekly()}


        {undatedWishes.length > 0 && (
          <>
            {selectedDay && <View className="h-px bg-wishy-paleBlush mt-6 mb-4" />}
            <Animated.View entering={FadeInDown.duration(300)} className={selectedDay ? "" : "mt-6"}>
              <Text className="text-wishy-black font-semibold text-base mb-3">{"Proposed - No Date Set"}</Text>
              {undatedWishes.map(renderWishCard)}
            </Animated.View>
          </>
        )}

        {myWishes.length === 0 && (
          <View className="items-center justify-center py-16">
            <View className="w-20 h-20 bg-wishy-paleBlush rounded-full items-center justify-center mb-4">
              <Ionicons name="calendar-outline" size={40} color="#8B2252" />
            </View>
            <Text className="text-wishy-black font-semibold text-lg">No wishes yet</Text>
            <Text className="text-wishy-gray text-center mt-2 px-8 text-sm">
              {"Your wishes will appear here once they are proposed."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
