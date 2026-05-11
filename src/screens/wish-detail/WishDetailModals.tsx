import React from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Haptics from "expo-haptics";
import { Wish, User } from "../../types/wishy";
import { cn } from "../../utils/cn";

type ModalFn = (key: string) => void;
type ModalQuery = (key: string) => boolean;

interface WishDetailModalsProps {
  wish: Wish;
  isOwnWish: boolean;
  isVisible: ModalQuery;
  showModal: ModalFn;
  hideModal: ModalFn;
  toggle: ModalFn;
  proposedDate: Date;
  setProposedDate: (date: Date) => void;
  editDate: Date;
  setEditDate: (date: Date) => void;
  rating: number;
  setRating: (n: number) => void;
  praised: boolean;
  setPraised: (b: boolean) => void;
  review: string;
  setReview: (s: string) => void;
  proposalMessage: string;
  setProposalMessage: (s: string) => void;
  connectedUsers: User[];
  selectedUserIds: string[];
  setSelectedUserIds: (ids: string[]) => void;
  insets: { bottom: number };
  onConfirmDate: () => void;
  onSendToUsers: () => void;
  onUpdateDate: () => void;
  onConfirmDecline: () => void;
  onConfirmDelete: () => void;
  onConfirmFulfill: () => void;
}

export function WishDetailModals({
  wish,
  isOwnWish,
  isVisible,
  showModal,
  hideModal,
  toggle,
  proposedDate,
  setProposedDate,
  editDate,
  setEditDate,
  rating,
  setRating,
  praised,
  setPraised,
  review,
  setReview,
  proposalMessage,
  setProposalMessage,
  connectedUsers,
  selectedUserIds,
  setSelectedUserIds,
  insets,
  onConfirmDate,
  onSendToUsers,
  onUpdateDate,
  onConfirmDecline,
  onConfirmDelete,
  onConfirmFulfill,
}: WishDetailModalsProps) {
  return (
    <>
      {/* Date Proposal Modal */}
      <Modal
        visible={isVisible("date")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("date")}
      >
        <Pressable
          onPress={() => hideModal("date")}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-t-3xl p-6"
            >
              <View className="w-12 h-1 bg-wishy-paleBlush rounded-full self-center mb-6" />
              <Text className="text-wishy-black font-bold text-xl mb-2">
                Propose a Date & Time
              </Text>
              <Text className="text-wishy-gray mb-6">
                Suggest when you would like to fulfill this wish
              </Text>
              <View className="gap-3 mb-4">
                <Pressable
                  onPress={() => showModal("datePicker")}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {proposedDate.toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8B2252" />
                </Pressable>
                <Pressable
                  onPress={() => showModal("timePicker")}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {proposedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8B2252" />
                </Pressable>
              </View>
              <TextInput
                value={proposalMessage}
                onChangeText={setProposalMessage}
                placeholder="Add a message (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                className="bg-wishy-paleBlush/30 rounded-xl p-4 text-wishy-black mb-4 min-h-[80px]"
                style={{ textAlignVertical: "top" }}
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => hideModal("date")}
                  className="flex-1 py-4 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmDate}
                  className="flex-1 py-4 rounded-xl items-center bg-wishy-black active:opacity-90"
                >
                  <Text className="text-wishy-white font-semibold">Confirm</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Native date picker (rendered outside Modal to avoid nesting issues) */}
      {isVisible("datePicker") && (
        <DateTimePicker
          value={proposedDate}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            hideModal("datePicker");
            if (selectedDate && event.type === "set") {
              const newDate = new Date(selectedDate);
              newDate.setHours(proposedDate.getHours());
              newDate.setMinutes(proposedDate.getMinutes());
              setProposedDate(newDate);
            }
          }}
        />
      )}

      {/* Native time picker */}
      {isVisible("timePicker") && (
        <DateTimePicker
          value={proposedDate}
          mode="time"
          display="default"
          onChange={(event, selectedTime) => {
            hideModal("timePicker");
            if (selectedTime && event.type === "set") {
              const newDate = new Date(proposedDate);
              newDate.setHours(selectedTime.getHours());
              newDate.setMinutes(selectedTime.getMinutes());
              setProposedDate(newDate);
            }
          }}
        />
      )}

      {/* Decline Modal */}
      <Modal
        visible={isVisible("decline")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("decline")}
      >
        <Pressable
          onPress={() => hideModal("decline")}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-80"
            >
              <View className="items-center mb-4">
                <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                  <Ionicons name="close-circle" size={32} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2 text-center">
                  Decline Wish?
                </Text>
                <Text className="text-wishy-gray text-center">
                  Are you sure you want to decline this wish proposal?
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => hideModal("decline")}
                  className="flex-1 py-3 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmDecline}
                  className="flex-1 py-3 rounded-xl items-center bg-red-500 active:opacity-90"
                >
                  <Text className="text-white font-semibold">Decline</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Modal */}
      <Modal
        visible={isVisible("delete")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("delete")}
      >
        <Pressable
          onPress={() => hideModal("delete")}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-80"
            >
              <View className="items-center mb-4">
                <View className="w-16 h-16 bg-red-100 rounded-full items-center justify-center mb-3">
                  <Ionicons name="trash" size={32} color="#DC2626" />
                </View>
                <Text className="text-wishy-black font-bold text-xl mb-2 text-center">
                  {isOwnWish ? "Delete Wish?" : "Remove Wish?"}
                </Text>
                <Text className="text-wishy-gray text-center">
                  {isOwnWish
                    ? "This will permanently delete the wish for everyone. This action cannot be undone."
                    : "This will remove the wish from your list. The creator will be notified."}
                </Text>
              </View>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => hideModal("delete")}
                  className="flex-1 py-3 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmDelete}
                  className="flex-1 py-3 rounded-xl items-center bg-red-500 active:opacity-90"
                >
                  <Text className="text-white font-semibold">
                    {isOwnWish ? "Delete" : "Remove"}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Rating Modal */}
      <Modal
        visible={isVisible("rating")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("rating")}
      >
        <Pressable
          onPress={() => hideModal("rating")}
          className="flex-1 bg-black/50 justify-center items-center"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-3xl p-6 mx-6 w-[90%] max-w-md"
            >
              <View className="items-center mb-6">
                <View className="w-20 h-20 bg-wishy-pink rounded-full items-center justify-center mb-4">
                  <Ionicons name="sparkles" size={40} color="#8B2252" />
                </View>
                <Text className="text-wishy-black font-bold text-2xl mb-2 text-center">
                  {wish.status === "fulfilled" ? "Edit Rating" : "Rate This Wish"}
                </Text>
                <Text className="text-wishy-gray text-center text-sm">
                  How satisfied are you with this experience?
                </Text>
              </View>
              <View className="mb-6">
                <Text className="text-wishy-black font-semibold mb-3 text-center">
                  Magic Wands
                </Text>
                <View className="flex-row justify-center gap-3">
                  {[1, 2, 3, 4, 5].map((wand) => (
                    <Pressable
                      key={wand}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setRating(wand);
                      }}
                      className="items-center"
                    >
                      <Ionicons
                        name={rating >= wand ? "sparkles" : "sparkles-outline"}
                        size={36}
                        color={rating >= wand ? "#8B2252" : "#9A8A8A"}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text className="text-center text-wishy-gray text-sm mt-2">
                  {rating === 0 && "Tap to rate"}
                  {rating === 1 && "Poor"}
                  {rating === 2 && "Fair"}
                  {rating === 3 && "Good"}
                  {rating === 4 && "Very Good"}
                  {rating === 5 && "Excellent!"}
                </Text>
              </View>
              <View className="mb-6">
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setPraised(!praised);
                  }}
                  className={cn(
                    "flex-row items-center justify-center p-4 rounded-2xl border-2",
                    praised ? "bg-wishy-paleBlush border-wishy-pink" : "bg-gray-50 border-gray-300"
                  )}
                >
                  <Ionicons
                    name={praised ? "heart" : "heart-outline"}
                    size={28}
                    color={praised ? "#D4536B" : "#9A8A8A"}
                  />
                  <Text
                    className={cn(
                      "ml-3 font-semibold text-base",
                      praised ? "text-wishy-darkPink" : "text-wishy-gray"
                    )}
                  >
                    {praised ? "With Love ❤️" : "Add a Heart"}
                  </Text>
                </Pressable>
              </View>
              <View className="mb-6">
                <Text className="text-wishy-black font-semibold mb-2">Review (optional)</Text>
                <TextInput
                  value={review}
                  onChangeText={setReview}
                  placeholder="Share your thoughts about this experience..."
                  placeholderTextColor="#9A8A8A"
                  multiline
                  numberOfLines={4}
                  className="bg-wishy-paleBlush/30 p-4 rounded-xl text-wishy-black text-base min-h-[100px]"
                  style={{ textAlignVertical: "top" }}
                />
              </View>
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    hideModal("rating");
                    setRating(0);
                    setPraised(false);
                    setReview("");
                  }}
                  className="flex-1 py-3 rounded-xl items-center border-2 border-wishy-paleBlush active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onConfirmFulfill}
                  disabled={rating === 0}
                  className={cn(
                    "flex-1 py-3 rounded-xl items-center active:opacity-90",
                    rating === 0 ? "bg-gray-300" : "bg-wishy-black"
                  )}
                >
                  <Text className={cn("font-semibold", rating === 0 ? "text-gray-500" : "text-wishy-white")}>
                    Confirm
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Send To User Modal */}
      <Modal
        visible={isVisible("sendTo")}
        transparent
        animationType="slide"
        onRequestClose={() => {
          hideModal("sendTo");
          setSelectedUserIds([]);
        }}
      >
        <Pressable
          onPress={() => {
            hideModal("sendTo");
            setSelectedUserIds([]);
          }}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-t-3xl"
              style={{ paddingBottom: insets.bottom }}
            >
              <View className="p-4 border-b border-wishy-paleBlush">
                <View className="w-12 h-1 bg-wishy-paleBlush rounded-full self-center mb-4" />
                <Text className="text-wishy-black font-bold text-xl text-center">
                  {wish.creatorRole === "wisher" ? "Send Offer To" : "Send Request To"}
                </Text>
                <Text className="text-wishy-gray text-center mt-1 text-sm">
                  {selectedUserIds.length === 3
                    ? "Maximum 3 recipients reached"
                    : `Select up to 3 recipients (${selectedUserIds.length}/3)`}
                </Text>
              </View>
              {connectedUsers.length === 0 ? (
                <View className="p-6 items-center">
                  <View className="w-16 h-16 bg-wishy-paleBlush rounded-full items-center justify-center mb-3">
                    <Ionicons name="people-outline" size={32} color="#8B2252" />
                  </View>
                  <Text className="text-wishy-black font-semibold text-lg mb-2">
                    No Connected Users
                  </Text>
                  <Text className="text-wishy-gray text-center mb-4">
                    Connect with others first to send them wishes
                  </Text>
                  <Pressable
                    onPress={() => hideModal("sendTo")}
                    className="bg-wishy-black px-6 py-3 rounded-xl"
                  >
                    <Text className="text-wishy-white font-semibold">Close</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <ScrollView className="max-h-96">
                    {connectedUsers.map((user) => {
                      const isSelected = selectedUserIds.includes(user.id);
                      return (
                        <Pressable
                          key={user.id}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            if (isSelected) {
                              setSelectedUserIds(selectedUserIds.filter((id) => id !== user.id));
                            } else if (selectedUserIds.length < 3) {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            }
                          }}
                          className={cn(
                            "flex-row items-center p-4 border-b border-wishy-paleBlush active:bg-wishy-paleBlush/30",
                            isSelected && "bg-wishy-paleBlush/30"
                          )}
                        >
                          {user.profilePhoto ? (
                            <Image
                              source={{ uri: user.profilePhoto }}
                              style={{ width: 56, height: 56 }}
                              className="rounded-full mr-4"
                            />
                          ) : (
                            <View className="w-14 h-14 rounded-full bg-wishy-paleBlush items-center justify-center mr-4">
                              <Ionicons name="person" size={28} color="#4A1528" />
                            </View>
                          )}
                          <View className="flex-1">
                            <Text className="text-wishy-black font-semibold text-base">
                              {user.name}
                            </Text>
                            {user.bio && (
                              <Text className="text-wishy-gray text-sm mt-1" numberOfLines={2}>
                                {user.bio}
                              </Text>
                            )}
                            <Text className="text-wishy-darkPink text-xs mt-1 capitalize">
                              {user.role}
                            </Text>
                          </View>
                          {isSelected ? (
                            <Ionicons name="checkmark-circle" size={24} color="#4A1528" />
                          ) : (
                            <Ionicons name="chevron-forward" size={20} color="#9A8A8A" />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                  {selectedUserIds.length > 0 && (
                    <View className="p-4 border-t border-wishy-paleBlush">
                      <Pressable
                        onPress={onSendToUsers}
                        className="bg-wishy-black py-4 rounded-xl items-center"
                      >
                        <Text className="text-wishy-white font-semibold text-base">
                          Send to {selectedUserIds.length} {selectedUserIds.length === 1 ? "user" : "users"}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Date Modal */}
      <Modal
        visible={isVisible("editDate")}
        transparent
        animationType="fade"
        onRequestClose={() => hideModal("editDate")}
      >
        <Pressable
          onPress={() => hideModal("editDate")}
          className="flex-1 bg-black/50 justify-end"
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              className="bg-wishy-white rounded-t-3xl p-6"
            >
              <View className="w-12 h-1 bg-wishy-paleBlush rounded-full self-center mb-6" />
              <Text className="text-wishy-black font-bold text-xl mb-2">
                Edit Date & Time
              </Text>
              <Text className="text-wishy-gray mb-6">
                Change the date and time for this wish. The other person will be notified.
              </Text>
              <View className="gap-3 mb-4">
                <Pressable
                  onPress={() => {
                    toggle("editDatePicker");
                    hideModal("editTimePicker");
                  }}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="calendar-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {editDate.toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons
                    name={isVisible("editDatePicker") ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color="#8B2252"
                  />
                </Pressable>
                {isVisible("editDatePicker") && (
                  <View className="bg-white rounded-xl overflow-hidden">
                    <DateTimePicker
                      value={editDate}
                      mode="date"
                      display="spinner"
                      onChange={(_event, selectedDate) => {
                        if (selectedDate) {
                          const newDate = new Date(selectedDate);
                          newDate.setHours(editDate.getHours());
                          newDate.setMinutes(editDate.getMinutes());
                          setEditDate(newDate);
                        }
                      }}
                    />
                  </View>
                )}
                <Pressable
                  onPress={() => {
                    toggle("editTimePicker");
                    hideModal("editDatePicker");
                  }}
                  className="flex-row items-center justify-between p-4 bg-wishy-paleBlush/30 rounded-xl"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="time-outline" size={20} color="#8B2252" />
                    <Text className="text-wishy-black ml-3 font-medium">
                      {editDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  <Ionicons
                    name={isVisible("editTimePicker") ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color="#8B2252"
                  />
                </Pressable>
                {isVisible("editTimePicker") && (
                  <View className="bg-white rounded-xl overflow-hidden">
                    <DateTimePicker
                      value={editDate}
                      mode="time"
                      display="spinner"
                      onChange={(_event, selectedTime) => {
                        if (selectedTime) {
                          const newDate = new Date(editDate);
                          newDate.setHours(selectedTime.getHours());
                          newDate.setMinutes(selectedTime.getMinutes());
                          setEditDate(newDate);
                        }
                      }}
                    />
                  </View>
                )}
              </View>
              <TextInput
                value={proposalMessage}
                onChangeText={setProposalMessage}
                placeholder="Add a message about the change (optional)"
                placeholderTextColor="#9CA3AF"
                multiline
                className="bg-wishy-paleBlush/30 rounded-xl p-4 text-wishy-black mb-4 min-h-[80px]"
                style={{ textAlignVertical: "top" }}
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => hideModal("editDate")}
                  className="flex-1 py-4 rounded-xl items-center border border-wishy-pink active:opacity-80"
                >
                  <Text className="text-wishy-black font-semibold">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onUpdateDate}
                  className="flex-1 py-4 rounded-xl items-center bg-wishy-black active:opacity-90"
                >
                  <Text className="text-wishy-white font-semibold">Update</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
