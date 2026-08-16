import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  ScrollView, Platform, StatusBar, Modal, Alert,
} from 'react-native';
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';

import HomeScreen from '../screens/HomeScreen';
import FinanceScreen from '../screens/FinanceScreen';
import OperationsScreen from '../screens/OperationsScreen';
import CRMScreen from '../screens/CRMScreen';
import SupplyChainScreen from '../screens/SupplyChainScreen';
import InventoryScreen from '../screens/InventoryScreen';
import HRScreen from '../screens/HRScreen';
import FixedAssetsScreen from '../screens/FixedAssetsScreen';
import TaxHubScreen from '../screens/TaxHubScreen';
import SetupScreen from '../screens/SetupScreen';
import SettingsScreen from '../screens/SettingsScreen';
import POSScreen from '../screens/POSScreen';
import SubscriptionAdminScreen from '../screens/SubscriptionAdminScreen';
// WebModuleScreen kept as fallback for future use

const NAVY = '#1E3A5F';
const GOLD = '#C9A84C';
const SIDEBAR_W = 280;

interface NavItem {
  key: string;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
  roleCheck?: (r: ReturnType<typeof useRole>) => boolean;
}

// Mirror the web app sidebar exactly
const NAV: NavItem[] = [
  { key: 'dashboard',    label: 'Dashboard',     icon: '⊞',  component: HomeScreen },
  { key: 'sales',        label: 'Sales',          icon: '💰', component: OperationsScreen,  roleCheck: r => r.isAdmin || r.hasPermission('accounting.view_invoice') },
  { key: 'pos',          label: 'Point of Sale',  icon: '🛒', component: POSScreen,         roleCheck: r => r.isAdmin || r.hasPermission('accounting.view_invoice') },
  { key: 'purchasing',   label: 'Purchasing',     icon: '📦', component: SupplyChainScreen, roleCheck: r => r.isAdmin || r.hasPermission('supply_chain.view_purchase_order') },
  { key: 'inventory',    label: 'Inventory',      icon: '🏭', component: InventoryScreen,   roleCheck: r => r.isAdmin || r.hasPermission('supply_chain.view_purchase_order') },
  { key: 'finance',      label: 'Finance',        icon: '📊', component: FinanceScreen,     roleCheck: r => r.isAdmin || r.isAccountant },
  { key: 'crm',          label: 'CRM',            icon: '🤝', component: CRMScreen,         roleCheck: r => r.isAdmin || r.hasPermission('crm.view_customer') },
  { key: 'people',       label: 'People (HR)',    icon: '👥', component: HRScreen },
  { key: 'fixed_assets', label: 'Fixed Assets',  icon: '🏗️', component: FixedAssetsScreen, roleCheck: r => r.isAdmin || r.isAccountant },
  { key: 'tax_hub',      label: 'Tax Hub',        icon: '🧾', component: TaxHubScreen,      roleCheck: r => r.isAdmin || r.isAccountant },
  { key: 'setup',        label: 'Setup & Import', icon: '⚙️', component: SetupScreen,       roleCheck: r => r.isAdmin },
  { key: 'settings',     label: 'Settings',       icon: '🔧', component: SettingsScreen },
  { key: 'sub_admin',   label: 'Subscriptions',  icon: '💳', component: SubscriptionAdminScreen, roleCheck: r => r.isStaff },
];

export default function SidebarLayout() {
  const { user, tenant, signOut } = useAuth();
  const role = useRole();
  const [activeKey, setActiveKey] = useState('dashboard');
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const slideX = useRef(new Animated.Value(-SIDEBAR_W)).current;
  const overlayO = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    setOpen(true);
    Animated.parallel([
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 85, friction: 11 }),
      Animated.timing(overlayO, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const closeDrawer = () => {
    Animated.parallel([
      Animated.spring(slideX, { toValue: -SIDEBAR_W, useNativeDriver: true, tension: 85, friction: 11 }),
      Animated.timing(overlayO, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  };

  const navigate = (key: string) => { setActiveKey(key); closeDrawer(); };

  const visible = NAV.filter(item => !item.roleCheck || item.roleCheck(role));
  const activeItem = visible.find(n => n.key === activeKey) || visible[0];
  const ActiveScreen = activeItem?.component || HomeScreen;

  const handleSignOut = () => {
    setProfileOpen(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const PT = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 44;

  return (
    <View style={{ flex: 1, backgroundColor: '#F1F5F9' }}>

      {/* ─── Minimal Top Bar ─────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: PT + 8 }]}>
        <TouchableOpacity onPress={openDrawer} style={s.iconBtn} activeOpacity={0.7}>
          <View style={s.ham}>
            <View style={s.line} />
            <View style={[s.line, { width: 18 }]} />
            <View style={s.line} />
          </View>
        </TouchableOpacity>
        <Text style={s.pageTitle} numberOfLines={1}>{activeItem?.label || 'Nexora ERP'}</Text>
        <TouchableOpacity onPress={() => setProfileOpen(true)} style={s.avatarBtn} activeOpacity={0.8}>
          <View style={s.avCircle}>
            <Text style={s.avText}>{user?.firstName?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ─── Active screen ────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        <ActiveScreen onNavigate={navigate} />
      </View>

      {/* ─── Overlay ──────────────────────────────────────────────── */}
      {open && (
        <Animated.View style={[s.overlay, { opacity: overlayO, pointerEvents: 'auto' }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={closeDrawer} activeOpacity={1} />
        </Animated.View>
      )}

      {/* ─── Drawer ───────────────────────────────────────────────── */}
      <Animated.View style={[s.drawer, { transform: [{ translateX: slideX }] }]}>
        {/* Brand header */}
        <View style={[s.brand, { paddingTop: PT + 16 }]}>
          <View style={s.logo}><Text style={s.logoTxt}>N</Text></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.brandName}>Nexora ERP</Text>
            <Text style={s.brandOrg} numberOfLines={1}>{tenant?.name}</Text>
          </View>
          <TouchableOpacity onPress={closeDrawer} style={{ padding: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Nav list */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ height: 8 }} />
          {visible.map(item => {
            const isActive = item.key === activeKey;
            return (
              <TouchableOpacity
                key={item.key}
                style={[s.navItem, isActive && s.navActive]}
                onPress={() => navigate(item.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.navIcon, isActive && { opacity: 1 }]}>{item.icon}</Text>
                <Text style={[s.navLabel, isActive && s.navLabelA]}>{item.label}</Text>
                {isActive && <View style={s.activeDot} />}
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>

        {/* User footer */}
        <View style={s.footer}>
          <View style={s.footerAv}>
            <Text style={s.footerAvTxt}>{user?.firstName?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.footerName} numberOfLines={1}>{user?.firstName} {user?.lastName}</Text>
            <Text style={s.footerEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
          <TouchableOpacity onPress={handleSignOut} style={{ padding: 6 }}>
            <Text style={{ fontSize: 16 }}>🚪</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Profile Modal ────────────────────────────────────────── */}
      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <TouchableOpacity style={s.profileOverlay} onPress={() => setProfileOpen(false)} activeOpacity={1}>
          <View style={[s.profileCard, { top: PT + 58 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={s.avCircle}>
                <Text style={s.avText}>{user?.firstName?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>{user?.firstName} {user?.lastName}</Text>
                <Text style={{ fontSize: 12, color: '#6B7280' }}>{user?.email}</Text>
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{tenant?.name}</Text>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }}>
              <TouchableOpacity style={s.profileAction} onPress={() => { setProfileOpen(false); navigate('settings'); }} activeOpacity={0.7}>
                <Text style={s.profileActionIcon}>🔧</Text>
                <Text style={s.profileActionTxt}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.profileAction} onPress={handleSignOut} activeOpacity={0.7}>
                <Text style={s.profileActionIcon}>🚪</Text>
                <Text style={[s.profileActionTxt, { color: '#DC2626' }]}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 3,
    zIndex: 10,
  },
  iconBtn: { padding: 6 },
  ham: { gap: 4 },
  line: { height: 2, width: 22, backgroundColor: '#374151', borderRadius: 2 },
  pageTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827', marginLeft: 10 },
  avatarBtn: { padding: 4 },
  avCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' },
  avText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 20 },

  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_W,
    backgroundColor: '#fff', zIndex: 30,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, elevation: 20,
    borderRightWidth: 1, borderRightColor: '#E5E7EB',
  },
  brand: {
    backgroundColor: NAVY, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 16,
  },
  logo: { width: 34, height: 34, borderRadius: 9, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center' },
  logoTxt: { color: '#fff', fontSize: 17, fontWeight: '800' },
  brandName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  brandOrg: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },

  navItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 8, position: 'relative',
  },
  navActive: { backgroundColor: '#EFF6FF' },
  navIcon: { fontSize: 16, width: 26, opacity: 0.7 },
  navLabel: { fontSize: 14, color: '#374151', fontWeight: '500', flex: 1 },
  navLabelA: { color: NAVY, fontWeight: '700' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderTopWidth: 1, borderTopColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  footerAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: NAVY + '1A', justifyContent: 'center', alignItems: 'center' },
  footerAvTxt: { fontSize: 13, fontWeight: '700', color: NAVY },
  footerName: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  footerEmail: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  profileOverlay: { flex: 1 },
  profileCard: {
    position: 'absolute', right: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 16, width: 260,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, elevation: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  profileAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  profileActionIcon: { fontSize: 16, marginRight: 10 },
  profileActionTxt: { fontSize: 14, color: '#374151', fontWeight: '500' },
});
