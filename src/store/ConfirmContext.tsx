import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONT, RADIUS } from '../theme';

interface Ask { title: string; message: string; confirmLabel: string; destructive: boolean }
type Confirm = (opts: { title: string; message: string; confirmLabel?: string; destructive?: boolean }) => Promise<boolean>;
const Ctx = createContext<Confirm>(async () => false);

/**
 * One confirmation dialog for the whole app. The system alert's two-button form does nothing in a browser and can fail to appear when it is
 * opened while another sheet is closing, so "Are you sure?" questions (sign out, delete my account, authorise a plan) use this instead.
 */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((o) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setAsk({ title: o.title, message: o.message, confirmLabel: o.confirmLabel || 'Yes', destructive: !!o.destructive });
  }), []);
  const answer = (v: boolean) => { setAsk(null); const r = resolver.current; resolver.current = null; r?.(v); };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Modal visible={!!ask} transparent animationType="fade" onRequestClose={() => answer(false)}>
        <View style={s.backdrop}>
          <View style={s.card}>
            <Text style={s.title}>{ask?.title}</Text>
            <Text style={s.msg}>{ask?.message}</Text>
            <View style={s.row}>
              <TouchableOpacity style={[s.btn, s.cancel]} onPress={() => answer(false)} accessibilityRole="button"><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btn, ask?.destructive ? s.danger : s.primary]} onPress={() => answer(true)} accessibilityRole="button"><Text style={s.okTxt}>{ask?.confirmLabel}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, padding: 20 },
  title: { fontSize: 17, fontFamily: FONT.display, color: COLORS.ink },
  msg: { fontSize: 14, fontFamily: FONT.bodyRegular, color: COLORS.subtle, marginTop: 8, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  cancel: { backgroundColor: COLORS.surfaceMuted },
  cancelTxt: { fontSize: 14, fontFamily: FONT.heading, color: COLORS.ink },
  primary: { backgroundColor: COLORS.primary },
  danger: { backgroundColor: COLORS.danger },
  okTxt: { fontSize: 14, fontFamily: FONT.heading, color: '#FFFFFF' },
});
