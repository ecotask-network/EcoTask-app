import './__mocks__/setup';
import { createSubmitTabPressHandler } from '../navigation/submitTabPress';
import { useTaskStore } from '../store/taskStore';
import { Task } from '../types';

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

describe('createSubmitTabPressHandler', () => {
  beforeEach(() => {
    useTaskStore.setState({ selectedTask: null, selectedAt: null });
  });

  it('lets the default tab navigation proceed when no task is selected', () => {
    const navigate = jest.fn();
    const preventDefault = jest.fn();
    createSubmitTabPressHandler({ navigate })({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('redirects to SubmitProof with the active task params when selection is fresh', () => {
    useTaskStore.getState().selectTask(task);
    const navigate = jest.fn();
    const preventDefault = jest.fn();
    createSubmitTabPressHandler({ navigate })({ preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('SubmitProof', {
      taskId: 't1',
      taskTitle: 'Plant a tree',
      taskType: 'TREE_PLANTING',
      rewardAmount: 25,
      rewardToken: 'ECO',
    });
  });

  it('lets the default tab navigation proceed when the selection is stale (>24h)', () => {
    useTaskStore.getState().selectTask(task);
    useTaskStore.setState({
      selectedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    const navigate = jest.fn();
    const preventDefault = jest.fn();
    createSubmitTabPressHandler({ navigate })({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
