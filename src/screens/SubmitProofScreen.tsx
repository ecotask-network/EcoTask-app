import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import {
  useCameraPermission,
  useCameraDevice,
  Camera,
} from 'react-native-vision-camera';
import { colors, spacing } from '../utils/theme';
import { useLocation } from '../hooks/useLocation';
import { useProofSubmit } from '../hooks/useProofSubmit';
import { useProofStatus } from '../hooks/useProofStatus';
import { useActivityStore } from '../store/activityStore';
import { useUserStore } from '../store/userStore';
import { computeImpact } from '../utils/impact';
import { SubmitProofParams } from '../types';
import EmptyState from '../components/EmptyState';
import {
  scheduleLocalNotification,
  NOTIFICATION_TYPES,
} from '../services/notifications';
import { useTaskStackNavigation } from '../navigation/useAppNavigation';

type SubmitProofRoute = RouteProp<
  { SubmitProof: SubmitProofParams },
  'SubmitProof'
>;

export default function SubmitProofScreen() {
  const route = useRoute<SubmitProofRoute>();
  const navigation = useTaskStackNavigation();
  const { taskId } = route.params;
  const cameraRef = useRef<Camera>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<string | null>(null);
  // proofId returned by the backend after a successful POST; drives polling.
  const [proofId, setProofId] = useState<string | null>(null);
  // Local activity id created on submit; used to link useProofStatus updates.
  const [activityId, setActivityId] = useState<string | null>(null);

  const { location, error: locationError } = useLocation();
  const { submit, isSubmitting, progress, error } = useProofSubmit();
  const addActivity = useActivityStore(s => s.addActivity);
  const updateActivityStatus = useActivityStore(s => s.updateActivityStatus);
  const updateStats = useUserStore(s => s.updateStats);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  // Poll the backend for the real verification outcome.
  useProofStatus(proofId, {
    activityId: activityId ?? '',
    taskTitle: route.params.taskTitle ?? 'Task Completed',
    rewardToken: route.params.rewardToken ?? 'ECO',
  });

  useEffect(() => {
    if (!hasPermission) {
      void requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) {
      return;
    }
    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });
      setPhotoUri(`file://${photo.path}`);
      setCapturedAt(new Date().toISOString());
    } catch (err) {
      Alert.alert(
        'Camera Error',
        err instanceof Error ? err.message : 'Failed to capture photo',
      );
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!photoUri || !capturedAt) {
      Alert.alert('Error', 'Please take a photo first');
      return;
    }
    const submission = await submit(
      taskId,
      photoUri,
      capturedAt,
      location?.lat,
      location?.lng,
    );

    if (submission.status === 'success') {
      const result = submission.result;
      // Store the activity immediately as 'pending'; useProofStatus will
      // patch it to 'confirmed' or 'failed' once the backend verifies.
      const newActivityId = Date.now().toString();
      const returnedProofId: string | undefined = result.proofId;

      addActivity({
        id: newActivityId,
        taskId,
        taskTitle:
          result.taskTitle || route.params.taskTitle || 'Task Completed',
        taskType: result.taskType || route.params.taskType || 'OTHER',
        rewardAmount: result.rewardAmount ?? route.params.rewardAmount ?? 0,
        rewardToken: result.rewardToken || route.params.rewardToken || 'ECO',
        completedAt: new Date().toISOString(),
        status: 'pending',
        proofId: returnedProofId,
      });

      // Update environmental impact stats eagerly (optimistic).
      const stats = useUserStore.getState().profile?.stats;
      if (stats) {
        const impact = computeImpact(
          result.taskType || route.params.taskType || 'OTHER',
        );
        updateStats(impact);
      }

      setActivityId(newActivityId);
      // Kick off polling only when the backend returned a proofId.
      if (returnedProofId) {
        setProofId(returnedProofId);
      } else {
        // No proofId from backend — mark confirmed immediately (legacy path).
        updateActivityStatus(newActivityId, 'confirmed', result.rewardAmount);
        // Fire reward notification for the legacy path; the polling path
        // (useProofStatus) handles its own notification on the confirmed event.
        const amount = result.rewardAmount ?? route.params.rewardAmount ?? 0;
        const token = result.rewardToken || route.params.rewardToken || 'ECO';
        const title =
          result.taskTitle || route.params.taskTitle || 'Task Completed';
        void scheduleLocalNotification({
          title: 'Reward confirmed! 🎉',
          body: `You earned ${amount} ${token} for "${title}".`,
          type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
          data: {
            type: NOTIFICATION_TYPES.REWARD_CONFIRMED,
            activityId: newActivityId,
            deepLink: 'ecotask://wallet',
          },
        });
      }

      // The proof was submitted, but IPFS pinning failed (and retried) so it is
      // not yet available on IPFS. Inform the user it will be retried.
      if (submission.ipfsPending) {
        Alert.alert('Proof saved', 'Proof saved, IPFS upload pending');
      }
    } else if (submission.status === 'queued') {
      // Offline / network failure: stored in the proof queue as pending.
      addActivity({
        id: Date.now().toString(),
        taskId,
        taskTitle: route.params.taskTitle || 'Task queued offline',
        taskType: route.params.taskType || 'OTHER',
        rewardAmount: 0,
        rewardToken: route.params.rewardToken || 'ECO',
        completedAt: new Date().toISOString(),
        status: 'pending',
      });
      Alert.alert('Proof queued', submission.error);
    } else {
      Alert.alert('Submission failed', submission.error);
    }
  }, [
    photoUri,
    capturedAt,
    taskId,
    location,
    submit,
    addActivity,
    updateActivityStatus,
    updateStats,
    route.params,
  ]);

  const progressLabels: Record<string, string> = {
    uploading: 'Uploading proof...',
    verifying: proofId
      ? 'Verifying proof — reward pending...'
      : 'Verifying with network...',
    confirmed: 'Reward confirmed!',
    failed: 'Upload failed',
  };

  if (!taskId) {
    return (
      <EmptyState
        icon="📋"
        title="Select a task first"
        description="Browse available tasks"
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: spacing.lg, paddingTop: spacing.xl }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, fontSize: 16 }}>Back</Text>
        </TouchableOpacity>
        <Text
          style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: 'bold',
            marginTop: spacing.md,
          }}
        >
          Submit Proof
        </Text>
      </View>

      <View
        style={{
          flex: 1,
          margin: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        ) : device && hasPermission ? (
          <Camera
            ref={cameraRef}
            style={{ width: '100%', height: '100%' }}
            device={device}
            isActive={true}
            photo={true}
          />
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 64 }}>📷</Text>
            <Text
              style={{ color: colors.textSecondary, marginTop: spacing.md }}
            >
              {hasPermission === false
                ? 'Camera permission required'
                : 'No camera available'}
            </Text>
            {hasPermission === false && (
              <TouchableOpacity
                onPress={() => void requestPermission()}
                style={{ marginTop: spacing.md, padding: spacing.sm }}
              >
                <Text style={{ color: colors.primary }}>Grant Permission</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <Text style={{ fontSize: 16 }}>{location ? '' : ''}</Text>
        <Text
          style={{
            color: colors.textSecondary,
            marginLeft: spacing.sm,
            fontSize: 12,
          }}
        >
          {location
            ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
            : locationError || 'Getting location...'}
        </Text>
      </View>

      {progress !== 'idle' && (
        <Text
          style={{
            color:
              progress === 'confirmed'
                ? colors.primary
                : progress === 'failed'
                  ? colors.error
                  : colors.text,
            textAlign: 'center',
            marginBottom: spacing.sm,
          }}
        >
          {progressLabels[progress]}
        </Text>
      )}

      {error && (
        <Text
          style={{
            color: colors.error,
            textAlign: 'center',
            fontSize: 12,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
          }}
        >
          {error}
        </Text>
      )}

      <View
        style={{ padding: spacing.lg, flexDirection: 'row', gap: spacing.sm }}
      >
        {!photoUri ? (
          <TouchableOpacity
            onPress={() => void handleCapture()}
            disabled={isSubmitting}
            style={{
              flex: 1,
              padding: spacing.md,
              backgroundColor: colors.primary,
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>
              {isSubmitting ? '...' : 'Take Photo'}
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => {
                setPhotoUri(null);
                setCapturedAt(null);
                // Clear stale submission state so useProofStatus stops
                // polling the old proof and no duplicate activity is
                // created on recapture + resubmit.
                setProofId(null);
                setActivityId(null);
              }}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: spacing.md,
                backgroundColor: colors.surface,
                borderRadius: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void handleSubmit()}
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: 12,
                alignItems: 'center',
                opacity: isSubmitting ? 0.5 : 1,
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '600' }}>
                {isSubmitting ? 'Submitting...' : 'Submit Proof'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}
