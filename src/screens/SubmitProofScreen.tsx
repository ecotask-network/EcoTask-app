import React, { useState } from 'react';
import { View, Text, TextInput, Button, ActivityIndicator } from 'react-native';
import { useProofSubmit } from '../hooks/useProofSubmit';

export const SubmitProofScreen = () => {
  const [proofText, setProofText] = useState('');
  const { submit, isSubmitting, progress, error, pendingCount } = useProofSubmit();

  const handleSubmit = async () => {
    if (!proofText.trim()) return;

    try {
      await submit({
        proof: proofText,
        // Additional proof data
      });
      // Success - navigate back or show success
      setProofText('');
    } catch (err) {
      // Error is handled by the hook
      console.error('Submission failed:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Submit Proof</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your proof..."
        value={proofText}
        onChangeText={setProofText}
        multiline
        editable={!isSubmitting}
      />

      {isSubmitting && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" />
          <Text>
            {progress.total > 0
              ? `Submitting... ${progress.current}/${progress.total}`
              : 'Submitting...'}
          </Text>
        </View>
      )}

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      {pendingCount > 0 && (
        <Text style={styles.pending}>
          {pendingCount} proof(s) pending sync
        </Text>
      )}

      <Button
        title="Submit Proof"
        onPress={handleSubmit}
        disabled={isSubmitting || !proofText.trim()}
      />
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    minHeight: 120,
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  error: {
    color: 'red',
    marginBottom: 16,
  },
  pending: {
    color: '#666',
    marginBottom: 16,
  },
};
