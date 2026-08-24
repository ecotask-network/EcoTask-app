import './__mocks__/setup';
import React, { useEffect as mockUseEffect } from 'react';
import renderer, { act } from 'react-test-renderer';
import { TouchableOpacity, Text } from 'react-native';
import SubmitScreen from '../screens/SubmitScreen';
import { useTaskStore } from '../store/taskStore';
import { Task } from '../types';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  // Run the focus effect like a normal effect for testing purposes.
  // (`mockUseEffect` rather than a plain import: jest.mock factories may
  // only reference out-of-scope variables whose name starts with "mock".)
  useFocusEffect: (cb: () => void) => mockUseEffect(cb, [cb]),
}));

const task: Task = {
  id: 't1',
  title: 'Plant a tree',
  description: 'Plant a sapling',
  type: 'TREE_PLANTING',
  rewardAmount: 25,
  rewardToken: 'ECO',
  lat: 0,
  lng: 0,
  status: 'open',
};

describe('SubmitScreen', () => {
  let tree: renderer.ReactTestRenderer | null = null;

  beforeEach(() => {
    mockNavigate.mockClear();
    useTaskStore.setState({ selectedTask: null, selectedAt: null });
  });

  afterEach(() => {
    tree?.unmount();
    tree = null;
  });

  it('shows the "Choose a task" fallback when nothing is selected', () => {
    tree = renderer.create(<SubmitScreen />);
    const texts = tree.root.findAllByType(Text);
    expect(texts.some(t => t.props.children === 'Choose a task')).toBe(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to Tasks when "Browse Tasks" is pressed', () => {
    tree = renderer.create(<SubmitScreen />);
    const button = tree.root.findAllByType(TouchableOpacity)[0];
    void act(() => {
      button?.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Tasks');
  });

  it('auto-redirects to SubmitProof on focus when a fresh task is selected', () => {
    useTaskStore.getState().selectTask(task);
    void act(() => {
      tree = renderer.create(<SubmitScreen />);
    });
    expect(mockNavigate).toHaveBeenCalledWith('SubmitProof', {
      taskId: 't1',
      taskTitle: 'Plant a tree',
      taskType: 'TREE_PLANTING',
      rewardAmount: 25,
      rewardToken: 'ECO',
    });
  });

  it('does not auto-redirect when the selected task is stale', () => {
    useTaskStore.getState().selectTask(task);
    useTaskStore.setState({
      selectedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    tree = renderer.create(<SubmitScreen />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
