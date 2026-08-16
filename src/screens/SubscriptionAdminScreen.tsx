/**
 * Subscription Admin Screen — Platform Admin only (isStaff)
 * Lets the platform admin view and edit all subscription plan prices,
 * module add-on prices, and addon pack prices. Also shows all tenant
 * subscriptions and allows assigning a plan to a tenant.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, Modal, ActivityIndicator, RefreshControl,
} from 'react-native';
import { gql } from '../api/graphql';

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';
const SUCCESS = '#059669';
const DANGER = '#DC2626';
const WARN = '#D97706';

// ─── GraphQL ────────────────────────────────────────────────────

const Q_PLANS = `{
  subscriptionPlans {
    id name description basePrice currency
    maxUsers maxBranches maxWarehouses trialDays
    isActive isPublic isFeatured displayOrder billingCycle
    includedModules
  }
}`;

const Q_MODULES = `{
  modules {
    id code name description category
    monthlyPrice yearlyPrice perUserPrice includedUsers
    isActive isBeta displayOrder
  }
}`;

const Q_ADDON_PACKS = `{
  addonPacks {
    id code name description metricKey
    monthlyPrice yearlyPrice unitsIncluded isActive
  }
}`;

const Q_TENANT_SUBS = `{
  allTenantSubscriptions {
    id status startDate endDate
    tenant { id name }
    plan { id name basePrice }
  }
}`;

const M_UPDATE_PLAN = (planId: string, fields: Record<string, any>) => {
  const args = Object.entries(fields)
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}: "${v}"`;
      if (typeof v === 'boolean') return `${k}: ${v}`;
      return `${k}: ${v}`;
    })
    .join(', ');
  return `mutation { updateSubscriptionPlan(planId: "${planId}", ${args}) { ok error plan { id name basePrice maxUsers maxBranches maxWarehouses } } }`;
};

const M_UPDATE_MODULE = (moduleId: string, fields: Record<string, any>) => {
  const args = Object.entries(fields)
    .map(([k, v]) => (typeof v === 'string' ? `${k}: "${v}"` : `${k}: ${v}`))
    .join(', ');
  return `mutation { updateModule(moduleId: "${moduleId}", ${args}) { ok error module { id name monthlyPrice yearlyPrice } } }`;
};

const M_UPDATE_ADDON = (addonId: string, fields: Record<string, any>) => {
  const args = Object.entries(fields)
    .map(([k, v]) => (typeof v === 'string' ? `${k}: "${v}"` : `${k}: ${v}`))
    .join(', ');
  return `mutation { updateAddonPack(addonId: "${addonId}", ${args}) { ok error addon { id name monthlyPrice yearlyPrice } } }`;
};

const M_CREATE_PLAN = `
  mutation($name:String!,$description:String,$basePrice:Decimal!,$maxUsers:Int,$maxBranches:Int,$maxWarehouses:Int,$trialDays:Int,$billingCycle:String) {
    createSubscriptionPlan(name:$name,description:$description,basePrice:$basePrice,maxUsers:$maxUsers,maxBranches:$maxBranches,maxWarehouses:$maxWarehouses,trialDays:$trialDays,billingCycle:$billingCycle) {
      ok error plan { id name }
    }
  }
`;

const M_CREATE_MODULE = `
  mutation($name:String!,$code:String!,$monthlyPrice:Decimal!,$yearlyPrice:Decimal,$category:String) {
    createModule(name:$name,code:$code,monthlyPrice:$monthlyPrice,yearlyPrice:$yearlyPrice,category:$category) {
      ok error module { id name }
    }
  }
`;

const M_CREATE_ADDON = `
  mutation($name:String!,$code:String!,$monthlyPrice:Decimal!,$yearlyPrice:Decimal,$unitsIncluded:Int,$metricKey:String) {
    createAddonPack(name:$name,code:$code,monthlyPrice:$monthlyPrice,yearlyPrice:$yearlyPrice,unitsIncluded:$unitsIncluded,metricKey:$metricKey) {
      ok error addon { id name }
    }
  }
`;

const M_SEED = `mutation { seedModularCatalog { ok message } }`;

// ─── Types ──────────────────────────────────────────────────────

interface Plan {
  id: string; name: string; description: string; basePrice: string;
  currency: string; maxUsers: number; maxBranches: number; maxWarehouses: number;
  trialDays: number; isActive: boolean; isPublic: boolean; isFeatured: boolean;
  displayOrder: number; billingCycle: string; includedModules: string[];
}

interface Module {
  id: string; code: string; name: string; description: string; category: string;
  monthlyPrice: string; yearlyPrice: string; perUserPrice: string;
  includedUsers: number; isActive: boolean; isBeta: boolean; displayOrder: number;
}

interface AddonPack {
  id: string; code: string; name: string; description: string; metricKey: string;
  monthlyPrice: string; yearlyPrice: string; unitsIncluded: number; isActive: boolean;
}

interface TenantSub {
  id: string; status: string; startDate: string; endDate: string;
  tenant: { id: string; name: string };
  plan: { id: string; name: string; basePrice: string };
}

// ─── Tab ────────────────────────────────────────────────────────

type TabKey = 'plans' | 'modules' | 'addons' | 'tenants';
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'plans',   label: 'Plans',     icon: '📋' },
  { key: 'modules', label: 'Modules',   icon: '🧩' },
  { key: 'addons',  label: 'Add-Ons',   icon: '⚡' },
  { key: 'tenants', label: 'Tenants',   icon: '🏢' },
];

// ─── Helper: numeric input to string ────────────────────────────
const toNum = (s: string) => parseFloat(s) || 0;
const fmt = (v: string | number) => Number(v).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Edit Modal ──────────────────────────────────────────────────
interface EditField { label: string; key: string; type: 'text' | 'number' | 'bool' }

function EditModal({
  visible, title, fields, values, onClose, onSave, saving,
}: {
  visible: boolean; title: string; fields: EditField[];
  values: Record<string, any>; saving: boolean;
  onClose: () => void; onSave: (vals: Record<string, any>) => void;
}) {
  const [local, setLocal] = useState<Record<string, any>>({});

  useEffect(() => {
    if (visible) setLocal({ ...values });
  }, [visible, values]);

  const set = (k: string, v: any) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.card}>
          <View style={m.header}>
            <Text style={m.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Text style={{ color: '#6B7280', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {fields.map(f => (
              <View key={f.key} style={{ marginBottom: 14 }}>
                <Text style={m.label}>{f.label}</Text>
                {f.type === 'bool' ? (
                  <TouchableOpacity
                    style={[m.toggle, local[f.key] && m.toggleOn]}
                    onPress={() => set(f.key, !local[f.key])}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: local[f.key] ? '#fff' : '#374151', fontWeight: '600', fontSize: 13 }}>
                      {local[f.key] ? 'Yes' : 'No'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TextInput
                    style={m.input}
                    value={String(local[f.key] ?? '')}
                    onChangeText={v => set(f.key, f.type === 'number' ? v : v)}
                    keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>
            ))}
          </ScrollView>
          <View style={m.actions}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, saving && { opacity: 0.6 }]}
              onPress={() => onSave(local)}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={m.saveTxt}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Create Modal ────────────────────────────────────────────────
function CreateModal({
  visible, title, fields, onClose, onSave, saving,
}: {
  visible: boolean; title: string; fields: EditField[];
  saving: boolean; onClose: () => void;
  onSave: (vals: Record<string, any>) => void;
}) {
  const [local, setLocal] = useState<Record<string, any>>({});
  useEffect(() => { if (visible) setLocal({}); }, [visible]);
  const set = (k: string, v: any) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.card}>
          <View style={m.header}>
            <Text style={m.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <Text style={{ color: '#6B7280', fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {fields.map(f => (
              <View key={f.key} style={{ marginBottom: 14 }}>
                <Text style={m.label}>{f.label}</Text>
                {f.type === 'bool' ? (
                  <TouchableOpacity
                    style={[m.toggle, local[f.key] && m.toggleOn]}
                    onPress={() => set(f.key, !local[f.key])}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: local[f.key] ? '#fff' : '#374151', fontWeight: '600', fontSize: 13 }}>
                      {local[f.key] ? 'Yes' : 'No'}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TextInput
                    style={m.input}
                    value={String(local[f.key] ?? '')}
                    onChangeText={v => set(f.key, v)}
                    keyboardType={f.type === 'number' ? 'decimal-pad' : 'default'}
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                    placeholderTextColor="#9CA3AF"
                  />
                )}
              </View>
            ))}
          </ScrollView>
          <View style={m.actions}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={m.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, saving && { opacity: 0.6 }]}
              onPress={() => onSave(local)}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={m.saveTxt}>Create</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Plans Tab ──────────────────────────────────────────────────

function PlansTab({ plans, reload }: { plans: Plan[]; reload: () => void }) {
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const planFields: EditField[] = [
    { label: 'Name', key: 'name', type: 'text' },
    { label: 'Description', key: 'description', type: 'text' },
    { label: 'Base Price (ZMW/yr)', key: 'basePrice', type: 'number' },
    { label: 'Max Users', key: 'maxUsers', type: 'number' },
    { label: 'Max Branches', key: 'maxBranches', type: 'number' },
    { label: 'Max Warehouses', key: 'maxWarehouses', type: 'number' },
    { label: 'Trial Days', key: 'trialDays', type: 'number' },
    { label: 'Active', key: 'isActive', type: 'bool' },
    { label: 'Public (visible to customers)', key: 'isPublic', type: 'bool' },
    { label: 'Featured', key: 'isFeatured', type: 'bool' },
  ];

  const createFields: EditField[] = [
    { label: 'Name', key: 'name', type: 'text' },
    { label: 'Description', key: 'description', type: 'text' },
    { label: 'Base Price (ZMW/yr)', key: 'basePrice', type: 'number' },
    { label: 'Max Users', key: 'maxUsers', type: 'number' },
    { label: 'Max Branches', key: 'maxBranches', type: 'number' },
    { label: 'Max Warehouses', key: 'maxWarehouses', type: 'number' },
    { label: 'Trial Days', key: 'trialDays', type: 'number' },
    { label: 'Billing Cycle (monthly/yearly)', key: 'billingCycle', type: 'text' },
  ];

  const handleSave = async (vals: Record<string, any>) => {
    if (!editing) return;
    setSaving(true);
    try {
      const changed: Record<string, any> = {};
      if (vals.name !== editing.name) changed.name = vals.name;
      if (vals.description !== editing.description) changed.description = vals.description;
      if (String(vals.basePrice) !== String(editing.basePrice)) changed.basePrice = toNum(vals.basePrice);
      if (Number(vals.maxUsers) !== editing.maxUsers) changed.maxUsers = Number(vals.maxUsers);
      if (Number(vals.maxBranches) !== editing.maxBranches) changed.maxBranches = Number(vals.maxBranches);
      if (Number(vals.maxWarehouses) !== editing.maxWarehouses) changed.maxWarehouses = Number(vals.maxWarehouses);
      if (Number(vals.trialDays) !== editing.trialDays) changed.trialDays = Number(vals.trialDays);
      if (vals.isActive !== editing.isActive) changed.isActive = vals.isActive;
      if (vals.isPublic !== editing.isPublic) changed.isPublic = vals.isPublic;
      if (vals.isFeatured !== editing.isFeatured) changed.isFeatured = vals.isFeatured;

      if (Object.keys(changed).length === 0) { setEditing(null); return; }

      const res = await gql<any>(M_UPDATE_PLAN(editing.id, changed));
      if (res?.updateSubscriptionPlan?.ok) {
        Alert.alert('✓ Saved', 'Plan updated successfully');
        setEditing(null);
        reload();
      } else {
        Alert.alert('Error', res?.updateSubscriptionPlan?.error || 'Failed to update');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (vals: Record<string, any>) => {
    if (!vals.name || !vals.basePrice) {
      Alert.alert('Required', 'Name and Base Price are required'); return;
    }
    setSaving(true);
    try {
      const res = await gql<any>(M_CREATE_PLAN, {
        name: vals.name,
        description: vals.description || '',
        basePrice: toNum(vals.basePrice),
        maxUsers: Number(vals.maxUsers) || 5,
        maxBranches: Number(vals.maxBranches) || 1,
        maxWarehouses: Number(vals.maxWarehouses) || 1,
        trialDays: Number(vals.trialDays) || 14,
        billingCycle: vals.billingCycle || 'yearly',
      });
      if (res?.createSubscriptionPlan?.ok) {
        Alert.alert('✓ Created', `Plan "${vals.name}" created`);
        setCreating(false);
        reload();
      } else {
        Alert.alert('Error', res?.createSubscriptionPlan?.error || 'Failed to create');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={t.addBtn} onPress={() => setCreating(true)} activeOpacity={0.8}>
        <Text style={t.addBtnTxt}>+ New Plan</Text>
      </TouchableOpacity>
      {plans.map(plan => (
        <View key={plan.id} style={t.card}>
          <View style={t.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={t.cardTitle}>{plan.name}</Text>
                {plan.isFeatured && <Text style={t.badge}>⭐ Featured</Text>}
                {!plan.isActive && <Text style={[t.badge, { backgroundColor: '#FEE2E2', color: DANGER }]}>Inactive</Text>}
                {!plan.isPublic && <Text style={[t.badge, { backgroundColor: '#FEF3C7', color: WARN }]}>Private</Text>}
              </View>
              {plan.description ? <Text style={t.cardSub} numberOfLines={2}>{plan.description}</Text> : null}
            </View>
            <TouchableOpacity style={t.editBtn} onPress={() => setEditing(plan)} activeOpacity={0.8}>
              <Text style={t.editBtnTxt}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={t.row}>
            <Stat label="Price/yr" value={`K${fmt(plan.basePrice)}`} color={NAVY} />
            <Stat label="Users" value={String(plan.maxUsers)} />
            <Stat label="Branches" value={String(plan.maxBranches)} />
            <Stat label="Warehouses" value={String(plan.maxWarehouses)} />
            <Stat label="Trial" value={`${plan.trialDays}d`} />
          </View>
        </View>
      ))}

      <EditModal
        visible={!!editing}
        title={`Edit Plan: ${editing?.name}`}
        fields={planFields}
        values={editing || {}}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
      <CreateModal
        visible={creating}
        title="Create New Plan"
        fields={createFields}
        saving={saving}
        onClose={() => setCreating(false)}
        onSave={handleCreate}
      />
    </View>
  );
}

// ─── Modules Tab ────────────────────────────────────────────────

function ModulesTab({ modules, reload }: { modules: Module[]; reload: () => void }) {
  const [editing, setEditing] = useState<Module | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const editFields: EditField[] = [
    { label: 'Name', key: 'name', type: 'text' },
    { label: 'Description', key: 'description', type: 'text' },
    { label: 'Category', key: 'category', type: 'text' },
    { label: 'Monthly Price (ZMW)', key: 'monthlyPrice', type: 'number' },
    { label: 'Yearly Price (ZMW)', key: 'yearlyPrice', type: 'number' },
    { label: 'Per-User Price (ZMW)', key: 'perUserPrice', type: 'number' },
    { label: 'Included Users', key: 'includedUsers', type: 'number' },
    { label: 'Active', key: 'isActive', type: 'bool' },
    { label: 'Beta', key: 'isBeta', type: 'bool' },
  ];

  const createFields: EditField[] = [
    { label: 'Name', key: 'name', type: 'text' },
    { label: 'Code (unique slug)', key: 'code', type: 'text' },
    { label: 'Category', key: 'category', type: 'text' },
    { label: 'Monthly Price (ZMW)', key: 'monthlyPrice', type: 'number' },
    { label: 'Yearly Price (ZMW)', key: 'yearlyPrice', type: 'number' },
  ];

  const handleSave = async (vals: Record<string, any>) => {
    if (!editing) return;
    setSaving(true);
    try {
      const changed: Record<string, any> = {};
      if (vals.name !== editing.name) changed.name = vals.name;
      if (vals.description !== editing.description) changed.description = vals.description;
      if (vals.category !== editing.category) changed.category = vals.category;
      if (String(vals.monthlyPrice) !== String(editing.monthlyPrice)) changed.monthlyPrice = toNum(vals.monthlyPrice);
      if (String(vals.yearlyPrice) !== String(editing.yearlyPrice)) changed.yearlyPrice = toNum(vals.yearlyPrice);
      if (String(vals.perUserPrice) !== String(editing.perUserPrice)) changed.perUserPrice = toNum(vals.perUserPrice);
      if (Number(vals.includedUsers) !== editing.includedUsers) changed.includedUsers = Number(vals.includedUsers);
      if (vals.isActive !== editing.isActive) changed.isActive = vals.isActive;
      if (vals.isBeta !== editing.isBeta) changed.isBeta = vals.isBeta;

      if (Object.keys(changed).length === 0) { setEditing(null); return; }

      const res = await gql<any>(M_UPDATE_MODULE(editing.id, changed));
      if (res?.updateModule?.ok) {
        Alert.alert('✓ Saved', 'Module updated');
        setEditing(null);
        reload();
      } else {
        Alert.alert('Error', res?.updateModule?.error || 'Failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const handleCreate = async (vals: Record<string, any>) => {
    if (!vals.name || !vals.code || !vals.monthlyPrice) {
      Alert.alert('Required', 'Name, Code, and Monthly Price are required'); return;
    }
    setSaving(true);
    try {
      const res = await gql<any>(M_CREATE_MODULE, {
        name: vals.name, code: vals.code,
        monthlyPrice: toNum(vals.monthlyPrice),
        yearlyPrice: toNum(vals.yearlyPrice) || toNum(vals.monthlyPrice) * 10,
        category: vals.category || 'general',
      });
      if (res?.createModule?.ok) {
        Alert.alert('✓ Created', `Module "${vals.name}" created`);
        setCreating(false);
        reload();
      } else {
        Alert.alert('Error', res?.createModule?.error || 'Failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  // Group by category
  const grouped: Record<string, Module[]> = {};
  modules.forEach(m => {
    const cat = m.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m);
  });

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={t.addBtn} onPress={() => setCreating(true)} activeOpacity={0.8}>
        <Text style={t.addBtnTxt}>+ New Module</Text>
      </TouchableOpacity>
      {Object.entries(grouped).map(([cat, mods]) => (
        <View key={cat}>
          <Text style={t.sectionHdr}>{cat.toUpperCase()}</Text>
          {mods.map(mod => (
            <View key={mod.id} style={t.card}>
              <View style={t.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={t.cardTitle}>{mod.name}</Text>
                    {mod.isBeta && <Text style={[t.badge, { backgroundColor: '#EDE9FE', color: '#7C3AED' }]}>Beta</Text>}
                    {!mod.isActive && <Text style={[t.badge, { backgroundColor: '#FEE2E2', color: DANGER }]}>Inactive</Text>}
                  </View>
                  <Text style={t.cardSub}>{mod.code}</Text>
                </View>
                <TouchableOpacity style={t.editBtn} onPress={() => setEditing(mod)} activeOpacity={0.8}>
                  <Text style={t.editBtnTxt}>Edit</Text>
                </TouchableOpacity>
              </View>
              <View style={t.row}>
                <Stat label="Monthly" value={`K${fmt(mod.monthlyPrice)}`} color={NAVY} />
                <Stat label="Yearly" value={`K${fmt(mod.yearlyPrice)}`} color={SUCCESS} />
                {Number(mod.perUserPrice) > 0 && <Stat label="/User" value={`K${fmt(mod.perUserPrice)}`} />}
              </View>
            </View>
          ))}
        </View>
      ))}

      <EditModal
        visible={!!editing}
        title={`Edit Module: ${editing?.name}`}
        fields={editFields}
        values={editing || {}}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
      <CreateModal
        visible={creating}
        title="Create New Module"
        fields={createFields}
        saving={saving}
        onClose={() => setCreating(false)}
        onSave={handleCreate}
      />
    </View>
  );
}

// ─── Add-Ons Tab ─────────────────────────────────────────────────

function AddonsTab({ addons, reload }: { addons: AddonPack[]; reload: () => void }) {
  const [editing, setEditing] = useState<AddonPack | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const editFields: EditField[] = [
    { label: 'Name', key: 'name', type: 'text' },
    { label: 'Description', key: 'description', type: 'text' },
    { label: 'Monthly Price (ZMW)', key: 'monthlyPrice', type: 'number' },
    { label: 'Yearly Price (ZMW)', key: 'yearlyPrice', type: 'number' },
    { label: 'Units Included', key: 'unitsIncluded', type: 'number' },
    { label: 'Active', key: 'isActive', type: 'bool' },
  ];

  const createFields: EditField[] = [
    { label: 'Name', key: 'name', type: 'text' },
    { label: 'Code (unique slug)', key: 'code', type: 'text' },
    { label: 'Metric Key (e.g. extra_users)', key: 'metricKey', type: 'text' },
    { label: 'Monthly Price (ZMW)', key: 'monthlyPrice', type: 'number' },
    { label: 'Yearly Price (ZMW)', key: 'yearlyPrice', type: 'number' },
    { label: 'Units Included', key: 'unitsIncluded', type: 'number' },
  ];

  const handleSave = async (vals: Record<string, any>) => {
    if (!editing) return;
    setSaving(true);
    try {
      const changed: Record<string, any> = {};
      if (vals.name !== editing.name) changed.name = vals.name;
      if (vals.description !== editing.description) changed.description = vals.description;
      if (String(vals.monthlyPrice) !== String(editing.monthlyPrice)) changed.monthlyPrice = toNum(vals.monthlyPrice);
      if (String(vals.yearlyPrice) !== String(editing.yearlyPrice)) changed.yearlyPrice = toNum(vals.yearlyPrice);
      if (Number(vals.unitsIncluded) !== editing.unitsIncluded) changed.unitsIncluded = Number(vals.unitsIncluded);
      if (vals.isActive !== editing.isActive) changed.isActive = vals.isActive;

      if (Object.keys(changed).length === 0) { setEditing(null); return; }
      const res = await gql<any>(M_UPDATE_ADDON(editing.id, changed));
      if (res?.updateAddonPack?.ok) {
        Alert.alert('✓ Saved', 'Add-on updated');
        setEditing(null);
        reload();
      } else {
        Alert.alert('Error', res?.updateAddonPack?.error || 'Failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  const handleCreate = async (vals: Record<string, any>) => {
    if (!vals.name || !vals.code || !vals.monthlyPrice) {
      Alert.alert('Required', 'Name, Code, and Monthly Price are required'); return;
    }
    setSaving(true);
    try {
      const res = await gql<any>(M_CREATE_ADDON, {
        name: vals.name, code: vals.code,
        metricKey: vals.metricKey || vals.code,
        monthlyPrice: toNum(vals.monthlyPrice),
        yearlyPrice: toNum(vals.yearlyPrice) || toNum(vals.monthlyPrice) * 10,
        unitsIncluded: Number(vals.unitsIncluded) || 1,
      });
      if (res?.createAddonPack?.ok) {
        Alert.alert('✓ Created', `Add-on "${vals.name}" created`);
        setCreating(false);
        reload();
      } else {
        Alert.alert('Error', res?.createAddonPack?.error || 'Failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity style={t.addBtn} onPress={() => setCreating(true)} activeOpacity={0.8}>
        <Text style={t.addBtnTxt}>+ New Add-On Pack</Text>
      </TouchableOpacity>
      {addons.map(addon => (
        <View key={addon.id} style={t.card}>
          <View style={t.cardHeader}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Text style={t.cardTitle}>{addon.name}</Text>
                {!addon.isActive && <Text style={[t.badge, { backgroundColor: '#FEE2E2', color: DANGER }]}>Inactive</Text>}
              </View>
              <Text style={t.cardSub}>{addon.code} · metric: {addon.metricKey}</Text>
            </View>
            <TouchableOpacity style={t.editBtn} onPress={() => setEditing(addon)} activeOpacity={0.8}>
              <Text style={t.editBtnTxt}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={t.row}>
            <Stat label="Monthly" value={`K${fmt(addon.monthlyPrice)}`} color={NAVY} />
            <Stat label="Yearly" value={`K${fmt(addon.yearlyPrice)}`} color={SUCCESS} />
            <Stat label="Units" value={String(addon.unitsIncluded)} />
          </View>
          {addon.description ? <Text style={[t.cardSub, { marginTop: 6 }]}>{addon.description}</Text> : null}
        </View>
      ))}

      <EditModal
        visible={!!editing}
        title={`Edit Add-On: ${editing?.name}`}
        fields={editFields}
        values={editing || {}}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
      <CreateModal
        visible={creating}
        title="Create New Add-On Pack"
        fields={createFields}
        saving={saving}
        onClose={() => setCreating(false)}
        onSave={handleCreate}
      />
    </View>
  );
}

// ─── Tenants Tab ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  active: SUCCESS, trial: '#0284C7', cancelled: DANGER,
  expired: '#6B7280', suspended: WARN,
};

function TenantsTab({ tenants }: { tenants: TenantSub[] }) {
  if (tenants.length === 0) {
    return (
      <View style={{ padding: 32, alignItems: 'center' }}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>🏢</Text>
        <Text style={{ color: '#6B7280', textAlign: 'center' }}>
          No tenant subscriptions yet.{'\n'}Tenants subscribe from the customer portal.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {tenants.map(sub => (
        <View key={sub.id} style={t.card}>
          <View style={t.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={t.cardTitle}>{sub.tenant?.name}</Text>
              <Text style={t.cardSub}>Plan: {sub.plan?.name} · K{fmt(sub.plan?.basePrice)}/yr</Text>
              {sub.startDate && <Text style={t.cardSub}>Start: {sub.startDate?.slice(0, 10)}</Text>}
              {sub.endDate && <Text style={t.cardSub}>Expires: {sub.endDate?.slice(0, 10)}</Text>}
            </View>
            <View style={[t.statusPill, { backgroundColor: (STATUS_COLORS[sub.status?.toLowerCase()] || '#6B7280') + '20' }]}>
              <Text style={[t.statusTxt, { color: STATUS_COLORS[sub.status?.toLowerCase()] || '#6B7280' }]}>
                {sub.status?.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Stat chip ───────────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={t.stat}>
      <Text style={[t.statVal, color ? { color } : {}]}>{value}</Text>
      <Text style={t.statLbl}>{label}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────

export default function SubscriptionAdminScreen() {
  const [tab, setTab] = useState<TabKey>('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [addons, setAddons] = useState<AddonPack[]>([]);
  const [tenants, setTenants] = useState<TenantSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, mRes, aRes, tRes] = await Promise.allSettled([
        gql<any>(Q_PLANS),
        gql<any>(Q_MODULES),
        gql<any>(Q_ADDON_PACKS),
        gql<any>(Q_TENANT_SUBS).catch(() => ({ allTenantSubscriptions: [] })),
      ]);
      if (pRes.status === 'fulfilled') setPlans(pRes.value?.subscriptionPlans || []);
      if (mRes.status === 'fulfilled') setModules(mRes.value?.modules || []);
      if (aRes.status === 'fulfilled') setAddons(aRes.value?.addonPacks || []);
      if (tRes.status === 'fulfilled') setTenants((tRes.value as any)?.allTenantSubscriptions || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleSeed = () => {
    Alert.alert(
      'Seed Catalog',
      'This will create default plans, modules, and add-on packs if they don\'t already exist. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed', onPress: async () => {
            setSeeding(true);
            try {
              const res = await gql<any>(M_SEED);
              const msg = res?.seedModularCatalog?.message || 'Done';
              Alert.alert('✓ Seed Complete', msg);
              loadAll();
            } catch (e: any) {
              Alert.alert('Error', e.message);
            } finally { setSeeding(false); }
          }
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color={NAVY} />
        <Text style={{ color: '#6B7280', marginTop: 12 }}>Loading subscription data…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Subscription Admin</Text>
          <Text style={s.headerSub}>
            {plans.length} plans · {modules.length} modules · {addons.length} add-ons · {tenants.length} subscribers
          </Text>
        </View>
        <TouchableOpacity
          style={[s.seedBtn, seeding && { opacity: 0.6 }]}
          onPress={handleSeed}
          disabled={seeding}
          activeOpacity={0.8}
        >
          {seeding
            ? <ActivityIndicator color={GOLD} size="small" />
            : <Text style={s.seedTxt}>🌱 Seed</Text>}
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tb => (
          <TouchableOpacity
            key={tb.key}
            style={[s.tabItem, tab === tb.key && s.tabActive]}
            onPress={() => setTab(tb.key)}
            activeOpacity={0.8}
          >
            <Text style={s.tabIcon}>{tb.icon}</Text>
            <Text style={[s.tabLabel, tab === tb.key && s.tabLabelActive]}>{tb.label}</Text>
            {tab === tb.key && <View style={s.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAll(); }}
            tintColor={NAVY}
          />
        }
      >
        {tab === 'plans'   && <PlansTab   plans={plans}     reload={loadAll} />}
        {tab === 'modules' && <ModulesTab modules={modules} reload={loadAll} />}
        {tab === 'addons'  && <AddonsTab  addons={addons}   reload={loadAll} />}
        {tab === 'tenants' && <TenantsTab tenants={tenants} />}
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: NAVY },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  seedBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: NAVY, borderRadius: 8,
  },
  seedTxt: { color: GOLD, fontSize: 13, fontWeight: '700' },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  tabItem: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    position: 'relative',
  },
  tabActive: {},
  tabIcon: { fontSize: 14, marginBottom: 2 },
  tabLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },
  tabLabelActive: { color: NAVY, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8,
    height: 2, backgroundColor: GOLD, borderRadius: 1,
  },
});

const t = StyleSheet.create({
  addBtn: {
    backgroundColor: NAVY, borderRadius: 8, paddingVertical: 10,
    alignItems: 'center', marginBottom: 12,
  },
  addBtnTxt: { color: GOLD, fontWeight: '700', fontSize: 14 },

  sectionHdr: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 1, marginTop: 12, marginBottom: 6, marginLeft: 4,
  },

  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  editBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#EFF6FF', borderRadius: 6, marginLeft: 8,
  },
  editBtnTxt: { color: NAVY, fontSize: 12, fontWeight: '600' },

  badge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: '#ECFDF5', color: SUCCESS,
    fontSize: 10, fontWeight: '700',
  },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    backgroundColor: '#F8FAFC', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center',
  },
  statVal: { fontSize: 13, fontWeight: '700', color: '#111827' },
  statLbl: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },

  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusTxt: { fontSize: 11, fontWeight: '700' },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 36,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: NAVY },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#111827', backgroundColor: '#F9FAFB',
  },
  toggle: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    alignSelf: 'flex-start', backgroundColor: '#F9FAFB',
  },
  toggleOn: { backgroundColor: NAVY, borderColor: NAVY },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  cancelTxt: { color: '#374151', fontSize: 14, fontWeight: '600' },
  saveBtn: {
    flex: 2, backgroundColor: NAVY,
    borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  saveTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
