import React from 'react';
import { useActivityStore } from '../store/activityStore';
import { useProofStatus } from '../hooks/useProofStatus';
import { Activity } from '../types';

function PendingProofPoller({ activity }: { activity: Activity }) {
  // Mount the useProofStatus hook for this specific activity.
  // It will initialize polling and respect its own internal timers/backoff.
  useProofStatus(activity.proofId!, {
    activityId: activity.id,
    taskTitle: activity.taskTitle,
    rewardToken: activity.rewardToken,
  });
  
  return null;
}

export default function PendingProofsPollManager() {
  const activities = useActivityStore(s => s.activities);
  
  // Filter for activities that are 'pending' and have a 'proofId'
  const pendingActivities = activities.filter(
    a => a.status === 'pending' && a.proofId != null
  );

  return (
    <>
      {pendingActivities.map(activity => (
        <PendingProofPoller key={activity.id} activity={activity} />
      ))}
    </>
  );
}
