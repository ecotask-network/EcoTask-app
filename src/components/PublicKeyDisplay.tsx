import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleProp,
  TextStyle,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

import { truncatePublicKey } from '../utils/validation';
import { colors, spacing } from '../utils/theme';

interface PublicKeyDisplayProps {
  publicKey: string;
  chars?: number;
  align?: 'left' | 'right';
  textStyle?: StyleProp<TextStyle>;
}

export default function PublicKeyDisplay({
  publicKey,
  chars = 6,
  align = 'left',
  textStyle,
}: PublicKeyDisplayProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    Clipboard.setString(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <TouchableOpacity
        onPress={() => setExpanded(prev => !prev)}
        accessibilityRole="button"
        accessibilityLabel={`Wallet address ${publicKey}`}
        accessibilityHint="Double tap to toggle full address"
        style={{ flexShrink: 1, minHeight: 44, justifyContent: 'center' }}
      >
        <Text
          style={[{ color: colors.textSecondary, fontSize: 12 }, textStyle]}
          numberOfLines={expanded ? undefined : 1}
        >
          {expanded ? publicKey : truncatePublicKey(publicKey, chars)}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleCopy}
        accessibilityRole="button"
        accessibilityLabel="Copy wallet address"
        style={{
          marginLeft: spacing.xs,
          padding: spacing.sm,
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 14 }}>{copied ? '✅' : '📋'}</Text>
      </TouchableOpacity>
    </View>
  );
}
