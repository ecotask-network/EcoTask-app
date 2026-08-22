import React from 'react';
import { Text } from 'react-native';

interface TabBarIconProps {
  emoji: string;
  focused: boolean;
  color: string;
  size?: number;
}

export default function TabBarIcon({
  emoji,
  focused,
  color: _color,
  size = 22,
}: TabBarIconProps) {
  return (
    <Text
      style={{
        fontSize: size,
        opacity: focused ? 1 : 0.5,
      }}
      accessible={true}
      accessibilityLabel="Tab icon"
    >
      {emoji}
    </Text>
  );
}
