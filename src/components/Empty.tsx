import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT } from '../theme';

/** What a list shows when it has nothing in it: an icon and a plain sentence, instead of a bare grey line. */
export default function Empty({ msg = 'No records yet', hint, icon = 'file-tray-outline' }: { msg?: string; hint?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.box}>
      <View style={s.circle}><Ionicons name={icon} size={24} color={COLORS.faint} /></View>
      <Text style={s.msg}>{msg}</Text>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  box: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24 },
  circle: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.surfaceMuted, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  msg: { fontSize: 14, fontFamily: FONT.heading, color: COLORS.subtle, textAlign: 'center' },
  hint: { fontSize: 12, fontFamily: FONT.bodyRegular, color: COLORS.faint, textAlign: 'center', marginTop: 4, lineHeight: 17 },
});
