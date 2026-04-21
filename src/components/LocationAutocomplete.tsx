import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY || "";

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface LocationAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectLocation: (location: string, placeId?: string) => void;
  placeholder?: string;
}

export default function LocationAutocomplete({
  value,
  onChangeText,
  onSelectLocation,
  placeholder = "Search for a location...",
}: LocationAutocompleteProps) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const fetchPredictions = useCallback(async (input: string) => {
    if (!input.trim() || input.length < 2) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);

    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&types=establishment|geocode&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === "OK" && data.predictions) {
        setPredictions(data.predictions);
        setShowSuggestions(true);
      } else if (data.status === "ZERO_RESULTS") {
        setPredictions([]);
        setShowSuggestions(false);
      } else {
        console.log("Places API error:", data.status, data.error_message);
        setPredictions([]);
      }
    } catch (error) {
      console.log("Error fetching predictions:", error);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    const timer = setTimeout(() => {
      fetchPredictions(value);
    }, 300);

    setDebounceTimer(timer);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [value]);

  const handleSelectPrediction = (prediction: PlacePrediction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelectLocation(prediction.description, prediction.place_id);
    onChangeText(prediction.description);
    setShowSuggestions(false);
    setPredictions([]);
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeText("");
    setPredictions([]);
    setShowSuggestions(false);
  };

  return (
    <View>
      {/* Input Field */}
      <View className="flex-row items-center bg-white rounded-xl border border-wishy-paleBlush">
        <View className="pl-4">
          <Ionicons name="location-outline" size={20} color="#8B2252" />
        </View>
        <TextInput
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            if (!text.trim()) {
              setShowSuggestions(false);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor="#9A8A8A"
          className="flex-1 p-4 text-wishy-black text-base"
          onFocus={() => {
            if (predictions.length > 0) {
              setShowSuggestions(true);
            }
          }}
        />
        {isLoading ? (
          <View className="pr-4">
            <ActivityIndicator size="small" color="#8B2252" />
          </View>
        ) : value.length > 0 ? (
          <Pressable onPress={handleClear} className="pr-4">
            <Ionicons name="close-circle" size={20} color="#9A8A8A" />
          </Pressable>
        ) : null}
      </View>

      {/* Suggestions List - Inline (better for ScrollView) */}
      {showSuggestions && predictions.length > 0 && (
        <Animated.View
          entering={FadeInDown.duration(200)}
          exiting={FadeOut.duration(150)}
          className="mt-2 bg-white rounded-xl border border-wishy-paleBlush overflow-hidden"
        >
          {predictions.map((item, index) => (
            <Pressable
              key={item.place_id}
              onPress={() => handleSelectPrediction(item)}
              className={`flex-row items-center p-3 active:bg-wishy-paleBlush/30 ${
                index < predictions.length - 1 ? "border-b border-wishy-paleBlush" : ""
              }`}
            >
              <View className="w-10 h-10 bg-wishy-paleBlush rounded-full items-center justify-center mr-3">
                <Ionicons name="location" size={18} color="#8B2252" />
              </View>
              <View className="flex-1">
                <Text className="text-wishy-black font-medium text-sm" numberOfLines={1}>
                  {item.structured_formatting?.main_text || item.description}
                </Text>
                {item.structured_formatting?.secondary_text && (
                  <Text className="text-wishy-gray text-xs mt-0.5" numberOfLines={1}>
                    {item.structured_formatting.secondary_text}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9A8A8A" />
            </Pressable>
          ))}
          {/* Google Attribution */}
          <View className="p-2 bg-gray-50 border-t border-wishy-paleBlush">
            <Text className="text-wishy-gray text-xs text-center">
              Powered by Google
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
