import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { SubmitProofParams } from '../types';

/**
 * Navigator param lists and the navigation prop types built from them.
 *
 * These live here rather than beside each navigator because every screen needs
 * them: importing `RootStackParamList` from `RootNavigator` would be circular,
 * since `RootNavigator` imports the screens.
 */

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Profile: undefined;
  EditProfile: undefined;
  TaskDetail: { taskId: string };
  SubmitProof: SubmitProofParams;
  SendTokens: undefined;
  NotificationPreferences: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Map: undefined;
  Submit: undefined;
  Wallet: undefined;
};

export type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
  SubmitProof: SubmitProofParams;
  Map: undefined;
};

/**
 * The navigators nest: root stack → `Main` tab navigator → `Tasks` task stack.
 * A screen can navigate to anything in its own navigator *or* in any ancestor,
 * so each prop type below composes exactly the navigators reachable from where
 * that screen is rendered. Using a wider type than a screen's real position
 * would let a navigation call compile that fails at runtime.
 */

/** A screen rendered directly by the root stack. */
export type RootScreenNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;

/** A screen rendered as a tab: reaches its sibling tabs and the root stack. */
export type TabScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

/** A screen inside the task stack: reaches the task stack, tabs, and root. */
export type TaskStackScreenNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<TaskStackParamList>,
  TabScreenNavigationProp
>;

/**
 * A deep-link destination.
 *
 * A discriminated union rather than `{ screen: keyof RootStackParamList;
 * params?: Record<string, unknown> }`: that shape says nothing about which
 * params belong to which screen, so `{ screen: 'TaskDetail' }` with no
 * `taskId` type-checks and then fails at runtime. Here each variant carries
 * exactly the params its screen declares.
 */
export type DeepLinkTarget =
  | { screen: 'Main' }
  | { screen: 'NotificationPreferences' }
  | { screen: 'TaskDetail'; params: RootStackParamList['TaskDetail'] };
