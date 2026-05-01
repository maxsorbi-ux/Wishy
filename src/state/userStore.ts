import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { User, UserRole } from "../types/wishy";
import { supabaseAuth, supabaseDb, supabaseStorage, setSession, getSession } from "../api/supabase";

interface AuthState {
  // All registered users (cached locally)
  allUsers: User[];
  // Currently logged in user
  currentUser: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  supabaseSession: { access_token: string; refresh_token: string } | null;

  // Auth actions
  register: (email: string, password: string, name: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // User actions
  updateUser: (updates: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<void>;

  // Sync actions
  fetchUserProfile: (userId: string) => Promise<User | null>;
  fetchAllUsers: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

// Helper to convert Supabase profile to local User type
const profileToUser = (profile: Record<string, unknown>): User => {
  return {
    id: profile.id as string,
    email: profile.email as string,
    password: "", // Never stored locally from Supabase
    name: (profile.name as string) || "",
    nickname: profile.nickname as string | undefined,
    profilePhoto: profile.photo as string | undefined,
    bio: profile.bio as string | undefined,
    interests: (profile.interests as string[]) || [],
    location: profile.location as string | undefined,
    age: profile.age as number | undefined,
    gender: profile.gender as User["gender"],
    customGender: profile.custom_gender as string | undefined,
    relationshipPreference: profile.relationship_preference as User["relationshipPreference"],
    customRelationshipPreference: profile.custom_relationship_preference as string | undefined,
    role: (profile.role as UserRole) || "both",
    isElite: false,
    createdAt: new Date(profile.created_at as string).getTime(),
    photoGallery: (profile.gallery as string[]) || [],
    socialLinks: profile.social_links as User["socialLinks"],
    privacySettings: (profile.privacy_settings as User["privacySettings"]) || {
      email: "public",
      bio: "public",
      location: "public",
      age: "public",
      gender: "public",
      relationshipPreferences: "public",
      interests: "public",
      wishList: "public",
      wishPortfolio: "public",
      gallery: "public",
      calendar: "public",
    },
    searchPreferences: profile.search_preferences as User["searchPreferences"],
  };
};

// Helper to convert local User to Supabase profile format
const userToProfile = (user: Partial<User>): Record<string, unknown> => {
  const profile: Record<string, unknown> = {};

  if (user.name !== undefined) profile.name = user.name;
  if (user.role !== undefined) profile.role = user.role;
  if (user.gender !== undefined) profile.gender = user.gender;
  if (user.customGender !== undefined) profile.custom_gender = user.customGender;
  if (user.relationshipPreference !== undefined) profile.relationship_preference = user.relationshipPreference;
  if (user.customRelationshipPreference !== undefined) profile.custom_relationship_preference = user.customRelationshipPreference;
  if (user.profilePhoto !== undefined) profile.photo = user.profilePhoto;
  if (user.bio !== undefined) profile.bio = user.bio;
  if (user.location !== undefined) profile.location = user.location;
  if (user.age !== undefined) profile.age = user.age;
  if (user.interests !== undefined) profile.interests = user.interests;
  if (user.socialLinks !== undefined) profile.social_links = user.socialLinks;
  if (user.photoGallery !== undefined) profile.gallery = user.photoGallery;
  if (user.privacySettings !== undefined) profile.privacy_settings = user.privacySettings;
  if (user.searchPreferences !== undefined) profile.search_preferences = user.searchPreferences;

  return profile;
};

const useUserStore = create<AuthState>()(
  persist(
    (set, get) => ({
      allUsers: [],
      currentUser: null,
      isLoggedIn: false,
      isLoading: false,
      supabaseSession: null,

      register: async (email, password, name, role) => {
        set({ isLoading: true });

        try {
          // Register with Supabase Auth
          const authResult = await supabaseAuth.signUp(email, password);

          if (authResult.error) {
            set({ isLoading: false });
            return { success: false, error: authResult.error.message };
          }

          if (!authResult.data?.user) {
            set({ isLoading: false });
            return { success: false, error: "Registration failed" };
          }

          const userId = authResult.data.user.id;

          // Update profile with additional info
          await supabaseDb.update("profiles", {
            name,
            role,
            privacy_settings: {
              email: "public",
              bio: "public",
              location: "public",
              age: "public",
              gender: "public",
              relationshipPreferences: "public",
              interests: "public",
              wishList: "public",
              wishPortfolio: "public",
              gallery: "public",
              calendar: "public",
            },
          }, { id: userId });

          // Fetch the complete profile
          const profileResult = await supabaseDb.select<Record<string, unknown>[]>("profiles", {
            filter: { id: userId },
          });

          const profile = profileResult.data?.[0];

          if (profile) {
            const newUser = profileToUser(profile);

            set({
              currentUser: newUser,
              isLoggedIn: true,
              isLoading: false,
              supabaseSession: {
                access_token: authResult.data.access_token,
                refresh_token: authResult.data.refresh_token,
              },
              allUsers: [...get().allUsers.filter(u => u.id !== newUser.id), newUser],
            });

            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: "Failed to create profile" };
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: (error as Error).message };
        }
      },

      login: async (email, password) => {
        set({ isLoading: true });

        try {
          const authResult = await supabaseAuth.signIn(email, password);

          if (authResult.error) {
            set({ isLoading: false });
            return { success: false, error: authResult.error.message };
          }

          if (!authResult.data?.user) {
            set({ isLoading: false });
            return { success: false, error: "Login failed" };
          }

          const userId = authResult.data.user.id;

          // Fetch profile
          const profileResult = await supabaseDb.select<Record<string, unknown>[]>("profiles", {
            filter: { id: userId },
          });

          const profile = profileResult.data?.[0];

          if (profile) {
            const user = profileToUser(profile);

            set({
              currentUser: user,
              isLoggedIn: true,
              isLoading: false,
              supabaseSession: {
                access_token: authResult.data.access_token,
                refresh_token: authResult.data.refresh_token,
              },
              allUsers: [...get().allUsers.filter(u => u.id !== user.id), user],
            });

            return { success: true };
          }

          set({ isLoading: false });
          return { success: false, error: "Profile not found" };
        } catch (error) {
          set({ isLoading: false });
          return { success: false, error: (error as Error).message };
        }
      },

      logout: async () => {
        await supabaseAuth.signOut();
        set({
          currentUser: null,
          isLoggedIn: false,
          supabaseSession: null,
        });
      },

      updateUser: async (updates) => {
        const { currentUser, supabaseSession } = get();
        if (!currentUser) return;


        // Restore session for API calls
        if (supabaseSession) {
          setSession(supabaseSession);
        } else {
        }

        // Handle profile photo upload to Supabase Storage
        let processedUpdates = { ...updates };
        if (updates.profilePhoto) {

          // Check if it's a local file (not already a Supabase URL)
          const isLocalFile = updates.profilePhoto.startsWith("file://") ||
                             updates.profilePhoto.startsWith("ph://") ||
                             updates.profilePhoto.startsWith("/") ||
                             !updates.profilePhoto.startsWith("http");


          if (isLocalFile) {
            try {
              // Read the file and upload to Supabase Storage
              const response = await fetch(updates.profilePhoto);
              const blob = await response.blob();

              // Generate unique filename
              const fileExt = updates.profilePhoto.split(".").pop()?.toLowerCase() || "jpg";
              const validExt = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileExt) ? fileExt : "jpg";
              const fileName = `${currentUser.id}_${Date.now()}.${validExt}`;
              const filePath = `${fileName}`;


              // Upload to Supabase Storage
              const uploadResult = await supabaseStorage.upload(
                "avatar",
                filePath,
                blob,
                { contentType: `image/${validExt}` }
              );

              if (!uploadResult.error) {
                // Get the public URL
                const publicUrl = supabaseStorage.getPublicUrl("avatar", filePath);
                processedUpdates.profilePhoto = publicUrl;
              } else {
                // Still save locally but photo won't persist across sessions
              }
            } catch (error) {
              // Still save locally but photo won't persist across sessions
            }
          } else {
          }
        }

        // Update locally immediately for responsiveness
        const updatedUser = { ...currentUser, ...processedUpdates };
        set({
          currentUser: updatedUser,
          allUsers: get().allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u)),
        });

        // Sync to Supabase
        const profileData = userToProfile(processedUpdates);

        if (Object.keys(profileData).length > 0) {
          try {
            const updateResult = await supabaseDb.update("profiles", profileData, { id: currentUser.id });
            if (updateResult.error) {
            } else {
            }
          } catch (error) {
          }
        } else {
        }
      },

      deleteAccount: async () => {
        const { currentUser } = get();
        if (!currentUser) return;

        // Note: Supabase Auth user deletion requires admin privileges
        // For now, we just clear local state
        await supabaseAuth.signOut();

        set({
          allUsers: get().allUsers.filter((u) => u.id !== currentUser.id),
          currentUser: null,
          isLoggedIn: false,
          supabaseSession: null,
        });
      },

      fetchUserProfile: async (userId) => {
        const { supabaseSession } = get();

        if (supabaseSession) {
          setSession(supabaseSession);
        }

        const result = await supabaseDb.select<Record<string, unknown>[]>("profiles", {
          filter: { id: userId },
        });

        if (result.data?.[0]) {
          const user = profileToUser(result.data[0]);

          // Update local cache
          set({
            allUsers: [...get().allUsers.filter(u => u.id !== user.id), user],
          });

          return user;
        }

        return null;
      },

      fetchAllUsers: async () => {
        const { supabaseSession, currentUser } = get();

        if (supabaseSession) {
          setSession(supabaseSession);
        }

        try {

          const result = await supabaseDb.select<Record<string, unknown>[]>("profiles");

          if (result.error) {
            return;
          }


          if (result.data && result.data.length > 0) {
            const supabaseUsers = result.data.map(profileToUser);


            // Update current user with latest Supabase data if they exist in the list
            if (currentUser) {
              const updatedCurrentUser = supabaseUsers.find(u => u.id === currentUser.id);
              if (updatedCurrentUser) {
                set({ currentUser: updatedCurrentUser });
              }
            }

            // Use Supabase data as the only source of truth
            set({ allUsers: supabaseUsers });
          } else {
            set({ allUsers: [] });
          }
        } catch (error) {
        }
      },

      restoreSession: async () => {
        const { supabaseSession, isLoggedIn } = get();


        if (supabaseSession) {
          setSession(supabaseSession);

          // Try to refresh the session
          const refreshResult = await supabaseAuth.refreshSession();

          if (refreshResult.data) {
            set({
              supabaseSession: {
                access_token: refreshResult.data.access_token,
                refresh_token: refreshResult.data.refresh_token,
              },
            });

            // Fetch user profile from Supabase (not from local storage)
            const userResult = await supabaseAuth.getUser();
            if (userResult.data) {
              const user = await get().fetchUserProfile(userResult.data.id);
              if (user) {
                set({ currentUser: user, isLoggedIn: true });
              } else {
                set({ currentUser: null, isLoggedIn: false });
              }
            }

            // Also fetch all users from Supabase
            await get().fetchAllUsers();
          } else {
            // Session expired, logout
            set({
              currentUser: null,
              isLoggedIn: false,
              supabaseSession: null,
            });
          }
        } else if (isLoggedIn) {
          // isLoggedIn is true but no session - clear stale state
          set({
            currentUser: null,
            isLoggedIn: false,
          });
        }
      },
    }),
    {
      name: "wishy-auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist session - all user data comes from Supabase
      partialize: (state) => ({
        supabaseSession: state.supabaseSession,
        isLoggedIn: state.isLoggedIn,
      }),
    }
  )
);

export default useUserStore;
