import React from 'react';
import { Text } from 'react-native';
import renderer from 'react-test-renderer';
import TaskCard from '../components/TaskCard';
import ImpactStats from '../components/ImpactStats';
import RewardBadge from '../components/RewardBadge';
import EmptyState from '../components/EmptyState';

describe('TaskCard', () => {
  const defaultProps = {
    id: '1',
    title: 'Plant trees in the park',
    type: 'TREE_PLANTING' as const,
    rewardAmount: 25,
    rewardToken: 'ECO',
    onPress: jest.fn(),
  };

  it('renders correctly with basic props', () => {
    const tree = renderer.create(<TaskCard {...defaultProps} />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('displays the title', () => {
    const tree = renderer.create(<TaskCard {...defaultProps} />);
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const titleText = texts.find(
      t => t.props.children === 'Plant trees in the park',
    );
    expect(titleText).toBeTruthy();
  });

  it('displays reward amount and token', () => {
    const tree = renderer.create(<TaskCard {...defaultProps} />);
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const rewardText = texts.find(t => t.props.children === 25);
    expect(rewardText).toBeTruthy();
  });

  it('displays distance when provided', () => {
    const tree = renderer.create(<TaskCard {...defaultProps} distance={2.5} />);
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const distText = texts.find(t => t.props.children === '2.5km');
    expect(distText).toBeTruthy();
  });

  it('displays meters for sub-km distances', () => {
    const tree = renderer.create(<TaskCard {...defaultProps} distance={0.5} />);
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const distText = texts.find(t => t.props.children === '500m');
    expect(distText).toBeTruthy();
  });

  it('displays difficulty when provided', () => {
    const tree = renderer.create(
      <TaskCard {...defaultProps} difficulty="easy" />,
    );
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const diffText = texts.find(t => t.props.children === 'Easy');
    expect(diffText).toBeTruthy();
  });

  it('displays estimated minutes when provided', () => {
    const tree = renderer.create(
      <TaskCard {...defaultProps} estimatedMinutes={15} />,
    );
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('min');
  });
});

describe('ImpactStats', () => {
  it('renders with default values', () => {
    const tree = renderer.create(<ImpactStats />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('displays provided values', () => {
    const tree = renderer.create(
      <ImpactStats trees={10} plastic={25} co2={50} />,
    );
    const instance = tree.root;
    const texts = instance.findAllByType(Text);

    const treesText = texts.find(t => t.props.children === 10);
    expect(treesText).toBeTruthy();

    const plasticText = texts.find(t => t.props.children === '25kg');
    expect(plasticText).toBeTruthy();

    const co2Text = texts.find(t => t.props.children === '50kg');
    expect(co2Text).toBeTruthy();
  });

  it('displays labels', () => {
    const tree = renderer.create(<ImpactStats />);
    const instance = tree.root;
    const texts = instance.findAllByType(Text);

    const treesLabel = texts.find(t => t.props.children === 'Trees');
    expect(treesLabel).toBeTruthy();

    const plasticLabel = texts.find(t => t.props.children === 'Plastic');
    expect(plasticLabel).toBeTruthy();

    const co2Label = texts.find(t => t.props.children === 'CO₂');
    expect(co2Label).toBeTruthy();
  });
});

describe('RewardBadge', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<RewardBadge rewardAmount={100} />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('displays the reward amount', () => {
    const tree = renderer.create(<RewardBadge rewardAmount={100} />);
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const amountText = texts.find(t => t.props.children === 100);
    expect(amountText).toBeTruthy();
  });

  it('displays default ECO token', () => {
    const tree = renderer.create(<RewardBadge rewardAmount={100} />);
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const tokenText = texts.find(t => t.props.children === 'ECO');
    expect(tokenText).toBeTruthy();
  });

  it('displays custom token', () => {
    const tree = renderer.create(
      <RewardBadge rewardAmount={100} rewardToken="XLM" />,
    );
    const instance = tree.root;
    const texts = instance.findAllByType(Text);
    const tokenText = texts.find(t => t.props.children === 'XLM');
    expect(tokenText).toBeTruthy();
  });

  it('shows correct tier badge for high reward', () => {
    const tree = renderer.create(<RewardBadge rewardAmount={1500} />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('🏆');
  });

  it('renders with different sizes', () => {
    const sm = renderer.create(<RewardBadge rewardAmount={10} size="sm" />);
    const lg = renderer.create(<RewardBadge rewardAmount={10} size="lg" />);
    expect(sm.toJSON()).toBeTruthy();
    expect(lg.toJSON()).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('renders with required props', () => {
    const tree = renderer.create(<EmptyState icon="🔍" title="No results" />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('displays icon, title, and description', () => {
    const tree = renderer.create(
      <EmptyState icon="📋" title="No tasks" description="Check back later" />,
    );
    const instance = tree.root;
    const texts = instance.findAllByType(Text);

    const iconText = texts.find(t => t.props.children === '📋');
    expect(iconText).toBeTruthy();

    const titleText = texts.find(t => t.props.children === 'No tasks');
    expect(titleText).toBeTruthy();

    const descText = texts.find(t => t.props.children === 'Check back later');
    expect(descText).toBeTruthy();
  });

  it('renders without description', () => {
    const tree = renderer.create(<EmptyState icon="🔍" title="Nothing here" />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Nothing here');
    expect(json).not.toContain('No tasks found');
  });
});
