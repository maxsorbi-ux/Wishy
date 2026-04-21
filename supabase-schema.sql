-- =============================================
-- WISHY APP - SUPABASE DATABASE SCHEMA
-- =============================================
-- Run this SQL in your Supabase Dashboard:
-- Go to SQL Editor > New Query > Paste & Run
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. PROFILES TABLE (extends auth.users)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT CHECK (role IN ('wisher', 'wished', 'both')) DEFAULT 'both',
  gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'custom')),
  custom_gender TEXT,
  relationship_preference TEXT CHECK (relationship_preference IN ('heterosexual', 'homosexual', 'bisexual', 'custom')),
  custom_relationship_preference TEXT,
  photo TEXT,
  bio TEXT,
  location TEXT,
  age INTEGER,
  interests TEXT[] DEFAULT '{}',
  social_links JSONB DEFAULT '{}',
  gallery TEXT[] DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{"showAge": true, "showLocation": true, "galleryVisibility": "connections"}',
  search_preferences JSONB DEFAULT '{"roles": ["wisher", "wished", "both"], "genders": ["male", "female", "non-binary", "custom"], "relationshipPreferences": ["heterosexual", "homosexual", "bisexual", "custom"]}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- 2. WISHES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS wishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  image TEXT,
  links TEXT[] DEFAULT '{}',
  status TEXT CHECK (status IN ('created', 'sent', 'accepted', 'fulfilled', 'rejected', 'deleted')) DEFAULT 'created',
  creator_role TEXT CHECK (creator_role IN ('wisher', 'wished')) NOT NULL,
  visibility TEXT CHECK (visibility IN ('public', 'connections', 'private')) DEFAULT 'connections',
  proposed_date TIMESTAMPTZ,
  proposed_time TEXT,
  proposed_location TEXT,
  date_confirmed_by_wisher BOOLEAN DEFAULT FALSE,
  date_confirmed_by_wished BOOLEAN DEFAULT FALSE,
  fulfillment_rating INTEGER CHECK (fulfillment_rating >= 0 AND fulfillment_rating <= 5),
  fulfillment_heart BOOLEAN DEFAULT FALSE,
  fulfillment_review TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE wishes ENABLE ROW LEVEL SECURITY;

-- Policies for wishes
CREATE POLICY "Users can view public wishes" ON wishes
  FOR SELECT USING (
    visibility = 'public' OR
    creator_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM wish_recipients wr WHERE wr.wish_id = wishes.id AND wr.recipient_id = auth.uid()
    )
  );

CREATE POLICY "Users can create wishes" ON wishes
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their wishes" ON wishes
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their wishes" ON wishes
  FOR DELETE USING (auth.uid() = creator_id);

-- =============================================
-- 3. WISH RECIPIENTS TABLE (many-to-many)
-- =============================================
CREATE TABLE IF NOT EXISTS wish_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wish_id UUID REFERENCES wishes(id) ON DELETE CASCADE NOT NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wish_id, recipient_id)
);

-- Enable RLS
ALTER TABLE wish_recipients ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their wish recipients" ON wish_recipients
  FOR SELECT USING (
    recipient_id = auth.uid() OR
    EXISTS (SELECT 1 FROM wishes w WHERE w.id = wish_id AND w.creator_id = auth.uid())
  );

CREATE POLICY "Creators can add recipients" ON wish_recipients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM wishes w WHERE w.id = wish_id AND w.creator_id = auth.uid())
  );

CREATE POLICY "Recipients can update their status" ON wish_recipients
  FOR UPDATE USING (recipient_id = auth.uid());

-- =============================================
-- 4. CONNECTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  connected_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('friend', 'relationship')) DEFAULT 'friend',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, connected_user_id)
);

-- Enable RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their connections" ON connections
  FOR SELECT USING (user_id = auth.uid() OR connected_user_id = auth.uid());

CREATE POLICY "Users can create connections" ON connections
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their connections" ON connections
  FOR UPDATE USING (user_id = auth.uid() OR connected_user_id = auth.uid());

CREATE POLICY "Users can delete their connections" ON connections
  FOR DELETE USING (user_id = auth.uid() OR connected_user_id = auth.uid());

-- =============================================
-- 5. CONNECTION REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message TEXT,
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
  request_type TEXT CHECK (request_type IN ('connection', 'relationship_upgrade')) DEFAULT 'connection',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_user_id, to_user_id, request_type)
);

-- Enable RLS
ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their requests" ON connection_requests
  FOR SELECT USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "Users can create requests" ON connection_requests
  FOR INSERT WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Recipients can update requests" ON connection_requests
  FOR UPDATE USING (to_user_id = auth.uid());

CREATE POLICY "Users can delete their requests" ON connection_requests
  FOR DELETE USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- =============================================
-- 6. BLOCKED USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, blocked_user_id)
);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their blocked list" ON blocked_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can block others" ON blocked_users
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unblock" ON blocked_users
  FOR DELETE USING (user_id = auth.uid());

-- =============================================
-- 7. CHATS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wish_id UUID REFERENCES wishes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 8. CHAT PARTICIPANTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS chat_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_id, user_id)
);

-- Enable RLS
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

-- Policies for chats and participants
CREATE POLICY "Participants can view their chats" ON chats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = chats.id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Users can create chats" ON chats
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Participants can view chat participants" ON chat_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = chat_participants.chat_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Users can add participants" ON chat_participants
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- =============================================
-- 9. MESSAGES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Participants can view messages" ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Participants can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM chat_participants cp WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid())
  );

CREATE POLICY "Users can update their messages" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

-- =============================================
-- 10. NOTIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN (
    'wish_received', 'wish_accepted', 'wish_declined', 'wish_fulfilled',
    'date_proposed', 'date_changed', 'date_confirmed',
    'connection_request', 'connection_accepted',
    'relationship_upgrade_request', 'relationship_upgraded',
    'message_received'
  )) NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  related_id UUID,
  related_type TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- =============================================
-- 11. PUSH TOKENS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT CHECK (platform IN ('ios', 'android')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own tokens" ON push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own tokens" ON push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tokens" ON push_tokens
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own tokens" ON push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to transfer push token ownership (for device ownership transfer)
-- This allows a user to claim a token when they log in on a device
CREATE OR REPLACE FUNCTION transfer_push_token(
  p_token TEXT,
  p_user_id UUID,
  p_platform TEXT
)
RETURNS void AS $$
BEGIN
  -- Delete the token from any previous user (device ownership transfer)
  DELETE FROM push_tokens WHERE token = p_token;
  
  -- Insert the token for the new user
  INSERT INTO push_tokens (user_id, token, platform)
  VALUES (p_user_id, p_token, p_platform)
  ON CONFLICT (token) DO UPDATE
  SET user_id = p_user_id, platform = p_platform, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_wishes_updated_at
  BEFORE UPDATE ON wishes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_connections_updated_at
  BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE wishes;
ALTER PUBLICATION supabase_realtime ADD TABLE connection_requests;

-- =============================================
-- DONE! Your database is ready.
-- =============================================
