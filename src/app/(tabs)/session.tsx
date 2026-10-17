import React from 'react';
import { View } from 'react-native';

import { Empty } from '@/components/ui';
import { C } from '@/theme';

export default function Screen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 60 }}>
      <Empty title="Em breve" />
    </View>
  );
}
