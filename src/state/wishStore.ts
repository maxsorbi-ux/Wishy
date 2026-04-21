import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Wish, WishStatus } from "../types/wishy";
import { v4 as uuidv4 } from "uuid";
import { supabaseDb, supabaseStorage, setSession, getSession } from "../api/supabase";
import useUserStore from "./userStore";
import {
  sendWishReceivedNotification,
  sendWishAcceptedNotification,
  sendDateProposedNotification,
  sendDateConfirmedNotification,
  sendWishFulfilledNotification,
} from "../api/pushNotifications";

interface WishState {
  wishes: Wish[];
  myWishList: string[]; // IDs of wishes I want (as Wished)
  myPortfolio: string[]; // IDs of wishes I offer (as Wisher)
  hiddenWishes: string[]; // IDs of wishes hidden by recipients
  isSyncing: boolean;

  addWish: (wish: Omit<Wish, "id" | "createdAt" | "updatedAt">) => Promise<string>;
  updateWish: (id: string, updates: Partial<Wish>) => Promise<void>;
  deleteWish: (id: string) => Promise<void>;
  deleteWishAsCreator: (id: string) => Promise<void>;
  hideWishAsRecipient: (wishId: string, recipientId: string) => void;
  getWishById: (id: string) => Wish | undefined;
  getPublicWishes: () => Wish[];
  getWishesByUser: (userId: string) => Wish[];
  addToWishList: (wishId: string) => void;
  removeFromWishList: (wishId: string) => void;
  addToPortfolio: (wishId: string) => void;
  removeFromPortfolio: (wishId: string) => void;

  // Interaction model methods
  getMyWishesForMe: (userId: string) => Wish[];
  getMyWishesForOthers: (userId: string) => Wish[];
  getReceivedWishes: (userId: string) => Wish[];
  proposeDate: (wishId: string, proposal: { date?: string; time?: string; location?: string; message?: string; proposedBy: string }) => Promise<void>;
  confirmDate: (wishId: string, confirmedBy: string) => Promise<void>;
  acceptWish: (wishId: string) => Promise<void>;
  declineWish: (wishId: string) => Promise<void>;
  fulfillWish: (wishId: string, rating: number, praised: boolean, review: string, ratedBy: string) => Promise<void>;
  getUserAverageRating: (userId: string) => { average: number; praised: number; total: number };

  // Sync methods
  syncWishes: () => Promise<void>;
  fetchPublicWishes: () => Promise<void>;

  // Debug methods
  debugClearAllWishes: () => Promise<void>;
}

// Helper to restore Supabase session
const restoreSupabaseSession = () => {
  const session = useUserStore.getState().supabaseSession;
  if (session) {
    setSession(session);
  }
};

// Convert Supabase wish to local format
// IMPORTANT: We extract target_user_ids from the 'links' field
// Format in links: ["recipient:userId1", "recipient:userId2", ...actualLinks]
const supabaseToLocalWish = (dbWish: Record<string, unknown>, recipients?: string[]): Wish => {
  // Parse links to extract target_user_ids (stored as "recipient:userId")
  const rawLinks = (dbWish.links as string[]) || [];
  const targetUserIds: string[] = [];
  const actualLinks: string[] = [];

  rawLinks.forEach(link => {
    if (link.startsWith("recipient:")) {
      targetUserIds.push(link.replace("recipient:", ""));
    } else {
      actualLinks.push(link);
    }
  });

  // Fallback to passed recipients array if no recipients in links
  const finalTargetUserIds = targetUserIds.length > 0 ? targetUserIds : (recipients || []);

  return {
    id: dbWish.id as string,
    title: dbWish.title as string,
    description: (dbWish.description as string) || "",
    category: (dbWish.category as Wish["category"]) || "custom",
    tags: [],
    image: dbWish.image as string | undefined,
    links: actualLinks.length > 0 ? actualLinks : undefined,
    location: dbWish.proposed_location as string | undefined,
    isOnline: false,
    status: dbWish.status as WishStatus,
    creatorId: dbWish.creator_id as string,
    creatorRole: dbWish.creator_role as "wisher" | "wished",
    targetUserIds: finalTargetUserIds.length > 0 ? finalTargetUserIds : undefined,
    visibility: (dbWish.visibility as Wish["visibility"]) || "connections",
    createdAt: new Date(dbWish.created_at as string).getTime(),
    updatedAt: new Date(dbWish.updated_at as string).getTime(),
    rating: dbWish.fulfillment_rating as number | undefined,
    praised: dbWish.fulfillment_heart as boolean | undefined,
    review: dbWish.fulfillment_review as string | undefined,
    proposal: dbWish.proposed_date ? {
      proposedDate: dbWish.proposed_date as string,
      proposedTime: dbWish.proposed_time as string,
      proposedLocation: dbWish.proposed_location as string,
      proposedBy: dbWish.proposed_by as string | undefined,
      // If status is "confirmed", the date has been confirmed
      confirmedBy: dbWish.status === "confirmed" ? "confirmed" : undefined,
    } : undefined,
  };
};

// Convert local wish to Supabase format
// Store recipients in 'links' field as "recipient:userId" format
// Note: target_user_id column does not exist in Supabase, so we only use links
const localToSupabaseWish = (wish: Partial<Wish>): Record<string, unknown> => {
  const dbWish: Record<string, unknown> = {};

  console.log("localToSupabaseWish: Input wish targetUserIds:", wish.targetUserIds);
  console.log("localToSupabaseWish: Input wish targetUserId:", wish.targetUserId);
  console.log("localToSupabaseWish: Input wish links:", wish.links);

  if (wish.title !== undefined) dbWish.title = wish.title;
  if (wish.description !== undefined) dbWish.description = wish.description;
  if (wish.category !== undefined) dbWish.category = wish.category;
  if (wish.image !== undefined) dbWish.image = wish.image;

  // Store recipients in links field as "recipient:userId" format
  if (wish.targetUserIds !== undefined && wish.targetUserIds.length > 0) {
    const recipientLinks = wish.targetUserIds.map(id => `recipient:${id}`);
    const actualLinks = wish.links || [];
    dbWish.links = [...recipientLinks, ...actualLinks];
    console.log("localToSupabaseWish: Created links with recipients:", dbWish.links);
  } else if (wish.targetUserId !== undefined) {
    // Backward compatibility: single targetUserId
    const recipientLinks = [`recipient:${wish.targetUserId}`];
    const actualLinks = wish.links || [];
    dbWish.links = [...recipientLinks, ...actualLinks];
    console.log("localToSupabaseWish: Created links with single recipient:", dbWish.links);
  } else if (wish.links !== undefined) {
    dbWish.links = wish.links;
    console.log("localToSupabaseWish: Using original links (no recipients):", dbWish.links);
  }

  if (wish.status !== undefined) dbWish.status = wish.status;
  if (wish.creatorId !== undefined) dbWish.creator_id = wish.creatorId;
  if (wish.creatorRole !== undefined) dbWish.creator_role = wish.creatorRole;
  if (wish.visibility !== undefined) dbWish.visibility = wish.visibility;
  if (wish.proposal?.proposedDate !== undefined) dbWish.proposed_date = wish.proposal.proposedDate;
  if (wish.proposal?.proposedTime !== undefined) dbWish.proposed_time = wish.proposal.proposedTime;
  if (wish.proposal?.proposedLocation !== undefined) dbWish.proposed_location = wish.proposal.proposedLocation;
  if (wish.rating !== undefined) dbWish.fulfillment_rating = wish.rating;
  if (wish.praised !== undefined) dbWish.fulfillment_heart = wish.praised;
  if (wish.review !== undefined) dbWish.fulfillment_review = wish.review;

  return dbWish;
};

// Sample wishes for discovery (shown when no data from server)
const sampleWishes: Wish[] = [
  {
    id: "sample-1",
    title: "Romantic dinner at a rooftop restaurant",
    description: "A candlelit evening with city views, fine wine, and unforgettable cuisine.",
    category: "dining",
    tags: ["romantic", "fine dining", "city views"],
    image: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800",
    location: "New York",
    isOnline: false,
    status: "sent",
    creatorId: "sample-user-1",
    creatorRole: "wisher",
    visibility: "public",
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: "sample-2",
    title: "Weekend getaway to the mountains",
    description: "Escape to a cozy cabin, explore hiking trails, and reconnect with nature.",
    category: "travel",
    tags: ["nature", "adventure", "relaxation"],
    image: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800",
    location: "Colorado",
    isOnline: false,
    status: "sent",
    creatorId: "sample-user-2",
    creatorRole: "wisher",
    visibility: "public",
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 172800000,
  },
];

const useWishStore = create<WishState>()(
  persist(
    (set, get) => ({
      wishes: sampleWishes,
      myWishList: [],
      myPortfolio: [],
      hiddenWishes: [],
      isSyncing: false,

      addWish: async (wishData) => {
        const id = uuidv4();
        const now = Date.now();

        console.log("=== ADD WISH START ===");
        console.log("addWish: Creating wish with ID:", id);
        console.log("addWish: Title:", wishData.title);
        console.log("addWish: Creator ID:", wishData.creatorId);
        console.log("addWish: Target User IDs:", wishData.targetUserIds);
        console.log("addWish: Target User ID (single):", wishData.targetUserId);
        console.log("addWish: Image:", wishData.image?.substring(0, 50));

        // Upload image to Supabase Storage if it's a local file
        let imageUrl = wishData.image;
        if (wishData.image && (wishData.image.startsWith("file://") || wishData.image.startsWith("content://"))) {
          console.log("addWish: Uploading local image to Supabase Storage...");
          restoreSupabaseSession();

          const fileExtension = wishData.image.split(".").pop()?.toLowerCase() || "jpg";
          const fileName = `${id}_${Date.now()}.${fileExtension}`;
          const filePath = `wishes/${wishData.creatorId}/${fileName}`;

          const uploadResult = await supabaseStorage.uploadFromUri(
            "wish-images",
            filePath,
            wishData.image,
            fileExtension === "png" ? "image/png" : "image/jpeg"
          );

          if (uploadResult.data?.publicUrl) {
            imageUrl = uploadResult.data.publicUrl;
            console.log("addWish: Image uploaded successfully:", imageUrl);
          } else {
            console.log("addWish: Image upload failed:", uploadResult.error?.message);
            // Keep the local URI as fallback, but it won't work for other users
          }
        }

        const newWish: Wish = {
          ...wishData,
          id,
          image: imageUrl,
          createdAt: now,
          updatedAt: now,
        };

        // Add locally first for responsiveness
        set((state) => ({ wishes: [...state.wishes, newWish] }));

        // Sync to Supabase - localToSupabaseWish handles links with recipients
        restoreSupabaseSession();
        const dbWish = localToSupabaseWish(newWish);
        dbWish.id = id;
        dbWish.creator_id = wishData.creatorId;

        // Ensure links contain recipients (localToSupabaseWish should handle this, but double-check)
        if (wishData.targetUserIds && wishData.targetUserIds.length > 0) {
          const recipientLinks = wishData.targetUserIds.map(uid => `recipient:${uid}`);
          const existingLinks = (wishData.links || []).filter(l => l && l.trim().length > 0);
          dbWish.links = [...recipientLinks, ...existingLinks];
          console.log("addWish: Setting links with recipients:", dbWish.links);
        } else if (wishData.targetUserId) {
          const recipientLinks = [`recipient:${wishData.targetUserId}`];
          const existingLinks = (wishData.links || []).filter(l => l && l.trim().length > 0);
          dbWish.links = [...recipientLinks, ...existingLinks];
          console.log("addWish: Setting links with single recipient:", dbWish.links);
        }

        console.log("addWish: Inserting wish to Supabase with data:", JSON.stringify(dbWish, null, 2));
        const result = await supabaseDb.insert("wishes", dbWish);

        if (result.error) {
          console.log("addWish ERROR: Failed to sync wish to cloud:", result.error.message);
        } else {
          console.log("addWish: Wish saved to Supabase successfully");
        }

        // Send push notifications to recipients
        if (wishData.targetUserIds && wishData.targetUserIds.length > 0) {
          console.log("addWish: Sending push notifications to", wishData.targetUserIds.length, "recipients");
          const currentUser = useUserStore.getState().currentUser;
          if (currentUser) {
            wishData.targetUserIds.forEach((recipientId) => {
              console.log("addWish: Sending push notification to:", recipientId);
              sendWishReceivedNotification(
                recipientId,
                currentUser.name,
                wishData.title,
                id
              );
            });
          }
        } else {
          console.log("addWish: No recipients specified");
        }

        console.log("=== ADD WISH COMPLETE ===");
        return id;
      },

      updateWish: async (id, updates) => {
        // Upload image to Supabase Storage if it's a local file
        let processedUpdates = { ...updates };
        if (updates.image && (updates.image.startsWith("file://") || updates.image.startsWith("content://"))) {
          console.log("updateWish: Uploading local image to Supabase Storage...");
          restoreSupabaseSession();

          const currentUser = useUserStore.getState().currentUser;
          const fileExtension = updates.image.split(".").pop()?.toLowerCase() || "jpg";
          const fileName = `${id}_${Date.now()}.${fileExtension}`;
          const filePath = `wishes/${currentUser?.id || "unknown"}/${fileName}`;

          const uploadResult = await supabaseStorage.uploadFromUri(
            "wish-images",
            filePath,
            updates.image,
            fileExtension === "png" ? "image/png" : "image/jpeg"
          );

          if (uploadResult.data?.publicUrl) {
            processedUpdates.image = uploadResult.data.publicUrl;
            console.log("updateWish: Image uploaded successfully:", processedUpdates.image);
          } else {
            console.log("updateWish: Image upload failed:", uploadResult.error?.message);
          }
        }

        // Update locally first
        set((state) => ({
          wishes: state.wishes.map((wish) =>
            wish.id === id
              ? { ...wish, ...processedUpdates, updatedAt: Date.now() }
              : wish
          ),
        }));

        // Sync to Supabase
        restoreSupabaseSession();
        const dbUpdates = localToSupabaseWish(processedUpdates);
        if (Object.keys(dbUpdates).length > 0) {
          await supabaseDb.update("wishes", dbUpdates, { id });
        }
      },

      deleteWish: async (id) => {
        set((state) => ({
          wishes: state.wishes.filter((wish) => wish.id !== id),
          myWishList: state.myWishList.filter((wid) => wid !== id),
          myPortfolio: state.myPortfolio.filter((wid) => wid !== id),
        }));

        // Delete from Supabase
        restoreSupabaseSession();
        await supabaseDb.delete("wishes", { id });
      },

      deleteWishAsCreator: async (id) => {
        set((state) => ({
          wishes: state.wishes.filter((wish) => wish.id !== id),
          myWishList: state.myWishList.filter((wid) => wid !== id),
          myPortfolio: state.myPortfolio.filter((wid) => wid !== id),
          hiddenWishes: state.hiddenWishes.filter((wid) => wid !== id),
        }));

        restoreSupabaseSession();
        await supabaseDb.delete("wishes", { id });
      },

      hideWishAsRecipient: (wishId, recipientId) => {
        set((state) => {
          if (state.hiddenWishes.includes(wishId)) return state;
          return { hiddenWishes: [...state.hiddenWishes, wishId] };
        });
      },

      getWishById: (id) => {
        return get().wishes.find((wish) => wish.id === id);
      },

      getPublicWishes: () => {
        return get().wishes.filter((wish) => wish.visibility === "public");
      },

      getWishesByUser: (userId) => {
        return get().wishes.filter((wish) => wish.creatorId === userId);
      },

      addToWishList: (wishId) => {
        set((state) => {
          if (state.myWishList.includes(wishId)) return state;
          return { myWishList: [...state.myWishList, wishId] };
        });
      },

      removeFromWishList: (wishId) => {
        set((state) => ({
          myWishList: state.myWishList.filter((id) => id !== wishId),
        }));
      },

      addToPortfolio: (wishId) => {
        set((state) => {
          if (state.myPortfolio.includes(wishId)) return state;
          return { myPortfolio: [...state.myPortfolio, wishId] };
        });
      },

      removeFromPortfolio: (wishId) => {
        set((state) => ({
          myPortfolio: state.myPortfolio.filter((id) => id !== wishId),
        }));
      },

      getMyWishesForMe: (userId) => {
        const state = get();
        return state.wishes.filter((wish) => {
          return wish.creatorId === userId && wish.creatorRole === "wished";
        });
      },

      getMyWishesForOthers: (userId) => {
        const state = get();
        return state.wishes.filter((wish) => {
          return wish.creatorId === userId && wish.creatorRole === "wisher";
        });
      },

      getReceivedWishes: (userId) => {
        const state = get();
        return state.wishes.filter((wish) => {
          const isTargetedToMe =
            wish.targetUserId === userId ||
            (wish.targetUserIds && wish.targetUserIds.includes(userId));

          return (
            isTargetedToMe &&
            wish.creatorId !== userId &&
            !state.hiddenWishes.includes(wish.id)
          );
        });
      },

      proposeDate: async (wishId, proposal) => {
        const wish = get().wishes.find(w => w.id === wishId);

        set((state) => ({
          wishes: state.wishes.map((w) =>
            w.id === wishId
              ? {
                  ...w,
                  status: "date_set" as WishStatus,
                  proposal: {
                    proposedDate: proposal.date,
                    proposedTime: proposal.time,
                    proposedLocation: proposal.location,
                    proposalMessage: proposal.message,
                    proposedBy: proposal.proposedBy,
                    proposedAt: Date.now(),
                    // Reset confirmedBy when proposing a new date
                    confirmedBy: undefined,
                    confirmedAt: undefined,
                  },
                  updatedAt: Date.now(),
                }
              : w
          ),
        }));

        restoreSupabaseSession();

        // Convert local date/time strings to Supabase-compatible format
        // proposal.date could be in various locale formats like "18.12.2025" or "12/18/2025"
        // We need to store as text since the column type might be text, not date
        // Just store the original strings - they will be displayed as-is to users
        const updateResult = await supabaseDb.update("wishes", {
          status: "date_set",
          proposed_date: proposal.date || null,
          proposed_time: proposal.time || null,
          proposed_location: proposal.location || null,
          proposed_by: proposal.proposedBy || null,
        }, { id: wishId });

        if (updateResult.error) {
          console.log("proposeDate ERROR: Failed to update wish in Supabase:", updateResult.error.message);
          console.log("proposeDate: Date value was:", proposal.date);
          console.log("proposeDate: Time value was:", proposal.time);

          // Revert local state on error
          set((state) => ({
            wishes: state.wishes.map((w) =>
              w.id === wishId && wish
                ? { ...w, status: wish.status, proposal: wish.proposal, updatedAt: wish.updatedAt }
                : w
            ),
          }));
          return;
        } else {
          console.log("proposeDate: Wish updated successfully in Supabase");
        }

        // Send push notification to other party
        if (wish) {
          const currentUser = useUserStore.getState().currentUser;
          if (currentUser) {
            // Find the recipient - could be single targetUserId or from targetUserIds array
            let recipientIds: string[] = [];

            if (wish.creatorId === currentUser.id) {
              // I'm the creator, notify target users
              if (wish.targetUserIds && wish.targetUserIds.length > 0) {
                recipientIds = wish.targetUserIds;
              } else if (wish.targetUserId) {
                recipientIds = [wish.targetUserId];
              }
            } else {
              // I'm the recipient, notify the creator
              recipientIds = [wish.creatorId];
            }

            recipientIds.forEach((recipientId) => {
              if (recipientId && recipientId !== currentUser.id) {
                sendDateProposedNotification(
                  recipientId,
                  currentUser.name,
                  wish.title,
                  wishId
                );
              }
            });
          }
        }
      },

      confirmDate: async (wishId, confirmedBy) => {
        set((state) => ({
          wishes: state.wishes.map((wish) =>
            wish.id === wishId && wish.proposal
              ? {
                  ...wish,
                  status: "confirmed" as WishStatus,
                  proposal: {
                    ...wish.proposal,
                    confirmedBy,
                    confirmedAt: Date.now(),
                  },
                  updatedAt: Date.now(),
                }
              : wish
          ),
        }));

        restoreSupabaseSession();
        const wish = get().wishes.find(w => w.id === wishId);

        // Update status to confirmed and set the appropriate confirmation flag
        const updateData: Record<string, unknown> = { status: "confirmed" };
        if (wish?.creatorRole === "wisher") {
          updateData.date_confirmed_by_wisher = true;
        } else {
          updateData.date_confirmed_by_wished = true;
        }

        const updateResult = await supabaseDb.update("wishes", updateData, { id: wishId });

        if (updateResult.error) {
          console.log("confirmDate ERROR: Failed to update wish in Supabase:", updateResult.error.message);
        } else {
          console.log("confirmDate: Wish status updated to confirmed in Supabase");

          // Send push notification to the other party
          const currentUser = useUserStore.getState().currentUser;
          if (wish && currentUser) {
            // Determine who should receive the notification
            let recipientIds: string[] = [];

            if (wish.creatorId === currentUser.id) {
              // I'm the creator, notify target users
              if (wish.targetUserIds && wish.targetUserIds.length > 0) {
                recipientIds = wish.targetUserIds;
              } else if (wish.targetUserId) {
                recipientIds = [wish.targetUserId];
              }
            } else {
              // I'm a recipient, notify the creator
              recipientIds = [wish.creatorId];
            }

            console.log("confirmDate: Sending push notifications to:", recipientIds);
            recipientIds.forEach((recipientId) => {
              if (recipientId && recipientId !== currentUser.id) {
                console.log("confirmDate: Sending push notification to:", recipientId);
                sendDateConfirmedNotification(
                  recipientId,
                  currentUser.name,
                  wish.title,
                  wishId
                );
              }
            });
          }
        }
      },

      acceptWish: async (wishId) => {
        const wish = get().wishes.find(w => w.id === wishId);
        const currentUser = useUserStore.getState().currentUser;

        console.log("=== ACCEPT WISH START ===");
        console.log("acceptWish: Wish ID:", wishId);
        console.log("acceptWish: Wish title:", wish?.title);
        console.log("acceptWish: Wish status before:", wish?.status);
        console.log("acceptWish: Current user:", currentUser?.name);
        console.log("acceptWish: Current user ID:", currentUser?.id);
        console.log("acceptWish: Wish creator ID:", wish?.creatorId);

        if (!wish) {
          console.log("acceptWish ERROR: Wish not found");
          return;
        }

        // Update local state first
        set((state) => ({
          wishes: state.wishes.map((w) =>
            w.id === wishId
              ? { ...w, status: "accepted" as WishStatus, updatedAt: Date.now() }
              : w
          ),
        }));

        // Update in Supabase
        restoreSupabaseSession();
        console.log("acceptWish: Calling Supabase update...");
        const updateResult = await supabaseDb.update("wishes", { status: "accepted" }, { id: wishId });

        console.log("acceptWish: Supabase update result:", JSON.stringify(updateResult, null, 2));

        if (updateResult.error) {
          console.log("acceptWish ERROR: Failed to update wish in Supabase:", updateResult.error.message);
          // Revert local state on error
          set((state) => ({
            wishes: state.wishes.map((w) =>
              w.id === wishId
                ? { ...w, status: wish.status, updatedAt: wish.updatedAt }
                : w
            ),
          }));
          return;
        }

        // Check if update actually returned data (RLS might silently fail)
        if (!updateResult.data || (Array.isArray(updateResult.data) && updateResult.data.length === 0)) {
          console.log("acceptWish ERROR: Update returned empty data - likely RLS policy blocking update");
          console.log("acceptWish: This user might not have permission to update this wish");
          // Revert local state
          set((state) => ({
            wishes: state.wishes.map((w) =>
              w.id === wishId
                ? { ...w, status: wish.status, updatedAt: wish.updatedAt }
                : w
            ),
          }));
          return;
        }

        console.log("acceptWish: Wish status updated to accepted in Supabase");

        // Send push notification to wish creator (only if not self)
        if (currentUser && wish.creatorId !== currentUser.id) {
          console.log("acceptWish: Sending push notification to creator:", wish.creatorId);
          sendWishAcceptedNotification(
            wish.creatorId,
            currentUser.name,
            wish.title,
            wishId
          );
        }

        console.log("=== ACCEPT WISH COMPLETE ===");
      },

      declineWish: async (wishId) => {
        const wish = get().wishes.find(w => w.id === wishId);
        const currentUser = useUserStore.getState().currentUser;

        console.log("=== DECLINE WISH START ===");
        console.log("declineWish: Wish ID:", wishId);
        console.log("declineWish: Wish title:", wish?.title);
        console.log("declineWish: Current user:", currentUser?.name);

        if (!wish) {
          console.log("declineWish ERROR: Wish not found");
          return;
        }

        // Update local state first
        set((state) => ({
          wishes: state.wishes.map((w) =>
            w.id === wishId
              ? { ...w, status: "rejected" as WishStatus, updatedAt: Date.now() }
              : w
          ),
        }));

        // Update in Supabase
        restoreSupabaseSession();
        const updateResult = await supabaseDb.update("wishes", { status: "rejected" }, { id: wishId });

        if (updateResult.error) {
          console.log("declineWish ERROR: Failed to update wish in Supabase:", updateResult.error.message);
          // Revert local state on error
          set((state) => ({
            wishes: state.wishes.map((w) =>
              w.id === wishId
                ? { ...w, status: wish.status, updatedAt: wish.updatedAt }
                : w
            ),
          }));
          return;
        }

        console.log("declineWish: Wish status updated to rejected in Supabase");
        console.log("=== DECLINE WISH COMPLETE ===");
      },

      fulfillWish: async (wishId, rating, praised, review, ratedBy) => {
        const wish = get().wishes.find(w => w.id === wishId);
        const currentUser = useUserStore.getState().currentUser;

        console.log("=== FULFILL WISH START ===");
        console.log("fulfillWish: Wish ID:", wishId);
        console.log("fulfillWish: Wish title:", wish?.title);
        console.log("fulfillWish: Rating:", rating);
        console.log("fulfillWish: Current user:", currentUser?.name);

        if (!wish) {
          console.log("fulfillWish ERROR: Wish not found");
          return;
        }

        const previousStatus = wish.status;

        // Update local state first
        set((state) => ({
          wishes: state.wishes.map((w) =>
            w.id === wishId
              ? {
                  ...w,
                  status: "fulfilled" as WishStatus,
                  rating,
                  praised,
                  review,
                  ratedBy,
                  updatedAt: Date.now(),
                }
              : w
          ),
        }));

        // Update in Supabase
        restoreSupabaseSession();
        const updateResult = await supabaseDb.update("wishes", {
          status: "fulfilled",
          fulfillment_rating: rating,
          fulfillment_heart: praised,
          fulfillment_review: review,
        }, { id: wishId });

        if (updateResult.error) {
          console.log("fulfillWish ERROR: Failed to update wish in Supabase:", updateResult.error.message);
          // Revert local state on error
          set((state) => ({
            wishes: state.wishes.map((w) =>
              w.id === wishId
                ? { ...w, status: previousStatus, rating: wish.rating, praised: wish.praised, review: wish.review, updatedAt: wish.updatedAt }
                : w
            ),
          }));
          return;
        }

        console.log("fulfillWish: Wish status updated to fulfilled in Supabase");

        // Send push notification to the other party
        if (currentUser) {
          // Determine who should receive the notification
          // If I'm the creator (wisher), notify the target users
          // If I'm a recipient (wished), notify the creator
          let recipientIds: string[] = [];

          if (wish.creatorId === currentUser.id) {
            // I'm the creator, notify target users
            if (wish.targetUserIds && wish.targetUserIds.length > 0) {
              recipientIds = wish.targetUserIds;
            } else if (wish.targetUserId) {
              recipientIds = [wish.targetUserId];
            }
          } else {
            // I'm a recipient, notify the creator
            recipientIds = [wish.creatorId];
          }

          console.log("fulfillWish: Sending push notifications to:", recipientIds);
          recipientIds.forEach((recipientId) => {
            if (recipientId && recipientId !== currentUser.id) {
              console.log("fulfillWish: Sending push notification to:", recipientId);
              sendWishFulfilledNotification(
                recipientId,
                currentUser.name,
                wish.title,
                rating,
                wishId
              );
            }
          });
        }

        console.log("=== FULFILL WISH COMPLETE ===");
      },

      getUserAverageRating: (userId) => {
        const state = get();
        const completedWishes = state.wishes.filter(
          (wish) =>
            wish.status === "fulfilled" &&
            wish.rating !== undefined &&
            (
              (wish.creatorRole === "wisher" && wish.creatorId === userId) ||
              (wish.creatorRole === "wished" && wish.targetUserId === userId)
            )
        );

        if (completedWishes.length === 0) {
          return { average: 0, praised: 0, total: 0 };
        }

        const totalRating = completedWishes.reduce((sum, wish) => sum + (wish.rating || 0), 0);
        const praisedCount = completedWishes.filter((wish) => wish.praised).length;

        return {
          average: totalRating / completedWishes.length,
          praised: praisedCount,
          total: completedWishes.length,
        };
      },

      syncWishes: async () => {
        const currentUser = useUserStore.getState().currentUser;
        if (!currentUser) {
          console.log("syncWishes: No current user, skipping sync");
          return;
        }

        console.log("=== SYNC WISHES START ===");
        console.log("syncWishes: Current user ID:", currentUser.id);
        console.log("syncWishes: Current user name:", currentUser.name);
        console.log("syncWishes: Current user email:", currentUser.email);

        set({ isSyncing: true });
        restoreSupabaseSession();

        try {
          // Fetch wishes created by me
          console.log("syncWishes: Fetching wishes created by me...");
          const myWishesResult = await supabaseDb.select<Record<string, unknown>[]>("wishes", {
            filter: { creator_id: currentUser.id },
          });
          console.log("syncWishes: My wishes count:", myWishesResult.data?.length || 0);
          if (myWishesResult.data && myWishesResult.data.length > 0) {
            console.log("syncWishes: My wishes details:");
            myWishesResult.data.forEach(w => {
              const links = (w.links as string[]) || [];
              const recipients = links.filter(l => l.startsWith("recipient:")).map(l => l.replace("recipient:", ""));
              console.log(`  - ${w.title} (${w.id})`);
              console.log(`    Recipients in links: ${recipients.join(", ") || "None"}`);
            });
          }

          // Fetch wishes where I am a recipient using links array contains
          const recipientTag = `recipient:${currentUser.id}`;
          console.log("syncWishes: Fetching wishes where I am recipient via links:", recipientTag);
          const receivedViaLinksResult = await supabaseDb.select<Record<string, unknown>[]>("wishes", {
            rawParams: {
              "links": `cs.{"${recipientTag}"}`,
            },
            limit: 1000,
          });
          console.log("syncWishes: Received wishes via links array count:", receivedViaLinksResult.data?.length || 0);
          if (receivedViaLinksResult.error) {
            console.log("syncWishes: Error fetching received wishes:", receivedViaLinksResult.error.message);
          }

          // Filter out wishes created by myself
          const receivedWishes = (receivedViaLinksResult.data || []).filter(w => {
            return w.creator_id !== currentUser.id;
          });

          console.log("syncWishes: Received wishes after filtering self:", receivedWishes.length);
          if (receivedWishes.length > 0) {
            console.log("syncWishes: Received wishes details:");
            receivedWishes.forEach(w => {
              const links = (w.links as string[]) || [];
              const allRecipients = links.filter(l => l.startsWith("recipient:")).map(l => l.replace("recipient:", ""));
              console.log(`  - ${w.title} (${w.id}) from ${w.creator_id}`);
              console.log(`    Recipients in links: ${allRecipients.join(", ")}`);
              console.log(`    Status: ${w.status}`);
            });
          } else {
            console.log("syncWishes: No wishes found where I am a recipient");
          }

          // Combine and convert (removing duplicates)
          const myWishes = myWishesResult.data || [];
          const allDbWishes = [...myWishes, ...receivedWishes];
          // Remove duplicates by ID
          const uniqueWishes = Array.from(new Map(allDbWishes.map(w => [w.id, w])).values());

          console.log("syncWishes: Total unique wishes from Supabase:", uniqueWishes.length);
          const cloudWishes = uniqueWishes.map(w => supabaseToLocalWish(w));

          // Log the final state
          console.log("syncWishes: Final cloud wishes breakdown:");
          console.log(`  - Created by me: ${cloudWishes.filter(w => w.creatorId === currentUser.id).length}`);
          console.log(`  - Received by me: ${cloudWishes.filter(w => w.targetUserIds?.includes(currentUser.id) && w.creatorId !== currentUser.id).length}`);

          // IMPORTANT: Only keep sample wishes, replace everything else with cloud data
          // Supabase is the source of truth - no local wishes should persist
          set((state) => {
            const sampleWishes = state.wishes.filter(w => w.id.startsWith("sample-"));
            console.log("syncWishes: Sample wishes:", sampleWishes.length);
            console.log("syncWishes: Cloud wishes:", cloudWishes.length);
            return {
              wishes: [...sampleWishes, ...cloudWishes],
              isSyncing: false,
            };
          });
          console.log("=== SYNC WISHES COMPLETE ===");
        } catch (error) {
          console.log("Sync error:", error);
          set({ isSyncing: false });
        }
      },

      fetchPublicWishes: async () => {
        restoreSupabaseSession();

        const result = await supabaseDb.select<Record<string, unknown>[]>("wishes", {
          filter: { visibility: "public" },
          limit: 50,
        });

        if (result.data) {
          const publicWishes = result.data.map(w => supabaseToLocalWish(w));

          set((state) => {
            // Keep sample wishes and add cloud public wishes
            const samples = state.wishes.filter(w => w.id.startsWith("sample-"));
            const myWishes = state.wishes.filter(w => {
              const currentUser = useUserStore.getState().currentUser;
              return currentUser && w.creatorId === currentUser.id;
            });
            const newPublicWishes = publicWishes.filter(pw =>
              !samples.find(s => s.id === pw.id) &&
              !myWishes.find(m => m.id === pw.id)
            );
            return {
              wishes: [...samples, ...myWishes, ...newPublicWishes],
            };
          });
        }
      },

      // Debug: Clear all wishes from Supabase and local store
      debugClearAllWishes: async () => {
        const currentUser = useUserStore.getState().currentUser;
        if (!currentUser) {
          console.log("debugClearAllWishes: No current user");
          return;
        }

        console.log("=== DEBUG: CLEARING ALL WISHES ===");
        restoreSupabaseSession();

        try {
          // Fetch all wishes created by current user
          const myWishesResult = await supabaseDb.select<Record<string, unknown>[]>("wishes", {
            filter: { creator_id: currentUser.id },
          });

          const wishIds = myWishesResult.data?.map(w => w.id as string) || [];
          console.log("Found", wishIds.length, "wishes to delete");

          // Delete wish_recipients first (foreign key constraint)
          for (const wishId of wishIds) {
            console.log("Deleting recipients for wish:", wishId);
            await supabaseDb.delete("wish_recipients", { wish_id: wishId });
          }

          // Delete wishes
          for (const wishId of wishIds) {
            console.log("Deleting wish:", wishId);
            await supabaseDb.delete("wishes", { id: wishId });
          }

          // Clear local store (keep only sample wishes)
          set((state) => ({
            wishes: state.wishes.filter(w => w.id.startsWith("sample-")),
            myWishList: [],
            myPortfolio: [],
          }));

          console.log("=== DEBUG: ALL WISHES CLEARED ===");
        } catch (error) {
          console.log("debugClearAllWishes ERROR:", error);
        }
      },
    }),
    {
      name: "wishy-wishes-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // DO NOT persist wishes - Supabase is the source of truth
        // Only persist hiddenWishes (local preference)
        hiddenWishes: state.hiddenWishes,
      }),
    }
  )
);

export default useWishStore;
