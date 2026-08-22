import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors, spacing } from '../utils/theme';
import { useUserStore } from '../store/userStore';
import { updateProfile } from '../services/api';
import { useRootNavigation } from '../navigation/useAppNavigation';

export default function EditProfileScreen() {
  const navigation = useRootNavigation();
  const { profile, setProfile } = useUserStore();

  const [name, setName] = useState(profile?.name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        bio: bio.trim() || undefined,
      });

      if (profile) {
        setProfile({
          ...profile,
          name: updated.name || name.trim(),
          bio: updated.bio || bio.trim() || undefined,
        });
      }

      navigation.goBack();
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'Could not update profile',
      );
    } finally {
      setIsSaving(false);
    }
  }, [name, bio, profile, setProfile, navigation]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl * 2,
            paddingBottom: spacing.lg,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={{
              alignSelf: 'flex-start',
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              marginLeft: -spacing.md,
              marginBottom: spacing.md,
              minHeight: 44,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>

          <Text
            style={{
              color: colors.text,
              fontSize: 24,
              fontWeight: 'bold',
              marginBottom: spacing.xl,
            }}
          >
            Edit Profile
          </Text>

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginBottom: spacing.sm,
            }}
          >
            Display Name
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              color: colors.text,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: spacing.lg,
            }}
          />

          <Text
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              marginBottom: spacing.sm,
            }}
          >
            Bio
          </Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Tell others about yourself"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: spacing.md,
              color: colors.text,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: spacing.lg,
              minHeight: 100,
            }}
          />

          <TouchableOpacity
            onPress={() => void handleSave()}
            disabled={isSaving}
            style={{
              padding: spacing.md,
              backgroundColor: colors.primary,
              borderRadius: 12,
              alignItems: 'center',
              opacity: isSaving ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#FFF', fontWeight: '600', fontSize: 16 }}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
