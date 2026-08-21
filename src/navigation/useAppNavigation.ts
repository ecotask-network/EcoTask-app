import { useNavigation } from '@react-navigation/native';
import type {
  RootScreenNavigationProp,
  TabScreenNavigationProp,
  TaskStackScreenNavigationProp,
} from './types';

/**
 * Typed `useNavigation` wrappers, one per position in the navigator tree.
 *
 * Screens call these instead of `useNavigation<...>()` so the generic is
 * written once, in the same file as the types it refers to. That keeps a
 * screen from quietly widening its own navigation type back to `any`, which is
 * what these replace.
 */

/** For a screen rendered directly by the root stack. */
export const useRootNavigation = () =>
  useNavigation<RootScreenNavigationProp>();

/** For a screen rendered as a tab. */
export const useTabNavigation = () => useNavigation<TabScreenNavigationProp>();

/** For a screen rendered inside the task stack. */
export const useTaskStackNavigation = () =>
  useNavigation<TaskStackScreenNavigationProp>();
