import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, ActivityIndicator, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { gql } from '../api/graphql';
import { COLORS, FONT, RADIUS } from '../theme';

const fmt = (n: any) => `K${Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

/**
 * The till bar, the same one the web point of sale shows (erp_frontend src/pages/pos/PosShiftBar.tsx): open a till with an opening float,
 * see which till is open and since when, and close it by counting the cash against what the system expects. Cash sales attach to the open till.
 */
export default function PosShiftBar() {
  const { tenant } = useAuth();
  const insets = useSafeAreaInsets();
  const t = tenant?.id;
  const [shift, setShift] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<'open' | 'close' | null>(null);
  const [name, setName] = useState('Till 1');
  const [float, setFloat] = useState('0');
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!t) return;
    try { setShift((await gql<any>(`query($t:UUID!){ currentPosShift(tenantId:$t) }`, { t }))?.currentPosShift || null); } catch { setShift(null); }
    setLoading(false);
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const openClose = async () => {
    setCounted(''); setNotes(''); setSummary(null); setDialog('close');
    try { setSummary((await gql<any>(`query($id:UUID!){ posShiftSummary(shiftId:$id) }`, { id: shift.id }))?.posShiftSummary || null); } catch { /* the count can still be entered */ }
  };

  const doOpen = async () => {
    setSaving(true);
    try {
      const d = await gql<any>(`mutation($t:UUID!,$tn:String,$of:Decimal){ openPosShift(tenantId:$t, terminalName:$tn, openingFloat:$of){ ok error shift } }`,
        { t, tn: name || 'Till 1', of: parseFloat(float || '0') });
      if (!d?.openPosShift?.ok) throw new Error(d?.openPosShift?.error || 'Could not open the till');
      setDialog(null); await load();
    } catch (e: any) { Alert.alert('Could not open the till', e?.message || 'Try again.'); } finally { setSaving(false); }
  };
  const doClose = async () => {
    if (!counted) { Alert.alert('Count the cash', 'Enter the cash you counted in the drawer.'); return; }
    setSaving(true);
    try {
      const d = await gql<any>(`mutation($id:UUID!,$c:Decimal!,$n:String){ closePosShift(id:$id, countedCash:$c, notes:$n){ ok error shift } }`,
        { id: shift.id, c: parseFloat(counted), n: notes || null });
      if (!d?.closePosShift?.ok) throw new Error(d?.closePosShift?.error || 'Could not close the till');
      const v = Number(d.closePosShift.shift?.variance ?? 0);
      setDialog(null); await load();
      Alert.alert('Till closed', Math.abs(v) < 0.01 ? 'The till balanced exactly.' : `Variance: ${v > 0 ? '+' : ''}${fmt(v)}`);
    } catch (e: any) { Alert.alert('Could not close the till', e?.message || 'Try again.'); } finally { setSaving(false); }
  };

  if (loading) return null;
  const variance = summary && counted ? parseFloat(counted) - Number(summary.expectedCashNow ?? 0) : null;

  return (
    <>
      {shift ? (
        <View style={[s.bar, s.barOpen]}>
          <Ionicons name="lock-open-outline" size={16} color={COLORS.success} />
          <Text style={[s.txt, { color: COLORS.success }]} numberOfLines={1}>{shift.terminalName} open{shift.openedAt ? ` since ${new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</Text>
          <TouchableOpacity onPress={openClose} style={s.btnGhost}><Text style={s.btnGhostTxt}>Close till</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={[s.bar, s.barShut]}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.amber} />
          <Text style={[s.txt, { color: '#92400E' }]} numberOfLines={1}>No till is open. Open one to start the day's cash sales.</Text>
          <TouchableOpacity onPress={() => setDialog('open')} style={s.btn}><Text style={s.btnTxt}>Open till</Text></TouchableOpacity>
        </View>
      )}

      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setDialog(null)} />
          <View style={[s.sheet, { paddingBottom: Math.max(18, insets.bottom + 10) }]}>
            <Text style={s.title}>{dialog === 'open' ? 'Open a till' : 'Close the till'}</Text>
            {dialog === 'open' ? (
              <>
                <Text style={s.label}>Till name</Text>
                <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Till 1" placeholderTextColor={COLORS.faint} />
                <Text style={s.label}>Opening float (cash in the drawer)</Text>
                <TextInput style={s.input} value={float} onChangeText={setFloat} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.faint} />
                <TouchableOpacity style={[s.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={doOpen}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Open till</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {!summary ? <ActivityIndicator color={COLORS.primary} style={{ margin: 16 }} /> : (
                  <View style={s.box}>
                    <View style={s.row}><Text style={s.sub}>Opening float</Text><Text style={s.val}>{fmt(summary.openingFloat)}</Text></View>
                    {Object.entries(summary.byPaymentMethod || {}).map(([m, amt]: any) => (
                      <View key={m} style={s.row}><Text style={s.sub}>{String(m).replace(/_/g, ' ')}</Text><Text style={s.val}>{fmt(amt)}</Text></View>
                    ))}
                    <View style={[s.row, s.rowTotal]}><Text style={s.valBold}>Expected cash in the drawer</Text><Text style={s.valBold}>{fmt(summary.expectedCashNow)}</Text></View>
                    <Text style={s.sub}>{summary.receiptCount ?? 0} sale(s) this shift</Text>
                  </View>
                )}
                <Text style={s.label}>Cash you counted</Text>
                <TextInput style={s.input} value={counted} onChangeText={setCounted} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.faint} />
                {variance !== null && <Text style={[s.var, { color: Math.abs(variance) > 0.01 ? COLORS.danger : COLORS.success }]}>Variance: {variance > 0 ? '+' : ''}{fmt(variance)}</Text>}
                <Text style={s.label}>Notes (optional)</Text>
                <TextInput style={s.input} value={notes} onChangeText={setNotes} placeholder="Anything to remember" placeholderTextColor={COLORS.faint} />
                <TouchableOpacity style={[s.primary, saving && { opacity: 0.6 }]} disabled={saving} onPress={doClose}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Close till</Text>}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.cancel} onPress={() => setDialog(null)}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  barOpen: { backgroundColor: '#ECFDF5', borderBottomColor: '#D1FAE5' },
  barShut: { backgroundColor: '#FFFBEB', borderBottomColor: '#FDE68A' },
  txt: { flex: 1, fontSize: 12, fontFamily: FONT.body },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 6 },
  btnTxt: { color: '#fff', fontSize: 12, fontFamily: FONT.heading },
  btnGhost: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#FFFFFF' },
  btnGhostTxt: { color: COLORS.ink, fontSize: 12, fontFamily: FONT.heading },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  title: { fontSize: 17, fontFamily: FONT.display, color: COLORS.ink, marginBottom: 6 },
  label: { fontSize: 12, fontFamily: FONT.heading, color: COLORS.subtle, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: COLORS.ink, fontFamily: FONT.bodyRegular },
  box: { backgroundColor: COLORS.surfaceMuted, borderRadius: RADIUS.md, padding: 12, marginTop: 6, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowTotal: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 6, marginTop: 2 },
  sub: { fontSize: 12, color: COLORS.subtle, fontFamily: FONT.bodyRegular, textTransform: 'capitalize' },
  val: { fontSize: 13, color: COLORS.ink, fontFamily: FONT.body },
  valBold: { fontSize: 13, color: COLORS.ink, fontFamily: FONT.heading },
  var: { fontSize: 13, fontFamily: FONT.heading, marginTop: 8 },
  primary: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryTxt: { color: '#fff', fontSize: 15, fontFamily: FONT.heading },
  cancel: { alignItems: 'center', paddingVertical: 12 },
  cancelTxt: { color: COLORS.subtle, fontSize: 14, fontFamily: FONT.body },
});
