import { useState, useCallback } from "react";
import { submitProof } from "../services/api";
import { MMKV } from "react-native-mmkv";

const offlineStorage = new MMKV({ id: "proof-queue" });

interface PendingProof {
  id: string;
  taskId: string;
  photoPath: string;
  lat?: number;
  lng?: number;
  createdAt: string;
}

export function useProofSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState<"idle" | "uploading" | "verifying" | "confirmed" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const saveOffline = useCallback((proof: PendingProof) => {
    const existing = JSON.parse(offlineStorage.getString("pending_proofs") || "[]");
    existing.push(proof);
    offlineStorage.set("pending_proofs", JSON.stringify(existing));
  }, []);

  const submit = useCallback(async (
    taskId: string,
    photoUri: string,
    lat?: number,
    lng?: number
  ) => {
    setIsSubmitting(true);
    setProgress("uploading");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("taskId", taskId);
      if (lat !== undefined && lng !== undefined) {
        formData.append("lat", String(lat));
        formData.append("lng", String(lng));
      }
      formData.append("photos", {
        uri: photoUri,
        type: "image/jpeg",
        name: "proof.jpg",
      } as any);

      setProgress("verifying");
      const result = await submitProof(formData);
      setProgress("confirmed");
      return result;
    } catch (err: any) {
      saveOffline({ id: Date.now().toString(), taskId, photoPath: photoUri, lat, lng, createdAt: new Date().toISOString() });
      setError(err.message || "Upload failed, saved for later");
      setProgress("failed");
    } finally {
      setIsSubmitting(false);
    }
  }, [saveOffline]);

  const syncPendingProofs = useCallback(async () => {
    const pending = JSON.parse(offlineStorage.getString("pending_proofs") || "[]");
    if (pending.length === 0) return;

    const remaining: PendingProof[] = [];
    for (const proof of pending) {
      try {
        await submit(proof.taskId, proof.photoPath, proof.lat, proof.lng);
      } catch {
        remaining.push(proof);
      }
    }
    offlineStorage.set("pending_proofs", JSON.stringify(remaining));
  }, [submit]);

  return { submit, syncPendingProofs, isSubmitting, progress, error };
}
