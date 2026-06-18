import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TaskListScreen from '../screens/TaskListScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import SubmitProofScreen from '../screens/SubmitProofScreen';

export type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
  SubmitProof: { taskId: string };
};

const Stack = createNativeStackNavigator<TaskStackParamList>();

export default function TaskStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TaskList" component={TaskListScreen} />
      <Stack.Screen name="TaskDetail" component={TaskDetailScreen} />
      <Stack.Screen name="SubmitProof" component={SubmitProofScreen} />
    </Stack.Navigator>
  );
}
