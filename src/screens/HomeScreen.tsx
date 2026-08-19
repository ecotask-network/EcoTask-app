import React from 'react';
import { View, Text, Button, FlatList } from 'react-native';
import { usePendingProofs } from '../hooks/usePendingProofs';

export const HomeScreen = () => {
  // Only use the lightweight hook for pending proofs
  const { pendingCount, isSyncing, syncPendingProofs, syncError } = usePendingProofs();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      
      {/* Sync banner - uses only what's needed */}
      {pendingCount > 0 && (
        <View style={styles.syncBanner}>
          <Text>
            {isSyncing ? 'Syncing...' : `${pendingCount} pending proof(s) to sync`}
          </Text>
          {!isSyncing && (
            <Button title="Sync Now" onPress={syncPendingProofs} />
          )}
          {syncError && (
            <Text style={styles.error}>{syncError}</Text>
          )}
        </View>
      )}

      {/* Rest of HomeScreen content */}
      <FlatList
        data={[]}
        renderItem={() => null}
        keyExtractor={() => ''}
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
  syncBanner: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 16,
  },
  error: {
    color: 'red',
    marginTop: 8,
  },
};
