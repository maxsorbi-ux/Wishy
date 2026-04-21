# Wishy - Where Desires Become Reality

A beautiful mobile app for strengthening relationships through shared wishes and experiences. Users can express desires (as "Wished") and fulfill them for others (as "Wisher").

## App Configuration

- **App Name**: Wishy 1
- **Slug**: wishy
- **EAS Project ID**: 37ef5027-f316-47ba-b77d-bd0675776ae4
- **iOS Bundle Identifier**: com.vibecode.wishy-6q9iaw
- **Expo Account**: maxsorbi

The project ID is read dynamically from `Constants.expoConfig.extra.eas.projectId` (no hardcoded values in code).

## Recent Updates

### Chat & Notification Improvements (Latest)
- **Faster Chat Updates**: Reduced polling interval from 3 seconds to 1 second for more responsive message delivery
- **Chat Screen Fast Polling**: Added dedicated 2-second polling when chat screen is active for near real-time updates
- **Send Button Loading State**: Shows loading spinner while message is being sent
- **Smart Notification Sync**: Fixed notification sync to preserve local notifications that have not synced to Supabase yet
  - No longer clears local notifications when Supabase returns empty results
  - Properly merges local and cloud notifications
  - Error handling preserves local data instead of clearing it

### Wish System Overhaul (Latest)
- **Accept Wish Fix**: The accept button now properly updates wish status to "accepted" in both local state and Supabase
  - Added detailed logging for debugging
  - Sends both in-app and push notifications to wish creator
  - Fixed async/await handling
- **Chat System Fix**: Chat now properly handles multiple recipients (targetUserIds array)
  - Fixed participant creation for multi-recipient wishes
  - Both creator and recipients can open chat correctly
  - Backward compatible with single targetUserId
- **Date Proposal Fix**: Date proposal and confirmation now work correctly
  - Properly saves proposed date/time to Supabase
  - Sends notifications to all recipients (supports multiple)
  - Date confirmation sends in-app notifications
- **Notification System Enhancement**: Notifications now sync with Supabase
  - In-app notifications are saved to Supabase for cross-device sync
  - New `syncNotifications()` function fetches notifications from cloud
  - Notifications sync on app start and when receiving push notifications
  - Mark as read, delete, and clear all sync to Supabase

### Push Notifications for Wish Actions
- **Chat Messages**: Push notifications are sent to recipients when messages are received
- **Wish Actions**: All wish actions now trigger push notifications:
  - **Accept**: Creator receives notification when wish is accepted
  - **Edit**: Target user receives notification when wish is edited
  - **Propose Date**: Other participant receives notification when date is proposed/changed
  - **Delete**: Other participant receives notification when wish is deleted
  - **Send**: Recipients receive push notification when wish is sent to them
- **Condition**: Notifications are only sent when both wisher and wished are defined (wish has been sent to someone)
- **Real-time Chat**: Chat now subscribes to real-time message updates and syncs from Supabase

### Wish Image Storage Fix
- **Supabase Storage**: Wish images are now uploaded to Supabase Storage instead of being saved as local URIs
- **Cross-device Visibility**: Both creator and recipient can now see wish images
- **Bucket**: Images are stored in the `wish-images` bucket with public access

### Wish Action Buttons Unified
- **Enhanced Logging**: Added detailed logging throughout the wish sync process
  - Shows exactly which recipients are saved for each wish
  - Logs all wishes where current user is a recipient
  - Helps identify sync issues quickly
- **Increased Sync Limit**: Raised wish fetch limit from 500 to 1000 to catch more wishes
- **Better Debugging**: More detailed console logs to diagnose recipient delivery issues
  - When you create a wish, logs show exactly which recipients are being saved
  - When you sync, logs show exactly which wishes you should receive
  - Logs display recipient IDs and how they're stored in Supabase

### Connection System Fixes
- **Direct Connection Type Selection**: When accepting a connection request, users can now choose between Friend and Relationship directly
  - The selected type is saved correctly to Supabase
  - No more issues with "Relationship" being saved as "friend"
- **Relationship Upgrade Requests**: Fixed upgrade request visibility across devices
  - Upgrade requests are now properly saved to Supabase with correct `request_type`
  - Receiver can see pending upgrade requests in ManageConnection screen
  - Notifications are created for pending upgrade requests during sync
- **Auto-Create Missing Connections**: When an accepted request exists without a corresponding connection, the system automatically creates it during sync
- **Improved Debug Logging**: Added detailed logging for sync operations to diagnose cross-device issues

### User ID Mismatch Fix
- **Supabase-Only Data**: All user data now comes exclusively from Supabase
  - No more local storage of currentUser or allUsers
  - Only the session token is persisted locally
  - This eliminates ID mismatch issues between devices
- **Profile Photo Sync**: User profile photos are always loaded from Supabase Storage
  - Photos are uploaded to Supabase Storage when changed
  - All devices see the same profile photos
- **Simplified Connection Logic**: Removed complex ID mismatch handling
  - All IDs now come directly from Supabase
  - No more need for multi-ID lookups
- **Wish Recipient Selection Fix**: Recipients can now be selected when creating/editing wishes
  - Removed role-based filtering that was blocking users from seeing their connections
  - All connected users are now shown regardless of their role

### Multi-Device Sync Fix
- **Supabase as Source of Truth**: All connection data now uses Supabase as the single source of truth
  - Removed local data merging that caused inconsistencies between devices
  - Both devices now see exactly the same data
- **Automatic Data Migration**: When local data exists but Supabase is empty, data is automatically migrated
  - Connections are migrated to the cloud
  - Contact requests are migrated to the cloud
  - This ensures no data is lost during the transition
- **Improved Error Handling**: All connection operations now properly handle errors
  - Clear error messages in Italian for user-facing issues
  - Operations only complete after successful Supabase save
  - Better logging for debugging
- **Session Restoration**: Improved app initialization sequence
  - Session is properly restored before syncing data
  - Connections and chats are synced immediately after login restoration

### Bug Fixes (Latest)
- **Connection Request Accept Fix**: Fixed the accept button on notifications not working properly
  - Added proper async/await handling for accepting requests
  - Improved connection type selection modal functionality
  - Added automatic sync after accepting a request
  - Better error handling with console logging for debugging
- **Profile Photo Persistence**: Fixed profile photos not being saved to Supabase
  - Corrected the file path for Supabase Storage upload
  - Added logging for upload success/failure
  - Profile photos now persist across app sessions
- **User Discovery Fix**: Improved fetching of all users for search
  - Added error handling and logging
  - Users can now properly find each other in search
- **Connection Sync Improvements**: Enhanced connection syncing with Supabase
  - Added detailed logging for sync operations
  - Better handling of connection requests and acceptances
  - Notifications auto-created for pending requests on sync

### Connection Flow Fix
- **Direct Accept/Decline from Notifications**: Connection requests can now be accepted or declined directly from the Notifications screen
  - Shows Accept and Decline buttons on pending connection request notifications
  - Accept opens a modal to choose connection type (Friend or Relationship)
  - No more need to navigate to Connections screen to handle requests
- **Simplified User Search**: Removed preference filters from search to ensure all users are discoverable
  - Users can now find each other by name or email without filters blocking results
- **Auto-create Notifications on Sync**: When syncing connections, missing notifications are automatically created for pending requests
  - Ensures users always see their pending connection requests
- **Pull to Refresh**: Added pull-to-refresh on Notifications screen to manually sync data
- **Logout with Confirmation**: Users can now logout from the Profile screen with a confirmation modal
  - After logout, users are redirected to the Welcome screen
  - Users can then login with a different account

### Multi-Device Sync Fix
- **Automatic Data Sync**: Connections, contact requests, and chats now automatically sync from Supabase when:
  - App launches and user is logged in
  - Session is restored
  - Connections screen is opened (focus)
- **Pull to Refresh**: Added pull-to-refresh on Connections screen to manually sync data
- **Cross-Device Support**: Users on different devices will now see the same contacts and connection requests

### Supabase Backend Integration
- **Cloud Database**: All data is now synced to Supabase for multi-user interaction
  - User authentication via Supabase Auth
  - Wishes, connections, and chats stored in cloud database
  - Real-time message sync for chat conversations
  - Profile photos stored in Supabase Storage (bucket: "avatar")
- **Push Notifications**: Real push notifications even when app is closed
  - Notification when someone sends you a wish
  - Notification when someone accepts your wish
  - Notification when you receive a new message
  - Notification for connection requests and acceptances
  - Notification when a date is proposed or a wish is fulfilled
- **TestFlight Ready**: Users on TestFlight can now interact with each other
  - Register and login with real accounts
  - Send wishes to other real users
  - Chat in real-time
  - View other users' public wishes
- **Offline Support**: App works offline with local cache, syncs when online

### Search Preferences Integration
- **Intelligent Search Filtering**: The user search now respects your configured search preferences
  - Search results are automatically filtered by selected roles (Wisher, Wished, Both)
  - Filtered by gender preferences (Male, Female, Non-Binary, Custom)
  - Filtered by relationship preferences (Heterosexual, Homosexual, Bisexual, Custom)
  - Quick access to search settings via the top-right icon in Connections screen
- **Better User Discovery**: Find exactly the type of users you want to connect with based on your preferences

### User Feedback System
- **Toast Notifications**: All confirmation and validation buttons now display success/error messages
  - Green toast for successful actions (e.g., "Wish created successfully!")
  - Blue toast for informational messages
  - Red toast for errors
- **Haptic Feedback**: Enhanced tactile responses for button presses
- **Visual Feedback**: Smooth animations when actions complete
- **Comprehensive Coverage**: Feedback implemented across all major screens:
  - Wish creation and editing
  - Connection management
  - Profile updates
  - Relationship requests
  - Date proposals
  - And more!

## Features

### Core Functionality
- **Onboarding Flow**: Beautiful welcome screen with role selection (Wisher, Wished, or Both)
- **Profile Setup**: Name, photo, bio, and interest tags
- **Landing Page**: Quick action hub with role-based navigation:
  - **Wished & Wisher (Both)**: See all three options - Esprimi, Proponi, and Esplora
  - **Wished**: See only Esprimi and Esplora (cannot propose wishes to others)
  - **Wisher**: See only Proponi and Esplora (cannot express personal wishes)
  - **Esprimi un Desiderio**: Directly create a wish in your "For Me" list (desires to be fulfilled by others)
  - **Proponi un Desiderio**: Create a wish in your "For Others" portfolio (offers to send to others)
  - **Esplora i Desideri**: Browse the Discovery feed to explore wishes
- **Wish Interaction Model**: Three clear perspectives for managing wishes
- **Discovery (Wishy Stage)**: View wishes sent to you by others
  - Shows only wishes where you are the recipient
  - Each wish displays sender information with profile photo
  - Click on sender to view their full profile
  - Category filters to find specific types of wishes
- **Connections System**: Advanced connection management with multiple types
  - **Search & Connect**: Find users by name or email and send connection requests
    - **Search Preferences**: Configure which users appear in search results based on role, gender, and relationship preferences
    - Search results are intelligently filtered according to your preferences
    - Quick access to search settings from the Connections screen
  - **QR Code Sharing**: Share your unique QR code for quick connections
  - **Contact Requests**: Send and receive connection requests with notifications
  - **Connection Types**:
    - **Friend**: Default connection type for social connections
    - **In a Relationship**: Special status that requires mutual approval
  - **Relationship Upgrade**: Either user can propose upgrading from Friend to Relationship status
  - **User Blocking**: Block users to prevent them from contacting or seeing you
  - **Connection Management**: View, manage, and disconnect from connections
- **Chat**: In-app messaging linked to wishes for discussing proposals and dates
- **User Profiles**: View detailed profiles of connected users with wish statistics and interaction history

### Connection System Details

#### Connection Request Flow
1. **Sending Requests**:
   - Search for users by name or email
   - Send a contact request (with optional message)
   - A notification is sent to the recipient
   - After sending, the button changes to show the pending state
2. **Receiving Requests**:
   - View pending requests in the Connections tab
   - See requester's profile photo, name, and message
   - Accept to create a Friend connection
   - Reject to decline the request
   - After accepting, sender receives a notification
3. **After Connection**:
   - Both users appear in each other's connection lists
   - Can view each other's profiles and wishlists
   - Can send wishes to each other

#### Relationship Upgrade System
1. **Proposing Upgrade**:
   - Navigate to Manage Connection screen
   - Tap "Propose Relationship Status"
   - Confirm the proposal
   - A notification is sent to the other user
2. **Receiving Upgrade Request**:
   - Notification appears for relationship upgrade request
   - View the request in Manage Connection screen
   - Accept to upgrade both users to "In a Relationship"
   - Reject to keep the connection as Friend
3. **Relationship Status**:
   - "In a Relationship" status is visible on both user profiles
   - Special heart icon indicates relationship connections
   - Either user can downgrade back to Friend at any time

#### User Blocking
- Block users from Manage Connection screen
- Blocked users:
  - Cannot see your profile in search
  - Cannot send you contact requests
  - Existing connections are removed
  - Cannot interact with you in any way
- Unblock users from Settings if needed

### User Roles
- **Wished**: Share your desires and let others fulfill them
  - **Visible Sections**: Wish list (For Me), Received
  - **Hidden Sections**: Wish portfolio (For Others) - data saved, can be restored when switching to "Both" role
- **Wisher**: Discover wishes to fulfill and create meaningful moments
  - **Visible Sections**: Wish portfolio (For Others), Received
  - **Hidden Sections**: Wish list (For Me) - data saved, can be restored when switching to "Both" role
- **Both**: Experience the full Wishy journey
  - **Visible Sections**: All three sections - Wish list (For Me), Wish portfolio (For Others), Received

**Role Switching**: Users can change their role at any time from Profile Settings. When switching roles, tab visibility adapts dynamically while preserving all wish data.

### Wish Interaction Model

Every wish in Wishy is understood through three dimensions:
1. **Who created it** (the creator)
2. **Who is supposed to fulfill it** (the target)
3. **How it came to appear in my app** (origin)

The app organizes wishes into three main sections:

#### 1. "For Me" Tab (I am WISHED)
Wishes that I created for myself to be fulfilled by others:
- **Only wishes created BY me** with role "Wished"
- These are my desires that I want others to fulfill
  - Example: "Weekend in Paris", "Dinner at [Restaurant]", "New sunglasses"
  - Badge: "MY DESIRE" (pink badge)
- Status tracking: Draft / Proposed / Accepted / Date set / Fulfilled / Declined

#### 2. "For Others" Tab (I am WISHER)
Wishes that I created to offer to others:
- **Only wishes created BY me** with role "Wisher"
- These are my proposals/offers to send to connected users
  - Badge: "MY PROPOSAL" (blue badge)
- Can be draft templates or sent to specific recipients
- **Recipient selection**: You can select a recipient during creation OR send it later from the wish detail page

#### 3. "Received" Tab (Inbox)
Wishes received from other users:
- **Only wishes created by OTHER users** and sent to me
- All incoming proposals from connected users
- Clear "New" indicator for unread proposals (status: "proposed")
- Badge: "FROM [USER]" (purple badge)
- Primary actions available:
  - **Accept & Propose Date**: Opens date/time picker, creates chat automatically
  - **Ask for Details**: Opens chat to discuss the wish
  - **Decline**: Politely decline the proposal
  - **Delete**: Remove the wish from your list (notifies creator)

### Wish Status Flow
- **Draft**: Not yet shared
- **Proposed**: Sent to someone, awaiting response
- **Accepted**: Receiver has accepted but no date set
- **With Date**: Date and time have been proposed
- **Fulfilled**: Wish has been fulfilled and rated
- **Declined**: Receiver declined the proposal

### Wish Detail Page
Every wish shows:
- **Origin Badge**: Visual indicator of who created it and for whom
- **Direction Indicator**: Shows Wisher → Wished relationship with avatars
  - **Clickable User Profiles**: Tap on the Wisher or Wished icon to view their full profile
  - **Multiple Recipients Display**: When a wish is sent to multiple users, see stacked avatars with a count indicator
- **Core Information**: Title, description, category, tags, links (clickable web URLs)
- **Clickable Location**: Location is a clickable link that opens in Google Maps (iOS/Android native maps or web)
- **Proposed Date Section**: When a date has been set, displays prominently with action buttons
  - **Confirm Button**: Green button to confirm the proposed date (disappears after confirmation)
  - **Change Date Button**: Blue button to modify the date/time with native spinner pickers
  - Both Wisher and Wished can confirm or change the date at any moment
  - Shows "Confirmed Date" with checkmark when both parties have confirmed
  - Notifications sent for both confirmations and changes
- **Action Buttons**: Context-aware based on user role and wish status
  - **For Creators (who created the wish)**:
    - Status "sent": Propose Date, Edit, Give Details, Delete
    - Status "accepted": Edit, Open Chat
    - Status "created" (unsent): Edit, Delete
  - **For Receivers (who received the wish)**:
    - Status "sent": Accept & Propose Date (for gift category: just "Accept"), Ask Details, Decline, Delete
    - Status "accepted": Open Chat
  - **Fulfilled functionality**: Only the WISHED person can mark a wish as fulfilled
- **Delete Functionality**:
  - **Creator Delete**: Permanently removes the wish for everyone and notifies all recipients
  - **Recipient Delete**: Hides the wish only for the recipient and notifies the creator
  - Different confirmation messages based on user role
- **Send Button**: For Wisher wishes not yet sent, a send button (top-right) opens a modal to select a connected user as recipient
- **Fulfill & Rate System**:
  - **Fulfilled Button**: WISHED users can mark wishes as fulfilled when status is "accepted" or "with_date"
  - **5 Magic Wands Rating**: Rate satisfaction from 0-5 magic wands
  - **Heart/Cuoricino**: Optional special praise with a heart
  - **Review**: Optional text review of the experience
  - **Edit Rating**: WISHED users can modify their rating at any time after fulfillment
  - Ratings are permanently associated with fulfilled wishes
  - Status displays as "fulfilled" (not "completed")
  - Chat remains active even after wish is fulfilled

### Chat Integration
- When a wish is accepted with a date, a dedicated chat is automatically created
- Chat is linked to the specific wish
- **Participants**: Automatically includes both Wisher and Wished as participants
- Messages are visible to both parties in real-time
- **Open Chat button**: Available for both Wisher and Wished
  - Wished sees button when wish status is "proposed" or "with_date"
  - Wisher sees button after sending wish (all statuses)
- **Message notifications**: Every message sent triggers a notification for the recipient
- First message summarizes the proposed date and wish details
- Users can open chat at any time from wish detail page
- **Chat persists after fulfillment**: Discussion continues even after wish is completed

### Notification System
- **Real-time notifications** when you receive wishes, acceptances, or date proposals
- **Unread badge** on Profile tab showing number of unread notifications
- **Notification center** accessible from Profile screen
- **Types of notifications**:
  - Wish received: When someone sends you a wish
  - Wish accepted: When someone accepts your wish
  - Date proposed: When a date is set for a wish
  - **Date confirmed**: When someone confirms the proposed date/time
  - **Date changed**: When someone modifies the date/time of a wish
  - **Wish fulfilled**: When someone marks a wish as fulfilled with rating (displayed as "fulfilled" not "completed")
  - Connection request: When someone wants to connect
  - Message received: When you receive a new chat message
- **Quick actions**: Tap notification to go directly to related wish or chat
- **Mark as read** individually or all at once

### Wish Creation Features
- **Custom Categories**: Create your own category beyond the predefined ones
- **Image Options**: Choose between taking a photo with camera or selecting from library
- **Multiple Links**: Add multiple web links to provide context or references for your wish
- **Location Search**: Enter a location with quick access to maps for selecting real places
- **Role Selection**: Choose to save each wish as either "Wished" (for you) or "Wisher" (to offer to others)
- **Multiple Recipients**: Select multiple users to send a wish to at once
  - **Wisher**: Can send to users with "Wished" or "Both" roles
  - **Wished**: Can send to users with "Wisher" or "Both" roles
  - Recipients are filtered based on your creator role for better matching
  - Beautiful stacked avatar display showing all selected recipients
- **No Budget Field**: Focus on the experience, not the price

### Wish Categories
- Dining, Travel, Experience, Gift, Entertainment, Wellness, Adventure, Romantic, Custom (with custom naming)

### Connected User Profiles
When viewing a connected user's profile, you can see:
- **Satisfaction Rating** (prominent display):
  - Average rating with 5 magic wands visualization
  - Total number of reviews
  - Hearts received count
  - Displayed prominently to show user's ability to fulfill wishes
- **Overview Tab**:
  - Interactive statistics of your wish journey together (Proposed, In Progress, Fulfilled, Declined)
  - Click on any statistic to view filtered wishes in that category
  - Complete list of wishes shared with you by this user
- **Wishlist Tab**: View their desires (if they have a Wished role)
  - Only shows wishes shared with you or marked as public
- **Portfolio Tab**: View wishes they offer to fulfill (if they have a Wisher role)
  - Only shows wishes shared with you or marked as public
- **In a Relationship**: List showing users with whom this user has a "relationship" connection
  - Displays profile photos and names with heart icons
  - Tap on any person to navigate to their profile
  - Only shows relationship-type connections, not regular friends
- Basic profile information (interests, gallery, contact info)
- Connection status indicator for non-connected users

### User Profile Features
Your own profile displays:
- Profile photo, name, bio
- User role (Wisher, Wished, or Both) and Elite status badge
- **Wishy Journey Statistics**: Interactive dashboard showing:
  - Total fulfilled wishes
  - Wishes in progress
  - Wishes created for yourself (For Me)
  - Wishes created for others (For Others)
  - Wishes received from others
- **Change Role**: Ability to change your role at any time between Wished, Wisher, or Both from the profile settings
  - **Dynamic Tab Visibility**: When you change roles, the My Wishes screen automatically adjusts to show only relevant tabs
  - **Data Preservation**: All wishes are preserved when changing roles - hidden sections can be restored by switching back
  - **Seamless Switching**: Active tab automatically switches to a valid option when role changes
- **Satisfaction Rating**: Your average rating from fulfilled wishes (if you have reviews)
  - Visual magic wands display
  - Detailed stats: average rating, total reviews, hearts received
- **Edit Profile**: Complete profile editing with:
  - Basic information (name, bio, location, age)
  - Gender selection (Male, Female, Non-Binary, Custom)
  - Relationship preference (Heterosexual, Homosexual, Bisexual, Custom)
  - Interests management
- **Search Settings**: Configure which users appear in search results by:
  - User roles (Wisher, Wished, Both)
  - Gender preferences
  - Relationship preferences
- Interests and photo gallery
- Quick access to notifications and settings
- **Delete Account**: Option to permanently delete your account with confirmation
- Logout option

## Tech Stack
- Expo SDK 53 with React Native
- Zustand for state management (with AsyncStorage persistence)
- React Navigation (native stack + bottom tabs)
- NativeWind/Tailwind for styling
- React Native Reanimated for animations
- Expo Image Picker and Camera for photos

## File Structure

```
src/
├── navigation/
│   └── RootNavigator.tsx      # Main navigation setup
├── screens/
│   ├── WelcomeScreen.tsx      # Splash/welcome screen
│   ├── RoleSelectionScreen.tsx # Choose Wisher/Wished/Both
│   ├── ProfileSetupScreen.tsx  # Create profile
│   ├── LandingScreen.tsx      # Quick action hub (post-onboarding)
│   ├── DiscoveryScreen.tsx    # Browse public wishes
│   ├── MyWishesScreen.tsx     # Wish List & Portfolio
│   ├── ConnectionsScreen.tsx  # Manage connections
│   ├── ProfileScreen.tsx      # View/edit profile
│   ├── CreateWishScreen.tsx   # Add new wish (camera/library, links, custom categories, role selection)
│   ├── WishDetailScreen.tsx   # View wish details (with send button)
│   ├── UserProfileScreen.tsx  # View connected user profiles with statistics and wishes
│   ├── ChatScreen.tsx         # Chat about a wish
│   ├── NotificationsScreen.tsx # View and manage notifications
│   └── QRCodeScreen.tsx       # QR code for connecting
├── state/
│   ├── userStore.ts           # User profile & auth state
│   ├── wishStore.ts           # Wishes, wish lists, portfolios
│   ├── connectionStore.ts     # Connections & chats
│   └── notificationStore.ts   # Notification management
├── types/
│   └── wishy.ts               # TypeScript types
└── utils/
    └── cn.ts                  # Tailwind class merge utility
```

## Color Palette

Based on the Wishy brand logo:

```javascript
wishy: {
  pink: "#FFB6D9",        // Main brand pink from logo
  darkPink: "#FF8DC7",    // Slightly darker pink accent
  black: "#000000",       // Logo text/stars, primary actions
  white: "#FFFFFF",       // Pure white background
  lightPink: "#FFC9E0",   // Lighter tint
  paleBlush: "#FFE5F1",   // Very pale pink for subtle backgrounds
  gray: "#6B7280",        // Neutral gray for secondary text
  darkGray: "#374151",    // Dark gray for text
}
```

## Screens Overview

1. **Welcome**: Animated intro with feature highlights
2. **Role Selection**: Choose how you want to use Wishy
3. **Profile Setup**: Add your details and interests
4. **Landing Page**: Quick action hub to get started (appears after profile setup)
   - **Esprimi un Desiderio**: Create a wish for yourself
   - **Proponi un Desiderio**: Create an offer for others
   - **Esplora i Desideri**: Browse the discovery feed
5. **Discovery Tab (Wishy Stage)**: View wishes sent to you
   - Shows received wishes with sender information
   - Tap sender profile to view their full profile
   - Category filters for easy navigation
6. **My Wishes Tab**: Toggle between "For Me", "For Others", and "Received"
7. **Connections Tab**: QR sharing and connection management
8. **Profile Tab**: View profile, notifications, settings, logout

## Future Enhancements

- Wishy Store (provider/brand partnerships)
- Magic Wand physical QR device integration
- Wishy Party event mode
- AI-powered Wishy Match recommendations
- Love Match premium compatibility features
- Rating and review system
- Push notifications
