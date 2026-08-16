import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Modal, Alert, TextInput,
} from 'react-native';
import { gql } from '../api/graphql';
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';
import ModuleTabs from '../components/ModuleTabs';
import StatusBadge from '../components/StatusBadge';
import FormModal from '../components/FormModal';
import { Field, SelectField, Section } from '../components/Field';
import FAB from '../components/FAB';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: any, cur = 'ZMW') =>
  new Intl.NumberFormat('en-ZM', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n ?? 0));

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'employees', label: 'Employees' },
  { key: 'leave', label: 'Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'timesheets', label: 'Timesheets' },
];

function Loader() { return <View style={s.center}><ActivityIndicator size="large" color={NAVY} /></View>; }
function Empty({ msg = 'No records' }: { msg?: string }) { return <Text style={s.empty}>{msg}</Text>; }

function ActionBtn({ label, color = NAVY, onPress }: { label: string; color?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.actionBtn, { backgroundColor: color }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={s.actionBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function SubChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.subChip, active && s.subChipActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.subChipTxt, active && s.subChipTxtActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ═══════════════════════ OVERVIEW TAB ═══════════════════════ */
function OverviewTab({ tenantId }: { tenantId: string }) {
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [dashData, empData, actData] = await Promise.all([
          gql<any>(`query($t:UUID!){payrollDashboard(tenantId:$t){totalEmployees activeEmployees grossThisMonth pendingApprovals currentPeriodLabel}}`, { t: tenantId }),
          gql<any>(`query($t:UUID!){employees(tenantId:$t,limit:200){id status}}`, { t: tenantId }),
          gql<any>(`query($t:UUID!){recentActivities(tenantId:$t,limit:5){activityType reference description amount date}}`, { t: tenantId }),
        ]);
        const dash = dashData?.payrollDashboard || {};
        const allEmp = empData?.employees || [];
        setStats({ ...dash, totalEmployees: allEmp.length, activeEmployees: allEmp.filter((e: any) => e.status === 'active').length });
        setActivity(actData?.recentActivities || []);
      } catch { } finally { setLoading(false); }
    })();
  }, [tenantId]);

  if (loading) return <Loader />;
  const statItems = [
    { label: 'Total Employees', value: stats?.totalEmployees ?? '–', color: NAVY },
    { label: 'Active', value: stats?.activeEmployees ?? '–', color: GOLD },
    { label: 'Pending Approvals', value: stats?.pendingApprovals ?? '–', color: '#DC2626' },
  ];
  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={s.statGrid}>
        {statItems.map(st => (
          <View key={st.label} style={s.statCard}>
            <Text style={[s.statNum, { color: st.color }]}>{st.value}</Text>
            <Text style={s.statLbl}>{st.label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.sectionTitle}>Recent Activity</Text>
      <View style={[s.card, { marginBottom: 32 }]}>
        {activity.length === 0 ? <Empty msg="No recent activity" /> : activity.map((a, i) => (
          <View key={i} style={[s.row, i < activity.length - 1 && s.border]}>
            <View style={[s.activityDot, { backgroundColor: a.type === 'leave' ? GOLD : NAVY }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.main}>{a.description}</Text>
              <Text style={s.sub}>{a.date?.slice(0, 10)}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ═══════════════════════ EMPLOYEES TAB ═══════════════════════ */
function EmployeesTab({ tenantId }: { tenantId: string }) {
  const { isAdmin, isHRAdmin } = useRole();
  const canAdmin = isAdmin || isHRAdmin;

  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const blankForm = {
    firstName: '', lastName: '', email: '', phone: '', employeeNumber: '',
    departmentId: '', position: '', salary: '', employmentType: 'full_time',
    hireDate: today(), nationalId: '',
  };
  const [form, setForm] = useState(blankForm);

  const load = useCallback(async () => {
    try {
      const [eData, dData] = await Promise.all([
        gql<any>(
          `query($t:UUID!){employees(tenantId:$t,limit:200){id firstName lastName email phone jobTitle department status employeeNumber hireDate employmentType nrcNumber basicSalary annualSalary fullName}}`,
          { t: tenantId }
        ),
        gql<any>(`query($t:UUID!){departments(tenantId:$t){id name}}`, { t: tenantId }),
      ]);
      setEmployees((eData?.employees || []).filter(Boolean));
      setDepartments((dData?.departments || []).filter(Boolean));
    } catch { } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let list = employees;
    if (deptFilter) list = list.filter((e: any) => e.department === deptFilter);
    if (search) list = list.filter((e: any) =>
      `${e.firstName} ${e.lastName} ${e.email} ${e.jobTitle || ''}`.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(list);
  }, [employees, search, deptFilter]);

  const create = async () => {
    if (!form.firstName || !form.lastName || !form.email) { Alert.alert('Error', 'First name, last name and email are required'); return; }
    setSaving(true);
    try {
      const input: any = {
        firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone,
        employeeNumber: form.employeeNumber, department: form.departmentId || undefined,
        jobTitle: form.position, basicSalary: parseFloat(form.salary) || undefined,
        employmentType: form.employmentType, hireDate: form.hireDate,
        nrcNumber: form.nationalId || undefined,
      };
      await gql<any>(`mutation($t:UUID!,$i:EmployeeInput!){createEmployee(tenantId:$t,input:$i){ok error}}`, { t: tenantId, i: input });
      setShowCreate(false);
      setForm(blankForm);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const deactivate = async (emp: any) => {
    Alert.alert('Deactivate Employee', `Are you sure you want to deactivate ${emp.firstName} ${emp.lastName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate', style: 'destructive', onPress: async () => {
          try {
            await gql<any>(`mutation($id:UUID!,$r:String!,$d:Date!){terminateEmployee(employeeId:$id,reason:$r,terminationDate:$d){ok error}}`, { id: emp.id, r: 'Terminated via mobile', d: today() });
            setSelected(null);
            load();
          } catch (e: any) { Alert.alert('Error', e.message); }
        }
      }
    ]);
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search employees…" placeholderTextColor="#9CA3AF" />
      </View>
      {departments.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <TouchableOpacity style={[s.chip, !deptFilter && s.chipActive]} onPress={() => setDeptFilter('')} activeOpacity={0.7}>
            <Text style={[s.chipTxt, !deptFilter && s.chipTxtActive]}>All</Text>
          </TouchableOpacity>
          {departments.map(d => (
            <TouchableOpacity key={d.id} style={[s.chip, deptFilter === d.id && s.chipActive]} onPress={() => setDeptFilter(d.id)} activeOpacity={0.7}>
              <Text style={[s.chipTxt, deptFilter === d.id && s.chipTxtActive]}>{d.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Employees ({filtered.length})</Text>
        <View style={[s.card, { marginBottom: 100 }]}>
          {filtered.length === 0 ? <Empty msg="No employees" /> : filtered.map((e, i) => (
            <TouchableOpacity key={e.id} style={[s.row, i < filtered.length - 1 && s.border]} onPress={() => setSelected(e)} activeOpacity={0.7}>
              <View style={s.avatar}>
                <Text style={s.avatarTxt}>{(e.firstName?.[0] || '?').toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.main}>{e.firstName} {e.lastName}</Text>
                <Text style={s.sub}>{e.jobTitle || e.email}</Text>
                {(e.department) && <Text style={s.sub2}>{e.department}</Text>}
              </View>
              <StatusBadge status={e.status || 'active'} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      {canAdmin && <FAB onPress={() => { setForm(blankForm); setShowCreate(true); }} />}

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Employee Details</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={{ alignItems: 'center', padding: 24, backgroundColor: NAVY }}>
              <View style={[s.avatar, { width: 64, height: 64, borderRadius: 32 }]}>
                <Text style={[s.avatarTxt, { fontSize: 24 }]}>{(selected.firstName?.[0] || '?').toUpperCase()}</Text>
              </View>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 10 }}>
                {selected.firstName} {selected.lastName}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{selected.jobTitle}</Text>
            </View>
            <View style={[s.card, { marginTop: 12 }]}>
              {([
                ['Employee #', selected.employeeNumber],
                ['Email', selected.email],
                ['Phone', selected.phone],
                ['Department', selected.department],
                ['Job Title', selected.jobTitle],
                ['Employment Type', selected.employmentType],
                ['Hire Date', selected.hireDate?.slice(0, 10)],
                ['NRC Number', selected.nrcNumber],
                ['Salary', selected.basicSalary ? fmt(selected.basicSalary) : (selected.annualSalary ? fmt(selected.annualSalary) : undefined)],
                ['Status', selected.status],
              ] as [string, any][]).filter(([, v]) => v).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            {canAdmin && selected.status === 'active' && (
              <View style={s.actionRow}>
                <ActionBtn label="Deactivate" color="#DC2626" onPress={() => deactivate(selected)} />
              </View>
            )}
          </ScrollView>
        )}
      </Modal>

      <FormModal visible={showCreate} title="New Employee" onClose={() => setShowCreate(false)} onSubmit={create} submitting={saving}>
        <Section title="Personal Info" />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><Field label="First Name" value={form.firstName} onChangeText={v => setForm(f => ({ ...f, firstName: v }))} required /></View>
          <View style={{ flex: 1 }}><Field label="Last Name" value={form.lastName} onChangeText={v => setForm(f => ({ ...f, lastName: v }))} required /></View>
        </View>
        <Field label="Email" value={form.email} onChangeText={v => setForm(f => ({ ...f, email: v }))} keyboardType="email-address" required />
        <Field label="Phone" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} keyboardType="phone-pad" />
        <Field label="National ID" value={form.nationalId} onChangeText={v => setForm(f => ({ ...f, nationalId: v }))} />
        <Section title="Employment" />
        <Field label="Employee Number" value={form.employeeNumber} onChangeText={v => setForm(f => ({ ...f, employeeNumber: v }))} placeholder="e.g. EMP-001" />
        <SelectField label="Department" value={form.departmentId} onChange={v => setForm(f => ({ ...f, departmentId: v }))}
          options={departments.map(d => ({ label: d.name, value: d.id }))} />
        <Field label="Position / Job Title" value={form.position} onChangeText={v => setForm(f => ({ ...f, position: v }))} />
        <SelectField label="Employment Type" value={form.employmentType} onChange={v => setForm(f => ({ ...f, employmentType: v }))}
          options={[
            { label: 'Full Time', value: 'full_time' },
            { label: 'Part Time', value: 'part_time' },
            { label: 'Contract', value: 'contract' },
          ]} />
        <Field label="Hire Date" value={form.hireDate} onChangeText={v => setForm(f => ({ ...f, hireDate: v }))} placeholder="YYYY-MM-DD" />
        <Field label="Salary" value={form.salary} onChangeText={v => setForm(f => ({ ...f, salary: v }))} keyboardType="decimal-pad" />
      </FormModal>
    </View>
  );
}

/* ═══════════════════════ LEAVE TAB ═══════════════════════ */
function LeaveTab({ tenantId, employeeId }: { tenantId: string; employeeId: string | null }) {
  const { isAdmin, isHRAdmin } = useRole();
  const canAdmin = isAdmin || isHRAdmin;

  const [view, setView] = useState<'requests' | 'balance'>('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });

  const load = useCallback(async () => {
    try {
      const queries = await Promise.all([
        canAdmin
          ? gql<any>(`query($t:UUID!){leaveRequests(tenantId:$t,limit:50){id employee{id firstName lastName} leaveType{name} startDate endDate daysRequested status reason}}`, { t: tenantId })
          : employeeId
          ? gql<any>(`query($e:UUID!,$t:UUID!){leaveRequests(employeeId:$e,tenantId:$t,limit:30){id leaveType{name} startDate endDate daysRequested status reason}}`, { e: employeeId, t: tenantId })
          : Promise.resolve(null),
        employeeId
          ? gql<any>(`query($e:UUID!,$t:UUID!){leaveBalances(employeeId:$e,tenantId:$t){leaveType{id name} remainingDays entitledDays usedDays year}}`, { e: employeeId, t: tenantId })
          : Promise.resolve(null),
        gql<any>(`query($t:UUID!){leaveTypes(tenantId:$t){id name daysPerYear}}`, { t: tenantId }),
      ]);
      setRequests((queries[0]?.leaveRequests || []).filter(Boolean));
      setBalances(queries[1]?.leaveBalances || []);
      setLeaveTypes(queries[2]?.leaveTypes || []);
    } catch { } finally { setLoading(false); }
  }, [tenantId, employeeId, canAdmin]);

  useEffect(() => { load(); }, [load]);

  const applyLeave = async () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) { Alert.alert('Error', 'Fill all required fields'); return; }
    setSaving(true);
    try {
      await gql<any>(
        `mutation($t:UUID!,$e:UUID!,$lt:UUID!,$s:Date!,$end:Date!,$r:String){createLeaveRequest(tenantId:$t,employeeId:$e,leaveTypeId:$lt,startDate:$s,endDate:$end,reason:$r){ok error}}`,
        { t: tenantId, e: employeeId, lt: form.leaveTypeId, s: form.startDate, end: form.endDate, r: form.reason }
      );
      setShowApply(false);
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const approveRequest = async (req: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){approveLeaveRequest(requestId:$id){ok error}}`, { id: req.id });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const openReject = (req: any) => { setRejectTarget(req); setRejectReason(''); setShowReject(true); };

  const rejectRequest = async () => {
    if (!rejectReason) { Alert.alert('Error', 'Reason required'); return; }
    setSaving(true);
    try {
      await gql<any>(`mutation($id:UUID!,$r:String!){rejectLeaveRequest(requestId:$id,reason:$r){ok error}}`, { id: rejectTarget.id, r: rejectReason });
      setShowReject(false);
      setRejectTarget(null);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.subChipRow}>
        <SubChip label="Requests" active={view === 'requests'} onPress={() => setView('requests')} />
        <SubChip label="My Balance" active={view === 'balance'} onPress={() => setView('balance')} />
      </View>
      <ScrollView style={{ flex: 1 }}>
        {view === 'requests' && (
          <>
            <Text style={s.sectionTitle}>Leave Requests ({requests.length})</Text>
            <View style={[s.card, { marginBottom: 100 }]}>
              {requests.length === 0 ? <Empty msg="No leave requests" /> : requests.map((r, i) => (
                <View key={r.id} style={[{ paddingVertical: 12 }, i < requests.length - 1 && s.border]}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      {r.employee && <Text style={s.main}>{r.employee.firstName} {r.employee.lastName}</Text>}
                      <Text style={r.employee ? s.sub : s.main}>{r.leaveType?.name}</Text>
                      <Text style={s.sub}>{r.startDate} → {r.endDate} ({r.daysRequested} days)</Text>
                      {r.reason ? <Text style={s.sub2}>{r.reason}</Text> : null}
                    </View>
                    <StatusBadge status={r.status} />
                  </View>
                  {canAdmin && r.status === 'pending' && (
                    <View style={[s.actionRow, { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 0 }]}>
                      <ActionBtn label="Approve" color="#16A34A" onPress={() => approveRequest(r)} />
                      <ActionBtn label="Reject" color="#DC2626" onPress={() => openReject(r)} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}
        {view === 'balance' && (
          <>
            <Text style={s.sectionTitle}>Leave Balances</Text>
            {balances.length === 0 ? (
              <View style={[s.card, { marginBottom: 32 }]}><Empty msg="No leave balances" /></View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16, marginBottom: 32 }}>
                {balances.map((b, i) => {
                  const pct = b.entitledDays > 0 ? Math.round(((b.remainingDays ?? 0) / b.entitledDays) * 100) : 0;
                  return (
                    <View key={i} style={s.balCard}>
                      <Text style={s.balName}>{b.leaveType?.name}</Text>
                      <Text style={s.balNum}>{b.remainingDays ?? 0}<Text style={s.balOf}>/{b.entitledDays ?? 0}</Text></Text>
                      <View style={s.barBg}><View style={[s.barFg, { width: `${pct}%` as any }]} /></View>
                      <Text style={s.balSub}>Used: {b.usedDays ?? 0} · Remaining: {b.remainingDays ?? 0}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </ScrollView>
      {employeeId && <FAB onPress={() => setShowApply(true)} />}

      <FormModal visible={showApply} title="Apply for Leave" onClose={() => setShowApply(false)} onSubmit={applyLeave} submitting={saving}>
        <SelectField label="Leave Type" value={form.leaveTypeId} onChange={v => setForm(f => ({ ...f, leaveTypeId: v }))}
          options={leaveTypes.map(lt => ({ label: lt.name, value: lt.id }))} />
        <Field label="Start Date" value={form.startDate} onChangeText={v => setForm(f => ({ ...f, startDate: v }))} placeholder="YYYY-MM-DD" required />
        <Field label="End Date" value={form.endDate} onChangeText={v => setForm(f => ({ ...f, endDate: v }))} placeholder="YYYY-MM-DD" required />
        <Field label="Reason" value={form.reason} onChangeText={v => setForm(f => ({ ...f, reason: v }))} multiline placeholder="Optional reason" />
      </FormModal>

      <FormModal visible={showReject} title="Reject Leave Request" onClose={() => setShowReject(false)} onSubmit={rejectRequest} submitting={saving} submitLabel="Reject">
        <Field label="Reason for Rejection" value={rejectReason} onChangeText={setRejectReason} multiline required />
      </FormModal>
    </View>
  );
}

/* ═══════════════════════ PAYROLL TAB ═══════════════════════ */
function PayrollTab({ tenantId, employeeId }: { tenantId: string; employeeId: string | null }) {
  const { isAdmin, isAccountant } = useRole();
  const canAdmin = isAdmin || isAccountant;

  const [view, setView] = useState<'runs' | 'payslips' | 'approvals'>('runs');
  const [runs, setRuns] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [filteredPayslips, setFilteredPayslips] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateRun, setShowCreateRun] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runForm, setRunForm] = useState({ period: '', currency: 'ZMW' });

  const load = useCallback(async () => {
    try {
      const rData = await gql<any>(`query($t:UUID!){payrollRuns(tenantId:$t,limit:20){id periodLabel periodStart periodEnd status totalGross totalNet employeeCount}}`, { t: tenantId });
      const allRuns = rData?.payrollRuns || [];
      setRuns(allRuns);
      setApprovals(allRuns.filter((r: any) => r.status === 'pending_approval'));
    } catch { } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!search) { setFilteredPayslips(payslips); return; }
    setFilteredPayslips(payslips.filter((p: any) =>
      `${p.employee?.firstName} ${p.employee?.lastName} ${p.period}`.toLowerCase().includes(search.toLowerCase())
    ));
  }, [search, payslips]);

  const createRun = async () => {
    if (!runForm.period) { Alert.alert('Error', 'Period required'); return; }
    setSaving(true);
    try {
      await gql<any>(`mutation($t:UUID!,$p:String!,$c:String){createPayrollRun(tenantId:$t,period:$p,currency:$c){ok error}}`,
        { t: tenantId, p: runForm.period, c: runForm.currency });
      setShowCreateRun(false);
      setRunForm({ period: '', currency: 'ZMW' });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  const calcRun = async (run: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){calculatePayrollRun(runId:$id){ok error}}`, { id: run.id });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const approveRun = async (run: any) => {
    try {
      await gql<any>(`mutation($id:UUID!){approvePayrollRun(runId:$id){ok error}}`, { id: run.id });
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <View style={s.subChipRow}>
        <SubChip label="Runs" active={view === 'runs'} onPress={() => setView('runs')} />
        <SubChip label="Payslips" active={view === 'payslips'} onPress={() => setView('payslips')} />
        <SubChip label="Approvals" active={view === 'approvals'} onPress={() => setView('approvals')} />
      </View>

      {view === 'runs' && (
        <View style={{ flex: 1 }}>
          <ScrollView style={{ flex: 1 }}>
            <Text style={s.sectionTitle}>Payroll Runs ({runs.length})</Text>
            <View style={[s.card, { marginBottom: 100 }]}>
              {runs.length === 0 ? <Empty msg="No payroll runs" /> : runs.map((r, i) => (
                <View key={r.id} style={[{ paddingVertical: 12 }, i < runs.length - 1 && s.border]}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.main}>{r.periodLabel}</Text>
                      <Text style={s.sub}>{r.periodStart?.slice(0, 10)} → {r.periodEnd?.slice(0, 10)}</Text>
                      <Text style={s.sub2}>Gross: {fmt(r.totalGross)} · Net: {fmt(r.totalNet)} · {r.employeeCount} employees</Text>
                    </View>
                    <StatusBadge status={r.status} />
                  </View>
                  {canAdmin && (
                    <View style={[s.actionRow, { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 0 }]}>
                      {r.status === 'draft' && <ActionBtn label="Calculate" color={GOLD} onPress={() => calcRun(r)} />}
                      {r.status === 'calculated' && <ActionBtn label="Approve" color="#16A34A" onPress={() => approveRun(r)} />}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
          {canAdmin && <FAB onPress={() => setShowCreateRun(true)} />}
        </View>
      )}

      {view === 'payslips' && (
        <View style={[s.center, { padding: 32 }]}>
          <Text style={[s.main, { textAlign: 'center', color: '#6B7280' }]}>
            Payslips are available on the web portal.{'\n'}Please log in via browser to view and download payslips.
          </Text>
        </View>
      )}

      {view === 'approvals' && (
        <ScrollView style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Pending Approvals ({approvals.length})</Text>
          <View style={[s.card, { marginBottom: 32 }]}>
            {approvals.length === 0 ? <Empty msg="No pending approvals" /> : approvals.map((a, i) => (
              <View key={a.id} style={[{ paddingVertical: 12 }, i < approvals.length - 1 && s.border]}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.main}>{a.periodLabel}</Text>
                    <Text style={s.sub}>{a.periodStart?.slice(0, 10)} → {a.periodEnd?.slice(0, 10)}</Text>
                    <Text style={s.sub2}>Gross: {fmt(a.totalGross)} · Net: {fmt(a.totalNet)}</Text>
                  </View>
                  <StatusBadge status={a.status} />
                </View>
                {canAdmin && (
                  <View style={[s.actionRow, { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 0 }]}>
                    <ActionBtn label="Approve" color="#16A34A" onPress={() => approveRun(a)} />
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <FormModal visible={showCreateRun} title="New Payroll Run" onClose={() => setShowCreateRun(false)} onSubmit={createRun} submitting={saving}>
        <Field label="Period" value={runForm.period} onChangeText={v => setRunForm(f => ({ ...f, period: v }))} placeholder="e.g. 2026-08" required />
        <SelectField label="Currency" value={runForm.currency} onChange={v => setRunForm(f => ({ ...f, currency: v }))}
          options={[{ label: 'ZMW', value: 'ZMW' }, { label: 'USD', value: 'USD' }]} />
      </FormModal>

      {/* Payslip detail modal */}
      <Modal visible={!!selectedPayslip} animationType="slide" onRequestClose={() => setSelectedPayslip(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Payslip</Text>
          <TouchableOpacity onPress={() => setSelectedPayslip(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selectedPayslip && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={{ alignItems: 'center', backgroundColor: NAVY, padding: 16 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
                {selectedPayslip.employee?.firstName} {selectedPayslip.employee?.lastName}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>{selectedPayslip.period}</Text>
            </View>
            <View style={[s.card, { marginTop: 12, marginBottom: 32 }]}>
              {([
                ['Basic Salary', fmt(selectedPayslip.basicSalary)],
                ['Gross Earnings', fmt(selectedPayslip.grossPay)],
                ['PAYE', fmt(selectedPayslip.paye)],
                ['NAPSA (Employee)', fmt(selectedPayslip.napsaEmployee)],
                ['NHIMA', fmt(selectedPayslip.nhima)],
                ['Total Deductions', fmt(selectedPayslip.totalDeductions)],
                ['Net Pay', fmt(selectedPayslip.netPay)],
              ] as [string, string][]).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={[s.detailValue, l === 'Net Pay' && { fontWeight: '800', color: NAVY }]}>{v}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

/* ═══════════════════════ ATTENDANCE TAB ═══════════════════════ */
function AttendanceTab({ tenantId, employeeId }: { tenantId: string; employeeId: string | null }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!employeeId) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = await gql<any>(
        `query($e:UUID!){attendanceRecords(employeeId:$e,limit:50){id workDate checkIn checkOut hoursWorked notes employee{firstName lastName}}}`,
        { e: employeeId }
      );
      setRecords((d?.attendanceRecords || []).filter(Boolean));
    } catch { } finally { setLoading(false); }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  if (!employeeId) {
    return (
      <View style={s.center}>
        <Text style={[s.empty, { color: '#6B7280' }]}>Sign in as an employee to view attendance records.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {loading ? <Loader /> : (
        <ScrollView style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Attendance Records ({records.length})</Text>
          <View style={[s.card, { marginBottom: 32 }]}>
            {records.length === 0 ? <Empty msg="No attendance records" /> : records.map((r, i) => (
              <View key={r.id} style={[s.row, i < records.length - 1 && s.border]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.main}>{r.workDate}</Text>
                  <Text style={s.sub}>In: {r.checkIn || '–'} · Out: {r.checkOut || '–'}</Text>
                  {r.hoursWorked ? <Text style={s.sub2}>{r.hoursWorked} hrs worked</Text> : null}
                  {r.notes ? <Text style={s.sub2}>{r.notes}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/* ═══════════════════════ TIMESHEETS TAB ═══════════════════════ */
function TimesheetsTab({ tenantId, employeeId }: { tenantId: string; employeeId: string | null }) {
  const { isAdmin, isHRAdmin } = useRole();
  const canAdmin = isAdmin || isHRAdmin;

  const [sheets, setSheets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await gql<any>(
        `query($t:UUID!){timesheets(tenantId:$t)}`,
        { t: tenantId }
      );
      setSheets(Array.isArray(d?.timesheets) ? d.timesheets : []);
    } catch { } finally { setLoading(false); }
  }, [tenantId, employeeId]);

  useEffect(() => { load(); }, [load]);

  const approveSheet = async (ts: any) => {
    setSaving(true);
    try {
      await gql<any>(`mutation($id:UUID!){approveTimesheet(timesheetId:$id){ok error}}`, { id: ts.id });
      setSelected(null);
      load();
    } catch (e: any) { Alert.alert('Error', e.message); } finally { setSaving(false); }
  };

  if (loading) return <Loader />;
  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Timesheets ({sheets.length})</Text>
        <View style={[s.card, { marginBottom: 32 }]}>
          {sheets.length === 0 ? <Empty msg="No timesheets" /> : sheets.map((ts, i) => (
            <TouchableOpacity key={ts.id} style={[s.row, i < sheets.length - 1 && s.border]} onPress={() => setSelected(ts)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={s.main}>{ts.employee?.firstName} {ts.employee?.lastName}</Text>
                <Text style={s.sub}>Week of {ts.weekStart}</Text>
                <Text style={s.sub2}>{ts.totalHours} hrs total</Text>
              </View>
              <StatusBadge status={ts.status} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Timesheet Detail</Text>
          <TouchableOpacity onPress={() => setSelected(null)}><Text style={s.modalClose}>✕</Text></TouchableOpacity>
        </View>
        {selected && (
          <ScrollView style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
            <View style={[s.card, { marginTop: 12 }]}>
              {([
                ['Employee', `${selected.employee?.firstName} ${selected.employee?.lastName}`],
                ['Week of', selected.weekStart],
                ['Total Hours', `${selected.totalHours} hrs`],
                ['Status', selected.status],
              ] as [string, string][]).map(([l, v]) => (
                <View key={l} style={[s.detailRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                  <Text style={s.detailLabel}>{l}</Text>
                  <Text style={s.detailValue}>{v}</Text>
                </View>
              ))}
            </View>
            {Array.isArray(selected.entries) && selected.entries.length > 0 && (
              <>
                <Text style={s.sectionTitle}>Daily Breakdown</Text>
                <View style={[s.card, { marginBottom: 12 }]}>
                  {selected.entries.map((e: any, i: number) => (
                    <View key={i} style={[s.row, i < selected.entries.length - 1 && s.border]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.main}>{e.date}</Text>
                        {e.notes ? <Text style={s.sub}>{e.notes}</Text> : null}
                      </View>
                      <Text style={s.amount}>{e.hours} hrs</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {canAdmin && selected.status === 'submitted' && (
              <View style={s.actionRow}>
                <ActionBtn label={saving ? 'Approving…' : 'Approve'} color="#16A34A" onPress={() => approveSheet(selected)} />
              </View>
            )}
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}

/* ═══════════════════════ MAIN SCREEN ═══════════════════════ */
export default function HRScreen() {
  const { tenant, employeeId } = useAuth();
  const tenantId = tenant?.id || '';
  const [tab, setTab] = useState('overview');

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>
      <ModuleTabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab tenantId={tenantId} />}
      {tab === 'employees' && <EmployeesTab tenantId={tenantId} />}
      {tab === 'leave' && <LeaveTab tenantId={tenantId} employeeId={employeeId} />}
      {tab === 'payroll' && <PayrollTab tenantId={tenantId} employeeId={employeeId} />}
      {tab === 'attendance' && <AttendanceTab tenantId={tenantId} employeeId={employeeId} />}
      {tab === 'timesheets' && <TimesheetsTab tenantId={tenantId} employeeId={employeeId} />}
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  empty: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  main: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sub2: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  amount: { fontSize: 14, fontWeight: '700', color: NAVY },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: NAVY, marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: NAVY + '18', justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '700', color: NAVY },
  modalHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', backgroundColor: '#fff' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: NAVY },
  modalClose: { fontSize: 18, color: '#6B7280', padding: 4 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  detailLabel: { fontSize: 13, color: '#6B7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  actionBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10, backgroundColor: NAVY },
  actionBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  searchInput: { backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  chipRow: { paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontSize: 12, fontWeight: '600', color: '#374151' },
  chipTxtActive: { color: '#fff' },
  subChipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  subChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  subChipActive: { backgroundColor: NAVY, borderColor: NAVY },
  subChipTxt: { fontSize: 13, fontWeight: '600', color: '#374151' },
  subChipTxtActive: { color: '#fff' },
  statGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  statNum: { fontSize: 22, fontWeight: '800', color: NAVY },
  statLbl: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  balCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginRight: 10, width: 140, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  balName: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 6 },
  balNum: { fontSize: 24, fontWeight: '800', color: NAVY },
  balOf: { fontSize: 14, fontWeight: '400', color: '#9CA3AF' },
  barBg: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, marginVertical: 6 },
  barFg: { height: 4, backgroundColor: GOLD, borderRadius: 2 },
  balSub: { fontSize: 10, color: '#9CA3AF' },
  dateBtn: { backgroundColor: NAVY, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  dateBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
