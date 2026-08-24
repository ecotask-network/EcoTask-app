import { UserStats } from '../types';

export type ImpactMetric = 'treesPlanted' | 'plasticCollected' | 'co2Reduced';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  metric: ImpactMetric;
  target: number;
  earned: boolean;
  progress: number;
  currentValue: number;
}

interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: string;
  metric: ImpactMetric;
  target: number;
}

// List of achievement definitions with their respective metrics and targets

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  {
    id: 'first-seedling',
    title: 'First Seedling',
    description: 'Plant your first tree',
    icon: '🌱',
    metric: 'treesPlanted',
    target: 1,
  },
  {
    id: 'grove-keeper',
    title: 'Grove Keeper',
    description: 'Plant 10 trees',
    icon: '🌿',
    metric: 'treesPlanted',
    target: 10,
  },
  {
    id: 'forest-guardian',
    title: 'Forest Guardian',
    description: 'Plant 50 trees',
    icon: '🌳',
    metric: 'treesPlanted',
    target: 50,
  },
  {
    id: 'canopy-champion',
    title: 'Canopy Champion',
    description: 'Plant 100 trees',
    icon: '🏔️',
    metric: 'treesPlanted',
    target: 100,
  },
  {
    id: 'trash-buster',
    title: 'Trash Buster',
    description: 'Collect 10 kg of waste',
    icon: '♻️',
    metric: 'plasticCollected',
    target: 10,
  },
  {
    id: 'cleanup-crew',
    title: 'Cleanup Crew',
    description: 'Collect 50 kg of waste',
    icon: '🧹',
    metric: 'plasticCollected',
    target: 50,
  },
  {
    id: 'ocean-saver',
    title: 'Ocean Saver',
    description: 'Collect 200 kg of waste',
    icon: '🌊',
    metric: 'plasticCollected',
    target: 200,
  },
  {
    id: 'climate-helper',
    title: 'Climate Helper',
    description: 'Offset 50 kg CO₂',
    icon: '🌍',
    metric: 'co2Reduced',
    target: 50,
  },
  {
    id: 'carbon-crusher',
    title: 'Carbon Crusher',
    description: 'Offset 250 kg CO₂',
    icon: '🛡️',
    metric: 'co2Reduced',
    target: 250,
  },
  {
    id: 'net-zero-hero',
    title: 'Net-Zero Hero',
    description: 'Offset 1000 kg CO₂',
    icon: '🏆',
    metric: 'co2Reduced',
    target: 1000,
  },
];

// Function to get the list of achievements based on user stats

export function getAchievements(stats: UserStats): Achievement[] {
  return ACHIEVEMENT_DEFINITIONS.map(def => {
    const currentValue = stats[def.metric] || 0;
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      metric: def.metric,
      target: def.target,
      earned: currentValue >= def.target,
      progress: Math.min(1, currentValue / def.target),
      currentValue,
    };
  });
}

export function getEarnedCount(stats: UserStats): number {
  return getAchievements(stats).filter(a => a.earned).length;
}

export function getNextAchievement(stats: UserStats): Achievement | null {
  const remaining = getAchievements(stats)
    .filter(a => !a.earned)
    .sort((a, b) => a.target - b.target);
  return remaining[0] ?? null;
}
