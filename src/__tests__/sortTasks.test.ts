import {
  filterTasksByQuery,
  sortTasks,
  TaskSortMode,
} from '../utils/sortTasks';

interface Task {
  id: string;
  title: string;
  description: string;
  rewardAmount: number;
  distance?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

const tasks: Task[] = [
  {
    id: '1',
    title: 'Plant mangroves',
    description: 'Restore the coastal wetlands',
    rewardAmount: 30,
    distance: 5,
    difficulty: 'hard',
  },
  {
    id: '2',
    title: 'Beach cleanup',
    description: 'Collect plastic waste',
    rewardAmount: 50,
    distance: 1.2,
    difficulty: 'easy',
  },
  {
    id: '3',
    title: 'Community garden',
    description: 'Grow food for the neighborhood',
    rewardAmount: 20,
    distance: 12,
    difficulty: 'medium',
  },
];

describe('filterTasksByQuery', () => {
  it('returns all tasks for an empty query', () => {
    expect(filterTasksByQuery(tasks, '')).toHaveLength(3);
    expect(filterTasksByQuery(tasks, '   ')).toHaveLength(3);
  });

  it('matches against the title case-insensitively', () => {
    const result = filterTasksByQuery(tasks, 'BEACH');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('2');
  });

  it('matches against the description', () => {
    const result = filterTasksByQuery(tasks, 'wetlands');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('1');
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterTasksByQuery(tasks, 'volcano')).toHaveLength(0);
  });
});

describe('sortTasks', () => {
  it('sorts by distance ascending, keeping unknown distances last', () => {
    const result = sortTasks(
      [...tasks, { ...tasks[0]!, id: '4', distance: undefined }],
      'distance' as TaskSortMode,
    );
    expect(result.map(t => t.id)).toEqual(['2', '1', '3', '4']);
  });

  it('sorts by reward descending', () => {
    const result = sortTasks(tasks, 'reward');
    expect(result.map(t => t.id)).toEqual(['2', '1', '3']);
  });

  it('sorts by difficulty ascending with unknown treated as hard', () => {
    const result = sortTasks(
      [...tasks, { ...tasks[0]!, id: '4', difficulty: undefined }],
      'difficulty',
    );
    expect(result.map(t => t.id)).toEqual(['2', '3', '1', '4']);
  });

  it('does not mutate the input array', () => {
    const copy = [...tasks];
    sortTasks(copy, 'reward');
    expect(copy.map(t => t.id)).toEqual(['1', '2', '3']);
  });
});
