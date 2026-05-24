/**
 * Supabase Client for Wishy App
 * Uses REST API directly without installing @supabase/supabase-js
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: SupabaseUser;
}

export interface SupabaseUser {
  id: string;
  email: string;
  created_at: string;
  user_metadata?: Record<string, unknown>;
}

// Store session in memory (will be persisted by the app's state management)
let currentSession: { access_token: string; refresh_token: string } | null = null;

export const setSession = (session: { access_token: string; refresh_token: string } | null) => {
  currentSession = session;
};

export const getSession = () => currentSession;

const getHeaders = (includeAuth = true) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_ANON_KEY,
  };

  if (includeAuth && currentSession?.access_token) {
    headers["Authorization"] = `Bearer ${currentSession.access_token}`;
  } else {
    headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;
  }

  return headers;
};

// ==================== AUTH ====================

export const supabaseAuth = {
  /**
   * Sign up a new user with email and password
   */
  signUp: async (email: string, password: string): Promise<SupabaseResponse<AuthResponse>> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST",
        headers: getHeaders(false),
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: { message: data.msg || data.error_description || "Sign up failed" } };
      }

      if (data.access_token) {
        currentSession = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Sign in with email and password
   */
  signIn: async (email: string, password: string): Promise<SupabaseResponse<AuthResponse>> => {
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: getHeaders(false),
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: { message: data.msg || data.error_description || "Sign in failed" } };
      }

      currentSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Sign out the current user
   */
  signOut: async (): Promise<SupabaseResponse<null>> => {
    try {
      if (currentSession?.access_token) {
        await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: getHeaders(),
        });
      }
      currentSession = null;
      return { data: null, error: null };
    } catch (error) {
      currentSession = null;
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Get current user
   */
  getUser: async (): Promise<SupabaseResponse<SupabaseUser>> => {
    try {
      if (!currentSession?.access_token) {
        return { data: null, error: { message: "No session" } };
      }

      const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "GET",
        headers: getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: { message: data.msg || "Failed to get user" } };
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Refresh the session token
   */
  refreshSession: async (): Promise<SupabaseResponse<AuthResponse>> => {
    try {
      if (!currentSession?.refresh_token) {
        return { data: null, error: { message: "No refresh token" } };
      }

      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: getHeaders(false),
        body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: null, error: { message: data.msg || "Failed to refresh session" } };
      }

      currentSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      };

      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },
};

// ==================== DATABASE ====================

export const supabaseDb = {
  /**
   * Select data from a table
   */
  select: async <T>(
    table: string,
    options?: {
      columns?: string;
      filter?: Record<string, unknown>;
      order?: { column: string; ascending?: boolean };
      limit?: number;
      single?: boolean;
      rawParams?: Record<string, string>; // For custom PostgREST operators like cs, ov, etc.
    }
  ): Promise<SupabaseResponse<T>> => {
    try {
      let url = `${SUPABASE_URL}/rest/v1/${table}`;
      const params = new URLSearchParams();

      if (options?.columns) {
        params.append("select", options.columns);
      }

      if (options?.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          params.append(key, `eq.${value}`);
        });
      }

      // Support raw PostgREST params for advanced queries (like array contains)
      if (options?.rawParams) {
        Object.entries(options.rawParams).forEach(([key, value]) => {
          params.append(key, value);
        });
      }

      if (options?.order) {
        params.append("order", `${options.order.column}.${options.order.ascending ? "asc" : "desc"}`);
      }

      if (options?.limit) {
        params.append("limit", options.limit.toString());
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const headers = getHeaders();
      if (options?.single) {
        headers["Accept"] = "application/vnd.pgrst.object+json";
      }

      const response = await fetch(url, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "Select failed" } };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Insert data into a table
   */
  insert: async <T>(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { returning?: boolean }
  ): Promise<SupabaseResponse<T>> => {
    try {
      const url = `${SUPABASE_URL}/rest/v1/${table}`;

      const headers = getHeaders();
      if (options?.returning !== false) {
        headers["Prefer"] = "return=representation";
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "Insert failed", code: errorData.code } };
      }

      const responseData = await response.json();
      return { data: responseData, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Update data in a table
   */
  update: async <T>(
    table: string,
    data: Record<string, unknown>,
    filter: Record<string, unknown>
  ): Promise<SupabaseResponse<T>> => {
    try {
      let url = `${SUPABASE_URL}/rest/v1/${table}`;
      const params = new URLSearchParams();

      Object.entries(filter).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });

      url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          ...getHeaders(),
          "Prefer": "return=representation",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "Update failed" } };
      }

      const responseData = await response.json();
      return { data: responseData, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Delete data from a table
   */
  delete: async <T>(
    table: string,
    filter: Record<string, unknown>
  ): Promise<SupabaseResponse<T>> => {
    try {
      let url = `${SUPABASE_URL}/rest/v1/${table}`;
      const params = new URLSearchParams();

      Object.entries(filter).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });

      url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: {
          ...getHeaders(),
          "Prefer": "return=representation",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "Delete failed" } };
      }

      const responseData = await response.json();
      return { data: responseData, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Upsert data (insert or update)
   */
  upsert: async <T>(
    table: string,
    data: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string }
  ): Promise<SupabaseResponse<T>> => {
    try {
      let url = `${SUPABASE_URL}/rest/v1/${table}`;

      if (options?.onConflict) {
        url += `?on_conflict=${options.onConflict}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Prefer": "return=representation,resolution=merge-duplicates",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "Upsert failed" } };
      }

      const responseData = await response.json();
      return { data: responseData, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Execute a raw query using RPC (stored procedure)
   */
  rpc: async <T>(
    functionName: string,
    params?: Record<string, unknown>
  ): Promise<SupabaseResponse<T>> => {
    try {
      const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`;

      const response = await fetch(url, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(params || {}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "RPC failed" } };
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },
};

// ==================== REALTIME ====================

type RealtimeCallback = (payload: {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

interface RealtimeChannel {
  unsubscribe: () => void;
}

export const supabaseRealtime = {
  /**
   * Subscribe to realtime changes on a table
   * Note: This is a simplified implementation. For production,
   * you might want to use WebSockets directly or the official Supabase client.
   */
  subscribe: (
    table: string,
    callback: RealtimeCallback,
    filter?: { column: string; value: string }
  ): RealtimeChannel => {
    // For now, we'll use polling as a fallback
    // In production, you'd want to implement WebSocket connection
    let isSubscribed = true;
    let lastData: Record<string, unknown>[] = [];

    const poll = async () => {
      if (!isSubscribed) return;

      try {
        const filterObj = filter ? { [filter.column]: filter.value } : undefined;
        const result = await supabaseDb.select<Record<string, unknown>[]>(table, {
          filter: filterObj,
        });

        if (result.data) {
          // Check for changes
          const newData = result.data;

          // Find new items
          newData.forEach((item) => {
            const existing = lastData.find((old) => old.id === item.id);
            if (!existing) {
              callback({ eventType: "INSERT", new: item, old: {} });
            } else if (JSON.stringify(existing) !== JSON.stringify(item)) {
              callback({ eventType: "UPDATE", new: item, old: existing });
            }
          });

          // Find deleted items
          lastData.forEach((item) => {
            const stillExists = newData.find((newItem) => newItem.id === item.id);
            if (!stillExists) {
              callback({ eventType: "DELETE", new: {}, old: item });
            }
          });

          lastData = newData;
        }
      } catch (error) {
      }

      // Poll every 1 second for faster updates
      if (isSubscribed) {
        setTimeout(poll, 1000);
      }
    };

    // Start polling
    poll();

    return {
      unsubscribe: () => {
        isSubscribed = false;
      },
    };
  },
};

// ==================== STORAGE ====================

export const supabaseStorage = {
  /**
   * Upload a file to storage
   */
  upload: async (
    bucket: string,
    path: string,
    file: Blob | ArrayBuffer,
    options?: { contentType?: string }
  ): Promise<SupabaseResponse<{ path: string }>> => {
    try {
      const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

      const headers: Record<string, string> = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${currentSession?.access_token || SUPABASE_ANON_KEY}`,
      };

      if (options?.contentType) {
        headers["Content-Type"] = options.contentType;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: file,
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "Upload failed" } };
      }

      return { data: { path }, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Upload a file from a local URI (React Native)
   * Converts the local file to base64 and uploads it
   */
  uploadFromUri: async (
    bucket: string,
    path: string,
    localUri: string,
    contentType: string = "image/jpeg"
  ): Promise<SupabaseResponse<{ path: string; publicUrl: string }>> => {
    try {

      // Fetch the local file
      const response = await fetch(localUri);
      const blob = await response.blob();


      const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

      const headers: Record<string, string> = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${currentSession?.access_token || SUPABASE_ANON_KEY}`,
        "Content-Type": contentType,
      };

      const uploadResponse = await fetch(url, {
        method: "POST",
        headers,
        body: blob,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        return { data: null, error: { message: errorData.message || errorData.error || "Upload failed" } };
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

      return { data: { path, publicUrl }, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },

  /**
   * Get public URL for a file
   */
  getPublicUrl: (bucket: string, path: string): string => {
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
  },

  /**
   * Delete a file from storage
   */
  delete: async (bucket: string, paths: string[]): Promise<SupabaseResponse<null>> => {
    try {
      const url = `${SUPABASE_URL}/storage/v1/object/${bucket}`;

      const response = await fetch(url, {
        method: "DELETE",
        headers: getHeaders(),
        body: JSON.stringify({ prefixes: paths }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: { message: errorData.message || "Delete failed" } };
      }

      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },
};

export default {
  auth: supabaseAuth,
  db: supabaseDb,
  realtime: supabaseRealtime,
  storage: supabaseStorage,
  setSession,
  getSession,
};
