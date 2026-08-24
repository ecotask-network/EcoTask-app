import { SubmitProofParams, Task } from '../types';

/** How long a selected task stays "active" for the Submit tab shortcut. */
export const SELECTION_FRESHNESS_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a task selected at `selectedAt` is still recent enough to jump
 * straight into SubmitProofScreen from the Submit tab.
 */
export function isSelectionFresh(
  selectedAt: string | null,
  now = Date.now(),
): boolean {
  if (!selectedAt) {
    return false;
  }
  const selectedAtMs = new Date(selectedAt).getTime();
  if (Number.isNaN(selectedAtMs)) {
    return false;
  }
  return now - selectedAtMs < SELECTION_FRESHNESS_MS;
}

export function buildSubmitProofParams(task: Task): SubmitProofParams {
  return {
    taskId: task.id,
    taskTitle: task.title,
    taskType: task.type,
    rewardAmount: task.rewardAmount,
    rewardToken: task.rewardToken || 'ECO',
  };
}
