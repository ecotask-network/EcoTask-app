import React, { useCallback } from 'react';
import { View, Text, FlatList, Button, StyleSheet } from 'react-native';
import { EarningsSummary } from '../components/EarningsSummary';
import { useActivityStore } from '../stores/activityStore';

export const HomeScreen = () => {
  const activities = useActivityStore((state) => state.activities);
  const addActivity = useActivityStore((state) => state.addActivity);

  const handleAddActivity = useCallback(() => {
    const taskTypes = ['Task A', 'Task B', 'Task C', 'Task D'];
    const randomType = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    const randomReward = Math.floor(Math.random() * 50) + 10;

    addActivity({
      taskType: randomType,
      reward: randomReward,
      status: 'completed',
    });
  }, [addActivity]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Home</Text>
      
      <Button title="Add Activity" onPress={handleAddActivity} />

      {/* EarningsSummary only re-renders when activities content changes */}
      <EarningsSummary activities={activities} />

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.activityItem}>
            <Text>{item.taskType}</Text>
            <Text>${item.reward.toFixed(2)}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No activities yet</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6c757d',
    marginTop: 20,
  },
});
