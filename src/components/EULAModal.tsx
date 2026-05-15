import React from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface EULAModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function EULAModal({ visible, onClose }: EULAModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-white" style={{ paddingTop: insets.top > 0 ? insets.top : 16 }}>
        <View className="flex-row items-center justify-between px-6 py-4 border-b border-wishy-paleBlush">
          <Text className="text-xl font-bold text-wishy-black">Terms of Service</Text>
          <Pressable
            onPress={onClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-wishy-paleBlush active:opacity-70"
          >
            <Ionicons name="close" size={20} color="#000000" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingVertical: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-wishy-black font-bold text-base mb-1">Last updated: May 2025</Text>
          <Text className="text-wishy-gray text-sm mb-6">
            By creating an account on Wishy, you agree to the following Terms of Service and Community Guidelines.
          </Text>

          <SectionTitle>1. Zero Tolerance for Objectionable Content</SectionTitle>
          <SectionBody>
            Wishy has a strict zero-tolerance policy for objectionable content. You may not post, send, or share any of the following:
          </SectionBody>
          <BulletList items={[
            "Harassment, bullying, or threats of any kind",
            "Hate speech or content that discriminates based on race, ethnicity, religion, gender, sexual orientation, or disability",
            "Sexually explicit, pornographic, or graphic violent content",
            "Spam, scams, or deceptive content",
            "Content that promotes illegal activities",
            "Content that violates another person's privacy",
          ]} />

          <SectionTitle>2. Zero Tolerance for Abusive Users</SectionTitle>
          <SectionBody>
            Users who engage in abusive behavior toward other members of the Wishy community will be permanently removed from the platform without notice. Abusive behavior includes, but is not limited to, harassment, impersonation, threats, and sending objectionable content.
          </SectionBody>

          <SectionTitle>3. Reporting Objectionable Content</SectionTitle>
          <SectionBody>
            You can report any message that violates these guidelines by long-pressing the message in chat and selecting "Report Message." You can also report a user directly from the chat options menu. All reports are reviewed by our team.
          </SectionBody>

          <SectionTitle>4. Blocking Abusive Users</SectionTitle>
          <SectionBody>
            You may block any user at any time to immediately prevent them from contacting you or viewing your content. To block a user, use the options menu in any chat or from their profile page. Blocking takes effect immediately.
          </SectionBody>

          <SectionTitle>5. Our 24-Hour Commitment</SectionTitle>
          <SectionBody>
            We commit to reviewing all reports of objectionable content or abusive behavior within 24 hours of submission. Content that violates our guidelines will be removed, and users found to have provided offending content will be ejected from the platform.
          </SectionBody>

          <SectionTitle>6. Content Filtering</SectionTitle>
          <SectionBody>
            Wishy automatically filters messages for known objectionable language. This system is designed to protect our community and does not replace human moderation.
          </SectionBody>

          <SectionTitle>7. Age Requirement</SectionTitle>
          <SectionBody>
            You must be at least 18 years old to use Wishy. By creating an account, you confirm that you meet this age requirement.
          </SectionBody>

          <SectionTitle>8. Account Termination</SectionTitle>
          <SectionBody>
            We reserve the right to terminate any account at our discretion for violation of these Terms of Service, with or without notice. Repeated or severe violations will result in a permanent ban.
          </SectionBody>

          <SectionTitle>9. Privacy</SectionTitle>
          <SectionBody>
            Your use of Wishy is subject to our Privacy Policy, which is incorporated into these Terms of Service by reference.
          </SectionBody>

          <View className="mt-4 p-4 bg-wishy-paleBlush rounded-2xl">
            <Text className="text-wishy-black text-sm font-semibold text-center">
              By tapping "I Agree" on the registration screen, you confirm you have read and agree to these Terms of Service and Community Guidelines.
            </Text>
          </View>
        </ScrollView>

        <View
          className="px-6 py-4 border-t border-wishy-paleBlush bg-white"
          style={{ paddingBottom: insets.bottom + 8 }}
        >
          <Pressable
            onPress={onClose}
            className="bg-wishy-black rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="text-wishy-black font-bold text-base mt-5 mb-2">{children}</Text>
  );
}

function SectionBody({ children }: { children: string }) {
  return (
    <Text className="text-wishy-gray text-sm leading-5 mb-2">{children}</Text>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View className="ml-2 mb-2">
      {items.map((item, index) => (
        <View key={index} className="flex-row mb-1">
          <Text className="text-wishy-gray text-sm mr-2">{"•"}</Text>
          <Text className="text-wishy-gray text-sm leading-5 flex-1">{item}</Text>
        </View>
      ))}
    </View>
  );
}
