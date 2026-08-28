import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import { colors } from '../utils/theme';

jest.mock('../navigation/useAppNavigation', () => ({
  useTabNavigation: jest.fn(),
}));

jest.mock('../store/userStore', () => ({
  useUserStore: jest.fn(),
}));

jest.mock('../store/activityStore', () => ({
  useActivityStore: jest.fn(),
}));

jest.mock('../store/walletStore', () => ({
  useWalletStore: jest.fn(),
}));

jest.mock('../hooks/useProofSubmit', () => ({
  useProofSubmit: jest.fn(),
}));

jest.mock('../components/EarningsSummary', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('../components/StreakCard', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('../components/PendingProofsBanner', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('../components/ImpactStats', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('../components/PublicKeyDisplay', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

import HomeScreen from '../screens/HomeScreen';
import { useTabNavigation } from '../navigation/useAppNavigation';
import { useUserStore } from '../store/userStore';
import { useActivityStore } from '../store/activityStore';
import { useWalletStore } from '../store/walletStore';
import { useProofSubmit } from '../hooks/useProofSubmit';
import StreakCard from '../components/StreakCard';
import PendingProofsBanner from '../components/PendingProofsBanner';

const mockUseTabNavigation = useTabNavigation as unknown as jest.Mock;
const mockUseUserStore = useUserStore as unknown as jest.Mock;
const mockUseActivityStore = useActivityStore as unknown as jest.Mock;
const mockUseWalletStore = useWalletStore as unknown as jest.Mock;
const mockUseProofSubmit = useProofSubmit as unknown as jest.Mock;
const MockStreakCard = StreakCard as unknown as jest.Mock;
const MockPendingProofsBanner = PendingProofsBanner as unknown as jest.Mock;

interface ActivitySeed {
  id: string;
  status: 'confirmed' | 'pending' | 'failed';
  taskType: string;
  taskTitle: string;
  completedAt: string;
  rewardAmount: number;
  rewardToken: string;
}

function makeActivity(seed: ActivitySeed) {
  return {
    taskType: seed.taskType,
    taskTitle: seed.taskTitle,
    completedAt: seed.completedAt,
    rewardAmount: seed.rewardAmount,
    rewardToken: seed.rewardToken,
    status: seed.status,
    id: seed.id,
  };
}

function flattenText(children: unknown): string {
  if (children === null || children === undefined) {
    return '';
  }
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(flattenText).join('');
  }
  return '';
}

function textOf(t: renderer.ReactTestInstance): string {
  return flattenText(t.props.children);
}

function findButtonByText(
  root: renderer.ReactTestRenderer['root'],
  label: string,
) {
  return root
    .findAllByType(TouchableOpacity)
    .find(btn => btn.findAllByType(Text).some(t => textOf(t) === label));
}

function findText(root: renderer.ReactTestRenderer['root'], text: string) {
  return root.findAllByType(Text).find(t => textOf(t) === text);
}

describe('HomeScreen', () => {
  let activityState: {
    activities: ReturnType<typeof makeActivity>[];
    streak: number;
    bestStreak: number;
    recomputeStreaks: jest.Mock;
  };
  let navigate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    activityState = {
      activities: [],
      streak: 5,
      bestStreak: 10,
      recomputeStreaks: jest.fn(),
    };
    navigate = jest.fn();

    mockUseActivityStore.mockImplementation(
      (selector: (s: typeof activityState) => unknown) =>
        selector(activityState),
    );
    mockUseUserStore.mockReturnValue({
      profile: { name: 'Ada Lovelace' },
    });
    mockUseWalletStore.mockReturnValue({
      publicKey: 'GABC',
      ecoBalance: '120',
    });
    mockUseProofSubmit.mockReturnValue({
      pendingCount: 0,
      isSubmitting: false,
      syncPendingProofs: jest.fn(),
    });
    mockUseTabNavigation.mockReturnValue({ navigate });
  });

  function render() {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<HomeScreen />);
    });
    return tree;
  }

  it('renders a greeting', () => {
    const tree = render();
    const greetings = ['Good morning', 'Good afternoon', 'Good evening'];
    const hasGreeting = tree.root
      .findAllByType(Text)
      .some(t => greetings.some(g => textOf(t).includes(g)));
    expect(hasGreeting).toBe(true);
  });

  it('renders the profile name from userStore', () => {
    const tree = render();
    const nameText = findText(tree.root, 'Ada Lovelace!');
    expect(nameText).toBeDefined();
  });

  it('renders the streak value from activityStore', () => {
    render();
    expect(MockStreakCard).toHaveBeenCalledWith(
      expect.objectContaining({ streak: 5, bestStreak: 10 }),
      expect.anything(),
    );
  });

  it('calls recomputeStreaks on mount', () => {
    render();
    expect(activityState.recomputeStreaks).toHaveBeenCalledTimes(1);
  });

  it('renders the last 5 activities with correct status labels and styling', () => {
    const now = Date.now();
    activityState.activities = [
      makeActivity({
        id: '1',
        status: 'confirmed',
        taskType: 'TREE_PLANTING',
        taskTitle: 'Plant a tree',
        completedAt: new Date(now - 60_000).toISOString(),
        rewardAmount: 10,
        rewardToken: 'ECO',
      }),
      makeActivity({
        id: '2',
        status: 'pending',
        taskType: 'OCEAN_CLEANUP',
        taskTitle: 'Clean the ocean',
        completedAt: new Date(now - 120_000).toISOString(),
        rewardAmount: 5,
        rewardToken: 'ECO',
      }),
      makeActivity({
        id: '3',
        status: 'failed',
        taskType: 'TRASH_COLLECTION',
        taskTitle: 'Collect trash',
        completedAt: new Date(now - 180_000).toISOString(),
        rewardAmount: 3,
        rewardToken: 'ECO',
      }),
      makeActivity({
        id: '4',
        status: 'confirmed',
        taskType: 'OTHER',
        taskTitle: 'Light a beacon',
        completedAt: new Date(now - 240_000).toISOString(),
        rewardAmount: 7,
        rewardToken: 'ECO',
      }),
      makeActivity({
        id: '5',
        status: 'pending',
        taskType: 'OTHER',
        taskTitle: 'Build a nest',
        completedAt: new Date(now - 300_000).toISOString(),
        rewardAmount: 2,
        rewardToken: 'ECO',
      }),
      makeActivity({
        id: '6',
        status: 'confirmed',
        taskType: 'OTHER',
        taskTitle: 'Sixth hidden task',
        completedAt: new Date(now - 360_000).toISOString(),
        rewardAmount: 1,
        rewardToken: 'ECO',
      }),
    ];

    const tree = render();

    // Only the first 5 activities are rendered (slice(0, 5)).
    expect(findText(tree.root, 'Plant a tree')).toBeDefined();
    expect(findText(tree.root, 'Sixth hidden task')).toBeUndefined();

    // Status labels.
    expect(findText(tree.root, '⏳ Pending')).toBeDefined();
    expect(findText(tree.root, '❌ Failed')).toBeDefined();

    // Status-based styling: pending = warning (yellow), failed = error (red),
    // confirmed reward amount = primary (green).
    const pendingLabel = findText(tree.root, '⏳ Pending');
    expect(pendingLabel?.props.style.color).toBe(colors.warning);

    const failedLabel = findText(tree.root, '❌ Failed');
    expect(failedLabel?.props.style.color).toBe(colors.error);

    const confirmedReward = findText(tree.root, '+10');
    expect(confirmedReward?.props.style.color).toBe(colors.primary);
  });

  it('shows the PendingProofsBanner when pendingCount > 0', () => {
    mockUseProofSubmit.mockReturnValue({
      pendingCount: 2,
      isSubmitting: false,
      syncPendingProofs: jest.fn(),
    });

    render();

    expect(MockPendingProofsBanner).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2, isSyncing: false }),
      expect.anything(),
    );
  });

  it('navigates to the Tasks tab when Browse Tasks is pressed', () => {
    const tree = render();
    const browse = findButtonByText(tree.root, 'Browse Tasks');
    expect(browse).toBeDefined();
    act(() => {
      browse?.props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('Tasks');
  });
});
