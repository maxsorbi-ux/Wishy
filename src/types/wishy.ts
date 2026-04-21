// Wishy App Types

export type UserRole = "wisher" | "wished" | "both";

export type Gender = "male" | "female" | "non-binary" | "custom";

export type RelationshipPreference = "heterosexual" | "homosexual" | "bisexual" | "custom";

export type WishStatus = "created" | "sent" | "accepted" | "date_set" | "confirmed" | "fulfilled" | "rejected" | "deleted";

export type ConnectionStatus = "pending" | "accepted" | "blocked";

export type ConnectionType = "relationship" | "friend";

export type WishCategory =
  | "dining"
  | "travel"
  | "experience"
  | "gift"
  | "entertainment"
  | "wellness"
  | "adventure"
  | "romantic"
  | "custom";

export interface User {
  id: string;
  email: string;
  password: string; // Hashed in production, plain for MVP
  name: string;
  nickname?: string;
  profilePhoto?: string;
  bio?: string;
  interests: string[];
  location?: string;
  age?: number;
  gender?: Gender;
  customGender?: string; // For when gender is "custom"
  relationshipPreference?: RelationshipPreference;
  customRelationshipPreference?: string; // For when relationshipPreference is "custom"
  role: UserRole;
  isElite: boolean;
  createdAt: number;
  photoGallery: string[];
  socialLinks?: {
    instagram?: string;
  };
  privacySettings: {
    showAge: boolean;
    showLocation: boolean;
    showGallery: "public" | "connections" | "private";
  };
  searchPreferences?: {
    roles: UserRole[]; // Which roles to show in search
    genders: Gender[]; // Which genders to show in search
    customGenders?: string[]; // Custom genders to include
    relationshipPreferences: RelationshipPreference[]; // Which preferences to show
    customRelationshipPreferences?: string[]; // Custom preferences to include
  };
}

export interface WishProposal {
  proposedDate?: string;
  proposedTime?: string;
  proposedLocation?: string;
  proposalMessage?: string;
  proposedBy?: string; // userId of who proposed the date
  proposedAt?: number;
  confirmedBy?: string; // userId of who confirmed the date
  confirmedAt?: number;
}

export interface Wish {
  id: string;
  title: string;
  description: string;
  category: WishCategory;
  customCategory?: string;
  tags: string[];
  image?: string;
  links?: string[];
  location?: string;
  isOnline: boolean;
  status: WishStatus;
  creatorId: string;
  creatorRole: "wisher" | "wished";
  targetUserId?: string; // Deprecated: kept for backward compatibility
  targetUserIds?: string[]; // New: support multiple target users
  visibility: "private" | "couple" | "connections" | "public";
  createdAt: number;
  updatedAt: number;
  rating?: number; // 0-5 magic wands
  praised?: boolean; // Heart/Cuoricino
  review?: string;
  ratedBy?: string; // userId of who rated
  proposal?: WishProposal;
}

export interface WishList {
  id: string;
  userId: string;
  wishes: string[]; // Wish IDs
  visibility: "private" | "couple" | "connections" | "public";
}

export interface WishPortfolio {
  id: string;
  userId: string;
  wishes: string[]; // Wish IDs
  visibility: "private" | "couple" | "connections" | "public";
  rating: number;
  reviewCount: number;
}

export interface Connection {
  id: string;
  senderId: string; // User who sent the request
  receiverId: string; // User who received the request
  type: ConnectionType;
  status: ConnectionStatus;
  createdAt: number;
  updatedAt: number;
}

export interface BlockedUser {
  id: string;
  blockerId: string; // User who blocked
  blockedUserId: string; // User who is blocked
  createdAt: number;
}

export interface ContactRequest {
  id: string;
  senderId: string;
  receiverId: string;
  message?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
  updatedAt: number;
}

export interface RelationshipUpgradeRequest {
  id: string;
  connectionId: string;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  wishId: string;
  senderId: string;
  text: string;
  createdAt: number;
  read: boolean;
}

export interface Chat {
  id: string;
  wishId: string;
  participants: string[];
  messages: ChatMessage[];
  lastMessageAt: number;
}

export interface SharedWish {
  id: string;
  wishId: string;
  senderId: string;
  recipientId: string;
  message?: string;
  createdAt: number;
  read: boolean;
}

export type NotificationType = "wish_received" | "wish_accepted" | "date_proposed" | "date_changed" | "date_confirmed" | "connection_request" | "connection_accepted" | "relationship_upgrade_request" | "relationship_upgraded" | "message_received";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: string; // wishId, connectionId, etc.
  read: boolean;
  createdAt: number;
}

export const CATEGORY_ICONS: Record<WishCategory, string> = {
  dining: "restaurant",
  travel: "airplane",
  experience: "star",
  gift: "gift",
  entertainment: "film",
  wellness: "fitness",
  adventure: "compass",
  romantic: "heart",
  custom: "sparkles",
};

export const CATEGORY_LABELS: Record<WishCategory, string> = {
  dining: "Dining",
  travel: "Travel",
  experience: "Experience",
  gift: "Gift",
  entertainment: "Entertainment",
  wellness: "Wellness",
  adventure: "Adventure",
  romantic: "Romantic",
  custom: "Custom",
};

// Wish Status Labels
export const WISH_STATUS_LABELS: Record<WishStatus, string> = {
  created: "Created",
  sent: "Sent",
  accepted: "Accepted",
  date_set: "Set a Date",
  confirmed: "Date Booked",
  fulfilled: "Fulfilled",
  rejected: "Rejected",
  deleted: "Deleted",
};

// Wish Status Colors (Pink, Black, White shades only)
export const WISH_STATUS_COLORS: Record<WishStatus, { bg: string; text: string; border: string }> = {
  created: { bg: "#F5F5F5", text: "#000000", border: "#E5E5E5" }, // Light gray/white
  sent: { bg: "#FFE5F1", text: "#8B2252", border: "#FFB6D9" }, // Light pink
  accepted: { bg: "#FF8DC7", text: "#FFFFFF", border: "#FF69B4" }, // Medium pink
  date_set: { bg: "#FF69B4", text: "#FFFFFF", border: "#FF1493" }, // Hot pink
  confirmed: { bg: "#C71585", text: "#FFFFFF", border: "#8B2252" }, // Deep pink
  fulfilled: { bg: "#8B2252", text: "#FFFFFF", border: "#6B1A40" }, // Dark pink
  rejected: { bg: "#2C2C2C", text: "#FFFFFF", border: "#1A1A1A" }, // Dark gray/black
  deleted: { bg: "#E5E5E5", text: "#666666", border: "#CCCCCC" }, // Gray
};

