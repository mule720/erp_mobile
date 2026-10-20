import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';
import ModuleTabs from '../components/ModuleTabs';
import FormModal from '../components/FormModal';
import { Field, SelectField } from '../components/Field';
import FAB from '../components/FAB';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600', flex: 1 }}>{label}</Text>
      <View style={{ flex: 2, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}
const fmt = (n: any) => `ZMW ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TABS = [
  { key: 'projects', label: 'Projects' },
  { key: 'tickets', label: 'Service Tickets' },
];

const PROJECT_STATUSES = ['all', 'planned', 'active', 'on_hold', 'completed', 'cancelled'];
const TICKET_STATUSES = ['all', 'open', 'in_progress', 'resolved', 'closed'];
const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'];

const STATUS_COLOR: Record<string, string> = {
  planned: '#3B82F6', active: '#16A34A', on_hold: '#F59E0B',
  completed: '#6B7280', cancelled: '#DC2626',
  open: '#3B82F6', in_progress: '#F59E0B', resolved: '#16A34A', closed: '#6B7280',
};
const PRIORITY_COLOR: Record<string, string> = {
  low: '#6B7280', medium: '#3B82F6', high: '#F59E0B', critical: '#DC2626',
};

function Loader() { return <View style={s.center}><ActivityIndicator size="large" color={NAVY} /></View>; }
function Empty({ msg = 'No records' }: { msg?: string }) { return <Text style={s.empty}>{msg}</Text>; }

/* ─────────────────────────── PROJECTS ─────────────────────────── */
function ProjectsTab({ tenantId }: { tenantId: string }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ name: '', notes: '', startDate: '', endDate: '', budgetAmount: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await gql<any>(
        `query($t:UUID!,$s:String){projects(tenantId:$t,status:$s,limit:100){id projectCode name status startDate endDate budgetAmount billedAmount taskCount tasksDone riskLevel notes}}`,
        { t: tenantId, s: statusFilter === 'all' ? null : statusFilter }
      );
      const list = d?.projects || [];
      setProjects(list); setFiltered(list);
    } catch {} finally { setLoading(false); }
  }, [tenantId, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setFiltered(projects.filter(p =>
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.projectCode?.toLowerCase().includes(search.toLowerCase())
    ));
  }, [search, projects]);

  const create = async () => {
    if (!form.name) { Alert.alert('Error', 'Project name required'); return; }
    setSaving(true);
    try {
      const inp = { name: form.name, notes: form.notes, startDate: form.startDate || null, endDate: form.endDate || null, budgetAmount: Number(form.budgetAmount) || 0 };
      const d = await gql<any>(`mutation($t:UUID!,$inp:GenericScalar!){createProject(tenantId:$t,inputJson:$inp){ok error projectCode}}`, { t: tenantId, inp });
      if (!d?.createProject?.ok) throw new Error(d?.createProject?.error || 'Failed');
      setShowCreate(false); setForm({ name: '', notes: '', startDate: '', endDate: '', budgetAmount: '' }); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.toolbar}>
        <TextInput style={s.search} placeholder="Search projects…" placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterRow}>
        {PROJECT_STATUSES.map(st => (
          <TouchableOpacity key={st} style={[s.filterChip, statusFilter === st && s.filterChipActive]} onPress={() => setStatusFilter(st)}>
            <Text style={[s.filterChipTxt, statusFilter === st && s.filterChipActiveTxt]}>{st === 'all' ? 'All' : st.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <Loader /> : filtered.length === 0 ? <Empty msg="No projects found" /> : (
        <ScrollView contentContainerStyle={s.list}>
          {filtered.map(p => (
            <TouchableOpacity key={p.id} style={s.card} onPress={() => setSelected(p)}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardCode}>{p.projectCode}</Text>
                  <Text style={s.cardName}>{p.name}</Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[p.status] || '#6B7280') + '22' }]}>
                  <Text style={[s.statusTxt, { color: STATUS_COLOR[p.status] || '#6B7280' }]}>{p.status?.replace('_', ' ')}</Text>
                </View>
              </View>
              <View style={s.cardStats}>
                <View style={s.stat}>
                  <Ionicons name="cash-outline" size={13} color={GOLD} />
                  <Text style={s.statTxt}>Budget: {fmt(p.budgetAmount)}</Text>
                </View>
                <View style={s.stat}>
                  <Ionicons name="checkmark-circle-outline" size={13} color={NAVY} />
                  <Text style={s.statTxt}>Tasks: {p.tasksDone}/{p.taskCount}</Text>
                </View>
                {p.riskLevel && p.riskLevel !== 'low' && (
                  <View style={[s.riskBadge, { backgroundColor: p.riskLevel === 'high' ? '#FEE2E2' : '#FEF3C7' }]}>
                    <Text style={{ fontSize: 10, color: p.riskLevel === 'high' ? '#DC2626' : '#D97706', fontWeight: '600' }}>
                      {p.riskLevel.toUpperCase()} RISK
                    </Text>
                  </View>
                )}
              </View>
              {(p.startDate || p.endDate) && (
                <Text style={s.dates}>{p.startDate || '—'} → {p.endDate || 'ongoing'}</Text>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FAB onPress={() => setShowCreate(true)} />

      <FormModal visible={showCreate} title="New Project" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Project Name *" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. Office Renovation" required />
        <Field label="Budget (ZMW)" value={form.budgetAmount} onChangeText={v => setForm(f => ({ ...f, budgetAmount: v }))} placeholder="0" keyboardType="numeric" />
        <Field label="Start Date" value={form.startDate} onChangeText={v => setForm(f => ({ ...f, startDate: v }))} placeholder="YYYY-MM-DD" />
        <Field label="End Date" value={form.endDate} onChangeText={v => setForm(f => ({ ...f, endDate: v }))} placeholder="YYYY-MM-DD" />
        <Field label="Notes" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="Project scope…" multiline />
      </FormModal>

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="arrow-back-outline" size={22} color={NAVY} /></TouchableOpacity>
              <Text style={s.modalTitle}>{selected.projectCode} — {selected.name}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <DetailRow label="Status">
                <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[selected.status] || '#6B7280') + '22' }]}>
                  <Text style={[s.statusTxt, { color: STATUS_COLOR[selected.status] || '#6B7280' }]}>{selected.status?.replace('_', ' ')}</Text>
                </View>
              </DetailRow>
              <DetailRow label="Budget"><Text style={s.detailVal}>{fmt(selected.budgetAmount)}</Text></DetailRow>
              <DetailRow label="Billed"><Text style={s.detailVal}>{fmt(selected.billedAmount)}</Text></DetailRow>
              <DetailRow label="Timeline"><Text style={s.detailVal}>{selected.startDate || '—'} → {selected.endDate || 'ongoing'}</Text></DetailRow>
              <DetailRow label="Tasks"><Text style={s.detailVal}>{selected.tasksDone} / {selected.taskCount} done</Text></DetailRow>
              {selected.riskLevel && <DetailRow label="Risk Level"><Text style={[s.detailVal, { color: PRIORITY_COLOR[selected.riskLevel] || '#6B7280' }]}>{selected.riskLevel?.toUpperCase()}</Text></DetailRow>}
              {selected.notes ? <DetailRow label="Notes"><Text style={s.detailVal}>{selected.notes}</Text></DetailRow> : null}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

/* ─────────────────────────── SERVICE TICKETS ─────────────────────────── */
function TicketsTab({ tenantId }: { tenantId: string }) {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'medium', channel: 'portal' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await gql<any>(
        `query($t:UUID!,$s:String){serviceTickets(tenantId:$t,status:$s,limit:100){id ticketNumber subject description priority status channel createdAt slaDueAt assignedToName customerName resolutionNotes}}`,
        { t: tenantId, s: statusFilter === 'all' ? null : statusFilter }
      );
      const list = d?.serviceTickets || [];
      setTickets(list); setFiltered(list);
    } catch {} finally { setLoading(false); }
  }, [tenantId, statusFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    setFiltered(tickets.filter(t =>
      t.subject?.toLowerCase().includes(search.toLowerCase()) ||
      t.ticketNumber?.toLowerCase().includes(search.toLowerCase()) ||
      t.customerName?.toLowerCase().includes(search.toLowerCase())
    ));
  }, [search, tickets]);

  const create = async () => {
    if (!form.subject) { Alert.alert('Error', 'Subject required'); return; }
    setSaving(true);
    try {
      const d = await gql<any>(
        `mutation($t:UUID!,$subj:String!,$desc:String,$pri:String,$chan:String){createServiceTicket(tenantId:$t,subject:$subj,description:$desc,priority:$pri,channel:$chan){ok error}}`,
        { t: tenantId, subj: form.subject, desc: form.description, pri: form.priority, chan: form.channel }
      );
      if (!d?.createServiceTicket?.ok) throw new Error(d?.createServiceTicket?.error || 'Failed');
      setShowCreate(false); setForm({ subject: '', description: '', priority: 'medium', channel: 'portal' }); load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.toolbar}>
        <TextInput style={s.search} placeholder="Search tickets…" placeholderTextColor="#94A3B8" value={search} onChangeText={setSearch} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={s.filterRow}>
        {TICKET_STATUSES.map(st => (
          <TouchableOpacity key={st} style={[s.filterChip, statusFilter === st && s.filterChipActive]} onPress={() => setStatusFilter(st)}>
            <Text style={[s.filterChipTxt, statusFilter === st && s.filterChipActiveTxt]}>{st === 'all' ? 'All' : st.replace('_', ' ')}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? <Loader /> : filtered.length === 0 ? <Empty msg="No tickets found" /> : (
        <ScrollView contentContainerStyle={s.list}>
          {filtered.map(t => (
            <TouchableOpacity key={t.id} style={s.card} onPress={() => setSelected(t)}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardCode}>{t.ticketNumber}</Text>
                  <Text style={s.cardName}>{t.subject}</Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[t.status] || '#6B7280') + '22' }]}>
                    <Text style={[s.statusTxt, { color: STATUS_COLOR[t.status] || '#6B7280' }]}>{t.status?.replace('_', ' ')}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: (PRIORITY_COLOR[t.priority] || '#6B7280') + '22' }]}>
                    <Text style={[s.statusTxt, { color: PRIORITY_COLOR[t.priority] || '#6B7280' }]}>{t.priority}</Text>
                  </View>
                </View>
              </View>
              {t.customerName && <Text style={s.dates}>Customer: {t.customerName}</Text>}
              {t.assignedToName && <Text style={s.dates}>Assigned: {t.assignedToName}</Text>}
              {t.slaDueAt && <Text style={[s.dates, { color: '#DC2626' }]}>SLA: {t.slaDueAt.slice(0, 16).replace('T', ' ')}</Text>}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <FAB onPress={() => setShowCreate(true)} />

      <FormModal visible={showCreate} title="New Ticket" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Field label="Subject *" value={form.subject} onChangeText={v => setForm(f => ({ ...f, subject: v }))} placeholder="Describe the issue" required />
        <SelectField label="Priority" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
          options={TICKET_PRIORITIES.map(p => ({ label: p.charAt(0).toUpperCase() + p.slice(1), value: p }))} />
        <SelectField label="Channel" value={form.channel} onChange={v => setForm(f => ({ ...f, channel: v }))}
          options={['portal', 'email', 'chat', 'phone', 'social'].map(c => ({ label: c.charAt(0).toUpperCase() + c.slice(1), value: c }))} />
        <Field label="Description" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder="Details…" multiline />
      </FormModal>

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        {selected && (
          <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}><Ionicons name="arrow-back-outline" size={22} color={NAVY} /></TouchableOpacity>
              <Text style={s.modalTitle}>{selected.ticketNumber}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: NAVY, marginBottom: 12 }}>{selected.subject}</Text>
              <DetailRow label="Status">
                <View style={[s.statusBadge, { backgroundColor: (STATUS_COLOR[selected.status] || '#6B7280') + '22' }]}>
                  <Text style={[s.statusTxt, { color: STATUS_COLOR[selected.status] || '#6B7280' }]}>{selected.status?.replace('_', ' ')}</Text>
                </View>
              </DetailRow>
              <DetailRow label="Priority"><Text style={[s.detailVal, { color: PRIORITY_COLOR[selected.priority] }]}>{selected.priority?.toUpperCase()}</Text></DetailRow>
              <DetailRow label="Channel"><Text style={s.detailVal}>{selected.channel}</Text></DetailRow>
              {selected.customerName && <DetailRow label="Customer"><Text style={s.detailVal}>{selected.customerName}</Text></DetailRow>}
              {selected.assignedToName && <DetailRow label="Assigned To"><Text style={s.detailVal}>{selected.assignedToName}</Text></DetailRow>}
              {selected.slaDueAt && <DetailRow label="SLA Due"><Text style={[s.detailVal, { color: '#DC2626' }]}>{selected.slaDueAt.slice(0, 16).replace('T', ' ')}</Text></DetailRow>}
              {selected.description && <DetailRow label="Description"><Text style={s.detailVal}>{selected.description}</Text></DetailRow>}
              {selected.resolutionNotes && <DetailRow label="Resolution Notes"><Text style={s.detailVal}>{selected.resolutionNotes}</Text></DetailRow>}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

/* ─────────────────────────── MAIN ─────────────────────────── */
export default function ProjectsScreen() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState('projects');
  const tenantId = tenant?.id ?? '';

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'projects' && <ProjectsTab tenantId={tenantId} />}
      {tab === 'tickets' && <TicketsTab tenantId={tenantId} />}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: '#94A3B8', textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  toolbar: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', gap: 8 },
  search: { flex: 1, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#1E293B' },
  filterBar: { maxHeight: 44 },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  filterChipTxt: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  filterChipActiveTxt: { color: '#fff' },
  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  cardCode: { fontSize: 11, color: '#64748B', fontWeight: '600', marginBottom: 2 },
  cardName: { fontSize: 14, fontWeight: '700', color: NAVY },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusTxt: { fontSize: 11, fontWeight: '600' },
  cardStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statTxt: { fontSize: 12, color: '#64748B' },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  dates: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 12, backgroundColor: '#fff' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: NAVY, flex: 1 },
  detailVal: { fontSize: 14, color: '#1E293B' },
});
