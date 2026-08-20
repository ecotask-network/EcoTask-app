import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TaskListScreen from '../screens/TaskListScreen';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import SubmitProofScreen from '../screens/SubmitProofScreen';
import { SubmitProofParams } from '../types';

// react-navigation's typed hooks require ParamList to satisfy an implicit
// index signature, which only object-literal `type` aliases provide (not
// `interface`) — https://reactnavigation.org/docs/typescript
export type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
  SubmitProof: SubmitProofParams;
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
