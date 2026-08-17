import { useTaskStore } from '../store/taskStore';
import {
  isSelectionFresh,
  buildSubmitProofParams,
} from '../utils/taskSelection';

/**
 * The tab bar can't pass route params, so this listener intercepts the
 * Submit tabPress: if there's a fresh selectedTask it jumps straight to
 * SubmitProofScreen (bubbling up to the root stack's route) with that
 * task's params; otherwise it lets the default tab navigation proceed to
 * the SubmitScreen fallback.
 */
export function createSubmitTabPressHandler(navigation: {
  navigate: (name: string, params?: object) => void;
}) {
  return (e: { preventDefault: () => void }) => {
    const { selectedTask, selectedAt } = useTaskStore.getState();
    if (selectedTask && isSelectionFresh(selectedAt)) {
      e.preventDefault();
      navigation.navigate('SubmitProof', buildSubmitProofParams(selectedTask));
    }
  };
}
