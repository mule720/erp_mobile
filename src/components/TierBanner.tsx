import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';
import { useConfirm } from '../store/ConfirmContext';
import { COLORS, FONT, RADIUS } from '../theme';

interface Status {
  onLadder: boolean; tier?: number; usage?: { users: number; branches: number }; limits?: { users: number; branches: number };
  atLimit?: string[]; next?: { code: string; tier: number; users: number; branches: number; monthly: number } | null;
}
const kw = (n: number) => `K${Math.round(n).toLocaleString()}`;

/** For administrators once the users or the branches limit of the tier is reached: the next step, what it adds and costs, and a button that asks before moving up. */
export default function TierBanner() {
  const { tenant } = useAuth();
  const role = useRole();
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!tenant?.id || !role.isAdmin) { setStatus(null); return; }
    gql<any>(`query($t:UUID!){ tierStatus(tenantId:$t) }`, { t: tenant.id }).then((d) => setStatus(d?.tierStatus || null)).catch(() => setStatus(null));
  }, [tenant?.id, role.isAdmin]);
  useEffect(() => { load(); }, [load]);

  if (!role.isAdmin || !status?.onLadder || !status.atLimit?.length || !status.next) return null;
  const n = status.next;
  const which = status.atLimit.map((k) => `${status.usage?.[k as 'users' | 'branches']} of ${status.limits?.[k as 'users' | 'branches']} ${k}`).join(' and ');

  const moveUp = async () => {
    const yes = await confirm({
      title: `Move up to tier ${n.tier}?`,
      message: `${n.users} users and ${n.branches} branches for ${kw(n.monthly)} a month. It shows on your next invoice.`,
      confirmLabel: 'Move up',
    });
    if (!yes) return;
    setBusy(true);
    try {
      const d = await gql<any>(`mutation($t:UUID!,$p:String!){ changePlan(tenantId:$t, planCode:$p){ ok error message } }`, { t: tenant!.id, p: n.code });
      const r = d?.changePlan;
      Alert.alert(r?.ok ? 'Plan changed' : 'Could not change the plan', r?.ok ? (r.message || 'Done.') : (r?.error || 'Ask an administrator.'));
      if (r?.ok) load();
    } catch (e: any) { Alert.alert('Could not change the plan', e?.message || 'Please try again.'); } finally { setBusy(false); }
  };

  return (
    <View style={s.box} accessibilityRole="alert">
      <Ionicons name="arrow-up-circle-outline" size={20} color="#B45309" />
      <View style={{ flex: 1 }}>
        <Text style={s.txt}>You are using {which}, the limit of tier {status.tier}.</Text>
        <Text style={s.sub}>Tier {n.tier}: {n.users} users, {n.branches} branches, {kw(n.monthly)} a month.</Text>
      </View>
      <TouchableOpacity style={s.btn} onPress={moveUp} disabled={busy} accessibilityRole="button">
        <Text style={s.btnTxt}>{busy ? '...' : 'Move up'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', borderColor: '#FCD34D', borderWidth: 1, borderRadius: RADIUS.md, marginHorizontal: 12, marginTop: 10, padding: 10 },
  txt: { fontSize: 13, fontFamily: FONT.heading, color: '#92400E' },
  sub: { fontSize: 12, fontFamily: FONT.bodyRegular, color: '#92400E', marginTop: 2 },
  btn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8 },
  btnTxt: { color: '#fff', fontSize: 13, fontFamily: FONT.heading },
});
