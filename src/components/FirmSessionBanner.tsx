import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { FONT, RADIUS } from '../theme';

/** Always on while an accounting firm person is working inside a client company, so it is never unclear whose books are open. */
export default function FirmSessionBanner() {
  const { insideClient, leaveClient } = useAuth();
  if (!insideClient) return null;
  return (
    <View style={s.bar} accessibilityRole="alert">
      <Ionicons name="briefcase-outline" size={18} color="#fff" />
      <Text style={s.txt}>Working inside <Text style={s.bold}>{insideClient.client}</Text> as {insideClient.firm}. Recorded, and limited to what they allowed.</Text>
      <TouchableOpacity style={s.btn} onPress={leaveClient} accessibilityRole="button">
        <Text style={s.btnTxt}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#4338CA', paddingHorizontal: 12, paddingVertical: 8 },
  txt: { flex: 1, color: '#fff', fontSize: 12, fontFamily: FONT.bodyRegular },
  bold: { fontFamily: FONT.heading },
  btn: { backgroundColor: '#fff', borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 6 },
  btnTxt: { color: '#4338CA', fontSize: 13, fontFamily: FONT.heading },
});
