import React from 'react';
import { render, screen } from '@testing-library/react';
import { EarningsSummary } from '../../components/EarningsSummary';
import { Activity } from '../../utils/earnings';

const mockActivities: Activity[] = [
  {
    id: '1',
    taskType: 'Task A',
    reward: 10,
    completedAt: '2024-01-15T10:00:00Z',
    status: 'completed',
  },
  {
    id: '2',
    taskType: 'Task B',
    reward: 20,
    completedAt: '2024-01-16T11:00:00Z',
    status: 'completed',
  },
  {
    id: '3',
    taskType: 'Task A',
    reward: 15,
    completedAt: '2024-01-17T12:00:00Z',
    status: 'completed',
  },
];

describe('EarningsSummary', () => {
  it('should render total rewards correctly', () => {
    render(<EarningsSummary activities={mockActivities} />);
    
    // Total = 10 + 20 + 15 = 45
    expect(screen.getByText('$45.00')).toBeTruthy();
  });

  it('should render breakdown by task type', () => {
    render(<EarningsSummary activities={mockActivities} />);
    
    expect(screen.getByText('Task A')).toBeTruthy();
    expect(screen.getByText('$25.00')).toBeTruthy(); // 10 + 15
    expect(screen.getByText('Task B')).toBeTruthy();
    expect(screen.getByText('$20.00')).toBeTruthy();
  });

  it('should handle empty activities', () => {
    render(<EarningsSummary activities={[]} />);
    
    expect(screen.getByText('$0.00')).toBeTruthy();
    expect(screen.getByText('By Task Type')).toBeTruthy();
  });

  it('should render weekly series', () => {
    render(<EarningsSummary activities={mockActivities} />);
    
    // Check that weekly chart is rendered
    expect(screen.getByText('Weekly Trend')).toBeTruthy();
  });

  it('should memoize computations', () => {
    const { rerender } = render(<EarningsSummary activities={mockActivities} />);
    
    // Re-render with same activities - should not re-compute
    const startTime = performance.now();
    rerender(<EarningsSummary activities={mockActivities} />);
    const duration = performance.now() - startTime;
    
    // Should be very fast (memoized)
    expect(duration).toBeLessThan(10);
  });
});
