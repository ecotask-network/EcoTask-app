import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FlatList, Text, TextInput, TouchableOpacity } from 'react-native';
import TaskListScreen from '../screens/TaskListScreen';
import { useTaskFeed } from '../hooks/useTaskFeed';
import { useLocation } from '../hooks/useLocation';
import { useTaskStackNavigation } from '../navigation/useAppNavigation';
import TaskCard from '../components/TaskCard';
import { TaskCardSkeleton } from '../components/LoadingSkeleton';

jest.mock('../hooks/useTaskFeed', () => ({
  useTaskFeed: jest.fn(),
}));

jest.mock('../hooks/useLocation', () => ({
  useLocation: jest.fn(),
}));

jest.mock('../navigation/useAppNavigation', () => ({
  useTaskStackNavigation: jest.fn(),
  useRootNavigation: jest.fn(),
  useTabNavigation: jest.fn(),
}));

const mockUseTaskFeed = useTaskFeed as jest.Mock;
const mockUseLocation = useLocation as jest.Mock;
const mockUseTaskStackNavigation = useTaskStackNavigation as jest.Mock;

interface FeedTask {
  id: string;
  title: string;
  description: string;
  type: string;
  status: 'open' | 'active' | 'closed';
  rewardAmount: number;
  rewardToken: string;
  distance: number;
  difficulty: string;
  estimatedMinutes: number;
}

function makeTasks(): FeedTask[] {
  return [
    {
      id: 't1',
      title: 'Oak planting drive',
      description: 'Plant oak saplings',
      type: 'TREE_PLANTING',
      status: 'open',
      rewardAmount: 50,
      rewardToken: 'ECO',
      distance: 1.2,
      difficulty: 'easy',
      estimatedMinutes: 30,
    },
    {
      id: 't2',
      title: 'Pine reforestation',
      description: 'Replant pines',
      type: 'TREE_PLANTING',
      status: 'active',
      rewardAmount: 20,
      rewardToken: 'ECO',
      distance: 3.5,
      difficulty: 'medium',
      estimatedMinutes: 45,
    },
    {
      id: 't3',
      title: 'Ocean cleanup beach',
      description: 'Clean the ocean shore',
      type: 'OCEAN_CLEANUP',
      status: 'open',
      rewardAmount: 100,
      rewardToken: 'ECO',
      distance: 0.5,
      difficulty: 'hard',
      estimatedMinutes: 60,
    },
    {
      id: 't4',
      title: 'Trash collection park',
      description: 'Collect litter in the park',
      type: 'TRASH_COLLECTION',
      status: 'closed',
      rewardAmount: 10,
      rewardToken: 'ECO',
      distance: 2.0,
      difficulty: 'easy',
      estimatedMinutes: 15,
    },
  ];
}

let capturedOptions: Record<string, unknown> = {};
let feedState: {
  tasks: FeedTask[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  refresh: jest.Mock;
  loadMore: jest.Mock;
};

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

function buttonWithText(
  tree: renderer.ReactTestRenderer,
  label: string,
): renderer.ReactTestInstance {
  const button = tree.root
    .findAllByType(TouchableOpacity)
    .find(node =>
      node
        .findAllByType(Text)
        .some(text => flattenText(text.props.children) === label),
    );
  if (!button) {
    throw new Error(`Could not find a button labelled "${label}"`);
  }
  return button;
}

function inputByPlaceholder(
  tree: renderer.ReactTestRenderer,
  placeholder: string,
): renderer.ReactTestInstance {
  const input = tree.root
    .findAllByType(TextInput)
    .find(i => i.props.placeholder === placeholder);
  if (!input) {
    throw new Error(
      `Could not find an input with placeholder "${placeholder}"`,
    );
  }
  return input;
}

function flatList(
  tree: renderer.ReactTestRenderer,
): renderer.ReactTestInstance {
  return tree.root.findByType(FlatList);
}

describe('TaskListScreen', () => {
  let navigate: jest.Mock;
  let tree: renderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    navigate = jest.fn();
    mockUseTaskStackNavigation.mockReturnValue({ navigate });
    mockUseLocation.mockReturnValue({
      location: { lat: 51.5, lng: -0.12 },
      permissionGranted: true,
      error: null,
      refresh: jest.fn(),
    });

    feedState = {
      tasks: makeTasks(),
      isLoading: false,
      error: null,
      hasMore: true,
      refresh: jest.fn(),
      loadMore: jest.fn(),
    };

    mockUseTaskFeed.mockImplementation((options: Record<string, unknown>) => {
      capturedOptions = options;
      return feedState;
    });
  });

  afterEach(() => {
    act(() => {
      tree?.unmount();
    });
    tree = null;
  });

  function render() {
    act(() => {
      tree = renderer.create(<TaskListScreen />);
    });
    // re-read last options after initial mount render
    return tree!;
  }

  it('passes the active type filter into useTaskFeed', () => {
    const t = render();
    expect(capturedOptions.type).toBeUndefined();

    act(() => {
      buttonWithText(t, 'Trees').props.onPress();
    });

    expect(capturedOptions.type).toBe('TREE_PLANTING');
  });

  it('client-side filters the list by status', () => {
    const t = render();

    act(() => {
      buttonWithText(t, 'Open').props.onPress();
    });

    const visible = flatList(t).props.data as FeedTask[];
    expect(visible.every(task => task.status === 'open')).toBe(true);
    expect(visible.map(t2 => t2.id).sort()).toEqual(['t1', 't3']);
  });

  it('client-side filters the list by search query', () => {
    const t = render();

    act(() => {
      inputByPlaceholder(t, 'Search tasks…').props.onChangeText('ocean');
    });

    const visible = flatList(t).props.data as FeedTask[];
    expect(visible).toHaveLength(1);
    expect(visible[0]!.id).toBe('t3');
  });

  it('sorts the list by reward when the Reward sort is selected', () => {
    const t = render();

    act(() => {
      buttonWithText(t, 'Reward').props.onPress();
    });

    const visible = flatList(t).props.data as FeedTask[];
    const rewards = visible.map(task => task.rewardAmount);
    expect(rewards).toEqual([...rewards].sort((a, b) => b - a));
    expect(visible[0]!.id).toBe('t3');
  });

  it('sorts the list by difficulty when the Easiest sort is selected', () => {
    const t = render();

    act(() => {
      buttonWithText(t, 'Easiest').props.onPress();
    });

    const visible = flatList(t).props.data as FeedTask[];
    const weights: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    const order = visible.map(task => weights[task.difficulty] ?? 0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('changes the feed radius when a radius button is pressed', () => {
    const t = render();
    expect(capturedOptions.radius).toBe(50);

    act(() => {
      buttonWithText(t, '100km').props.onPress();
    });

    // The radius param change is what drives useTaskFeed to re-fetch.
    expect(capturedOptions.radius).toBe(100);
    expect(capturedOptions.lat).toBe(51.5);
    expect(capturedOptions.lng).toBe(-0.12);
  });

  it('fires loadMore when the list reaches onEndReached', () => {
    const t = render();

    act(() => {
      flatList(t).props.onEndReached();
    });

    expect(feedState.loadMore).toHaveBeenCalledTimes(1);
  });

  it('calls refresh on pull-to-refresh', () => {
    const t = render();

    act(() => {
      flatList(t).props.onRefresh();
    });

    expect(feedState.refresh).toHaveBeenCalledTimes(1);
  });

  it('combines a type filter with a search query', () => {
    const t = render();

    act(() => {
      buttonWithText(t, 'Trees').props.onPress();
    });
    act(() => {
      inputByPlaceholder(t, 'Search tasks…').props.onChangeText('planting');
    });

    const visible = flatList(t).props.data as FeedTask[];
    expect(visible).toHaveLength(1);
    expect(visible[0]!.id).toBe('t1');
    expect(capturedOptions.type).toBe('TREE_PLANTING');
  });

  it('navigates to TaskDetail when a task card is pressed', () => {
    const t = render();
    const card = t.root.findAllByType(TaskCard)[0]!;

    act(() => {
      card.props.onPress('t3');
    });

    expect(navigate).toHaveBeenCalledWith('TaskDetail', { taskId: 't3' });
  });

  it('shows skeletons while the initial feed is loading', () => {
    feedState = { ...feedState, tasks: [], isLoading: true };
    const t = render();

    expect(t.root.findAllByType(TaskCardSkeleton)).toHaveLength(5);
    expect(t.root.findAllByType(TaskCard)).toHaveLength(0);
  });

  it('shows an error and retries via the Retry button', () => {
    feedState = { ...feedState, tasks: [], error: 'Failed to load tasks' };
    const t = render();

    expect(
      t.root
        .findAllByType(Text)
        .some(text => text.props.children === 'Failed to load tasks'),
    ).toBe(true);

    act(() => {
      buttonWithText(t, 'Retry').props.onPress();
    });

    expect(feedState.refresh).toHaveBeenCalledTimes(1);
  });
});
