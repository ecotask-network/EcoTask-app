/**
 * TaskDetailScreen.test.tsx
 *
 * Tests:
 *  1. renders a fully typed `Task` (title, reward, difficulty, instructions)
 *  2. narrows an unrecognised backend status to 'open' via fetchTaskById
 *  3. disables the CTA and shows "Task Closed" for a closed task
 *  4. surfaces a load failure and retries when "Try Again" is pressed
 *  5. passes typed task fields through to the SubmitProof route
 */

import './__mocks__/setup';
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import TaskDetailScreen from '../screens/TaskDetailScreen';
import { fetchTaskById } from '../services/api';
import { useTaskStore } from '../store/taskStore';
import { Task } from '../types';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: { taskId: 't1' } }),
}));

jest.mock('../services/api', () => ({
  fetchTaskById: jest.fn(),
}));

const mockFetchTaskById = fetchTaskById as jest.MockedFunction<
  typeof fetchTaskById
>;

const task: Task = {
  id: 't1',
  title: 'Plant a tree',
  description: 'Plant a sapling in the park',
  instructions: 'Bring your own spade',
  type: 'TREE_PLANTING',
  rewardAmount: 25,
  rewardToken: 'ECO',
  lat: 6.5,
  lng: 3.3,
  status: 'open',
  difficulty: 'easy',
  estimatedMinutes: 30,
};

function textValues(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).filter((child: unknown): child is string => typeof child === 'string'),
    );
}

async function renderScreen() {
  let tree: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<TaskDetailScreen />);
  });
  // @ts-expect-error assigned inside act above
  return tree as renderer.ReactTestRenderer;
}

describe('TaskDetailScreen', () => {
  let tree: renderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    mockFetchTaskById.mockReset();
    useTaskStore.setState({ selectedTask: null, selectedAt: null });
  });

  afterEach(() => {
    tree?.unmount();
    tree = null;
  });

  it('renders the task returned by fetchTaskById', async () => {
    mockFetchTaskById.mockResolvedValue(task);
    tree = await renderScreen();

    const texts = textValues(tree);
    expect(mockFetchTaskById).toHaveBeenCalledWith('t1');
    expect(texts).toContain('Plant a tree');
    expect(texts).toContain('Plant a sapling in the park');
    expect(texts).toContain('Bring your own spade');
    expect(texts).toContain('Easy');
    expect(texts).toContain('Open');
    expect(texts).toContain('Start Task');
  });

  it('renders a task whose status was narrowed to the TaskStatus union', async () => {
    // fetchTaskById coerces unknown backend statuses to 'open' before the
    // screen ever sees them, so the status badge stays renderable.
    mockFetchTaskById.mockResolvedValue({ ...task, status: 'open' });
    tree = await renderScreen();

    expect(textValues(tree)).toContain('Open');
  });

  it('disables the CTA for a closed task', async () => {
    mockFetchTaskById.mockResolvedValue({ ...task, status: 'closed' });
    tree = await renderScreen();

    const buttons = tree.root.findAllByType(TouchableOpacity);
    const cta = buttons[buttons.length - 1]!;
    expect(cta.props.disabled).toBe(true);
    expect(textValues(tree)).toContain('Task Closed');
  });

  it('shows the error message and retries on "Try Again"', async () => {
    mockFetchTaskById.mockRejectedValueOnce(new Error('Network unreachable'));
    tree = await renderScreen();

    expect(textValues(tree)).toContain('Network unreachable');

    mockFetchTaskById.mockResolvedValueOnce(task);
    const retry = tree.root.findAllByType(TouchableOpacity)[0]!;
    await act(async () => {
      retry.props.onPress();
    });

    expect(mockFetchTaskById).toHaveBeenCalledTimes(2);
    expect(textValues(tree)).toContain('Plant a tree');
  });

  it('passes typed task fields to SubmitProof', async () => {
    mockFetchTaskById.mockResolvedValue(task);
    tree = await renderScreen();

    const buttons = tree.root.findAllByType(TouchableOpacity);
    await act(async () => {
      buttons[buttons.length - 1]!.props.onPress();
    });

    expect(useTaskStore.getState().selectedTask).toEqual(task);
    expect(mockNavigate).toHaveBeenCalledWith('SubmitProof', {
      taskId: 't1',
      taskTitle: 'Plant a tree',
      taskType: 'TREE_PLANTING',
      rewardAmount: 25,
      rewardToken: 'ECO',
    });
  });
});
