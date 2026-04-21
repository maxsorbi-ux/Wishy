import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";

interface WishyLogoProps {
  size?: number;
}

export default function WishyLogo({ size = 180 }: WishyLogoProps) {
  return (
    <View style={{ width: size, height: size, overflow: "hidden" }}>
      <Image
        source={require("../../assets/wishy-logo.jpeg")}
        style={[
          {
            width: size,
            height: size,
          },
          styles.logo,
        ]}
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    // Usa mix-blend-mode per far sembrare che il nero sia trasparente sul rosa
    // In React Native possiamo usare tintColor per le immagini
  },
});
