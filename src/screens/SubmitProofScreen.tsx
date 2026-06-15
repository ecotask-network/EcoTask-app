import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, Alert } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { useCameraPermission, useCameraDevice, Camera } from "react-native-vision-camera";
import { colors, spacing } from "../utils/theme";
import { useLocation } from "../hooks/useLocation";
import { useProofSubmit } from "../hooks/useProofSubmit";
import WalletBalance from "../components/WalletBalance";

type SubmitProofRoute = RouteProp<{ SubmitProof: { taskId: string } }, "SubmitProof">;

export default function SubmitProofScreen() {
  const route = useRoute<SubmitProofRoute>();
  const navigation = useNavigation();
  const { taskId } = route.params;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const { location, error: locationError, refresh: refreshLocation } = useLocation();
  const { submit, isSubmitting, progress, error } = useProofSubmit();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice("back");

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, []);

  const handleCapture = useCallback(async () => {
    Alert.alert("Camera", "Photo captured (mock)", [
      { text: "OK", onPress: () => setPhotoUri("mock-photo-uri") },
    ]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!photoUri) {
      Alert.alert("Error", "Please take a photo first");
      return;
    }
    await submit(taskId, photoUri, location?.lat, location?.lng);
  }, [photoUri, taskId, location, submit]);

  const progressLabels: Record<string, string> = {
    uploading: "Uploading proof...",
    verifying: "Verifying with network...",
    confirmed: "Reward confirmed!",
    failed: "Upload failed",
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "bold", marginTop: spacing.md }}>
          Submit Proof
        </Text>
      </View>

      <View style={{
        flex: 1,
        margin: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 64 }}></Text>
            <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>
              {device ? "Tap to take a photo" : "No camera available"}
            </Text>
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
        <Text style={{ fontSize: 16 }}>{location ? "" : ""}</Text>
        <Text style={{ color: colors.textSecondary, marginLeft: spacing.sm, fontSize: 12 }}>
          {location
            ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
            : locationError || "Getting location..."}
        </Text>
      </View>

      {progress !== "idle" && (
        <Text style={{
          color: progress === "confirmed" ? colors.primary : progress === "failed" ? colors.error : colors.text,
          textAlign: "center",
          marginBottom: spacing.sm,
        }}>
          {progressLabels[progress]}
        </Text>
      )}

      {error && (
        <Text style={{ color: colors.error, textAlign: "center", fontSize: 12, marginHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          {error}
        </Text>
      )}

      <View style={{ padding: spacing.lg, flexDirection: "row", gap: spacing.sm }}>
        {!photoUri ? (
          <TouchableOpacity
            onPress={handleCapture}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: spacing.md,
              backgroundColor: colors.primary,
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 16 }}>
              {isSubmitting ? "..." : "Take Photo"}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setPhotoUri(null)}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: 12,
                alignItems: "center",
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "600" }}>
                {isSubmitting ? "Submitting..." : "Submit Proof"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
