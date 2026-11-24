import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  ScrollView, Platform, StatusBar, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../store/AuthContext';
import { useRole } from '../store/RoleContext';
import { COLORS, FONT, RADIUS, SHADOW } from '../theme';
import { tenantModules, tenantSetup } from '../api/aiApi';
import SetupAdvisorScreen from '../screens/SetupAdvisorScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import InfinityMenu from '../components/InfinityMenu';

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
import ProjectsScreen from '../screens/ProjectsScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import AICentreScreen from '../screens/AICentreScreen';
import CaptureDocumentScreen from '../screens/CaptureDocumentScreen';
import ManufacturingScreen from '../screens/ManufacturingScreen';
import AllFeaturesScreen from '../screens/AllFeaturesScreen';
import WebPageView from '../components/WebPageView';
import ModulePagesSheet from '../components/ModulePagesSheet';
import { MODULE_GROUPS } from '../lib/webPages';

const NAVY = COLORS.navy;
const GOLD = COLORS.amberLight;
const SIDEBAR_W = 280;

interface NavItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  component: React.ComponentType<any>;
  roleCheck?: (r: ReturnType<typeof useRole>) => boolean;
  module?: string;      // the tenant must have this module switched on
}

// A business on the two base plans (Sell: point of sale and inventory; Books: accounting) only sees the parts it has. The other plans and
// older businesses see everything, as before. Each menu item shows when ANY of its module codes is switched on.
const TWO_PLANS = ['neton_sell', 'neton_books'];
const NEEDS_MODULE: Record<string, string[]> = {
  sales: ['sales', 'finance', 'accounting'], pos: ['pos'], purchasing: ['supply_chain'], inventory: ['supply_chain'], finance: ['finance', 'accounting'],
  crm: ['sales', 'crm_sales_pro', 'crm'], people: ['human_resources', 'hr_self_service', 'payroll', 'hr'], fixed_assets: ['fixed_assets'],
  tax_hub: ['tax', 'finance'], projects: ['project_operations'], manufacturing: ['manufacturing'],
};

// Mirror the web app sidebar exactly
const NAV: NavItem[] = [
  { key: 'dashboard',    label: 'Dashboard',     icon: 'grid-outline',        component: HomeScreen },
  { key: 'sales',        label: 'Sales',          icon: 'cash-outline',        component: OperationsScreen,  roleCheck: r => r.isAdmin || r.hasPermission('accounting.view_invoice') },
  { key: 'pos',          label: 'Point of Sale',  icon: 'cart-outline',        component: POSScreen,         roleCheck: r => r.isAdmin || r.hasPermission('accounting.view_invoice') },
  { key: 'purchasing',   label: 'Purchasing',     icon: 'cube-outline',        component: SupplyChainScreen, roleCheck: r => r.isAdmin || r.hasPermission('supply_chain.view_purchase_order') },
  { key: 'inventory',    label: 'Inventory',      icon: 'file-tray-stacked-outline', component: InventoryScreen,   roleCheck: r => r.isAdmin || r.hasPermission('supply_chain.view_purchase_order') },
  { key: 'finance',      label: 'Finance',        icon: 'bar-chart-outline',   component: FinanceScreen,     roleCheck: r => r.isAdmin || r.isAccountant },
  { key: 'crm',          label: 'CRM',            icon: 'people-circle-outline', component: CRMScreen,       roleCheck: r => r.isAdmin || r.hasPermission('crm.view_customer') },
  { key: 'people',       label: 'People (HR)',    icon: 'people-outline',      component: HRScreen },
  { key: 'fixed_assets', label: 'Fixed Assets',   icon: 'construct-outline',   component: FixedAssetsScreen, roleCheck: r => r.isAdmin || r.isAccountant },
  { key: 'tax_hub',      label: 'Tax Hub',        icon: 'receipt-outline',     component: TaxHubScreen,      roleCheck: r => r.isAdmin || r.isAccountant },
  { key: 'projects',     label: 'Projects',       icon: 'briefcase-outline',   component: ProjectsScreen,    roleCheck: r => r.isAdmin || r.hasPermission('business_modules.manage_projects') },
  { key: 'manufacturing', label: 'Manufacturing', icon: 'hammer-outline',      component: ManufacturingScreen, roleCheck: r => r.isAdmin || r.isAccountant, module: 'manufacturing' },
  { key: 'ai_centre',    label: 'AI Centre',      icon: 'bulb-outline',        component: AICentreScreen },
  { key: 'capture',      label: 'Capture a document', icon: 'scan-outline',    component: CaptureDocumentScreen, roleCheck: r => r.isAdmin || r.isAccountant || r.hasPermission('supply_chain.view_purchase_orders') },
  { key: 'ai_assistant', label: 'NetOn AI',       icon: 'sparkles-outline',    component: AIAssistantScreen },
  { key: 'features',     label: 'All features',   icon: 'apps-outline',        component: AllFeaturesScreen },
  { key: 'setup',        label: 'Setup & Import', icon: 'settings-outline',    component: SetupScreen,       roleCheck: r => r.isAdmin },
  { key: 'settings',     label: 'Settings',       icon: 'options-outline',     component: SettingsScreen },
  { key: 'plan_advisor', label: 'Choose a plan',  icon: 'pricetag-outline',    component: SetupAdvisorScreen, roleCheck: r => r.isAdmin },
  { key: 'sub_admin',    label: 'Subscriptions',  icon: 'card-outline',        component: SubscriptionAdminScreen, roleCheck: r => r.isStaff },
];

export default function SidebarLayout() {
  const { user, tenant, signOut } = useAuth();
  const role = useRole();
  const [activeKey, setActiveKey] = useState('dashboard');
  const [open, setOpen] = useState(false);
  // How the person moves around: the 'dashboard' menu (hamburger + drawer) or the floating 'infinity' button. Remembered on the device.
  const [navMode, setNavMode] = useState<'dashboard' | 'infinity'>('dashboard');
  React.useEffect(() => { AsyncStorage.getItem('erp_nav_mode').then(v => { if (v === 'infinity') setNavMode('infinity'); }).catch(() => {}); }, []);
  const chooseMode = (m: 'dashboard' | 'infinity') => { setNavMode(m); AsyncStorage.setItem('erp_nav_mode', m).catch(() => {}); };
  const [modules, setModules] = useState<string[] | null>(null);   // null until known: nothing is hidden meanwhile
  const [plan, setPlan] = useState<string | null>(null);
  React.useEffect(() => { tenantModules().then(setModules); tenantSetup().then(t => setPlan(t?.plan ?? null)); }, []);
  const [profileOpen, setProfileOpen] = useState(false);
  // a web page shown inside the app (the long tail of the web app that has no native screen)
  const [webPage, setWebPage] = useState<{ path: string; title: string } | null>(null);
  const [morePages, setMorePages] = useState(false);
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

  const twoPlan = !!plan && TWO_PLANS.includes(plan) && modules !== null;
  const hasPart = (key: string) => !twoPlan || !NEEDS_MODULE[key] || NEEDS_MODULE[key].some(c => (modules as string[]).includes(c));
  const visible = NAV.filter(item => (!item.roleCheck || item.roleCheck(role)) && (!item.module || modules === null || modules.includes(item.module)) && hasPart(item.key));
  const activeItem = visible.find(n => n.key === activeKey) || visible[0];
  const ActiveScreen = activeItem?.component || HomeScreen;

  const handleSignOut = () => {
    setProfileOpen(false);
    // Alert.alert's multi-button form doesn't work on web - react-native-web
    // shows a plain window.alert(title+message) and silently drops every
    // button/onPress, so "Sign Out" never actually fired there. window.confirm
    // is the real equivalent on that platform; native keeps the RN dialog.
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) signOut();
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const insets = useSafeAreaInsets();
  const PT = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 44);

  return (
    // paddingBottom keeps everything above the phone's own navigation buttons (the app is drawn edge to edge on current Android)
    <View style={{ flex: 1, backgroundColor: '#F1F5F9', paddingBottom: insets.bottom }}>

      {/* ─── Minimal Top Bar ─────────────────────────────────────── */}
      <View style={[s.topBar, { paddingTop: PT + 8 }]}>
        {navMode === 'dashboard' ? (
          <TouchableOpacity onPress={openDrawer} style={s.iconBtn} activeOpacity={0.7}>
            <View style={s.ham}>
              <View style={s.line} />
              <View style={[s.line, { width: 18 }]} />
              <View style={s.line} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={s.iconBtn}><Ionicons name="infinite" size={22} color="#374151" /></View>
        )}
        <Text style={s.pageTitle} numberOfLines={1}>{activeItem?.label || 'NetOn ERP Pro'}</Text>
        {!!MODULE_GROUPS[activeItem?.key || ''] && (
          <TouchableOpacity onPress={() => setMorePages(true)} style={s.iconBtn} activeOpacity={0.7} accessibilityLabel="All pages in this module">
            <Ionicons name="apps-outline" size={22} color="#374151" />
          </TouchableOpacity>
        )}
        {visible.some(n => n.key === 'capture') && (
          <TouchableOpacity onPress={() => navigate('capture')} style={s.iconBtn} activeOpacity={0.7} accessibilityLabel="Capture a document">
            <Ionicons name="scan-outline" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setProfileOpen(true)} style={s.avatarBtn} activeOpacity={0.8}>
          <View style={s.avCircle}>
            <Text style={s.avText}>{user?.firstName?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ─── Active screen ────────────────────────────────────────── */}
      <View style={{ flex: 1 }}>
        <ActiveScreen onNavigate={navigate} onOpenWeb={(path: string, title: string) => setWebPage({ path, title })} />
      </View>

      {!!MODULE_GROUPS[activeItem?.key || ''] && (
        <ModulePagesSheet moduleKey={activeItem!.key} title={activeItem!.label} visible={morePages} onClose={() => setMorePages(false)}
          onNavigate={navigate} onOpenWeb={(path, title) => setWebPage({ path, title })} />
      )}

      {webPage && <WebPageView path={webPage.path} title={webPage.title} onClose={() => setWebPage(null)} />}

      {navMode === 'infinity' && (
        <InfinityMenu items={visible.map(v => ({ key: v.key, label: v.label, icon: v.icon }))} activeKey={activeItem?.key || 'dashboard'}
          onSelect={navigate} onUseDashboard={() => chooseMode('dashboard')} />
      )}

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
          <View style={s.logo}><Ionicons name="layers" size={17} color={NAVY} /></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.brandName}>NetOn ERP Pro</Text>
            <Text style={s.brandOrg} numberOfLines={1}>{tenant?.name}</Text>
          </View>
          <TouchableOpacity onPress={closeDrawer} style={{ padding: 6 }}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
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
                <Ionicons name={item.icon} size={18} color={isActive ? NAVY : '#6B7280'} style={s.navIcon} />
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
            <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
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
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 6 }}>HOW TO MOVE AROUND</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {([['dashboard', 'menu-outline', 'Hamburger button'], ['infinity', 'infinite', 'Infinity button']] as const).map(([m, icon, label]) => (
                  <TouchableOpacity key={m} onPress={() => { chooseMode(m); setProfileOpen(false); }} activeOpacity={0.8}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: navMode === m ? NAVY : '#E5E7EB', backgroundColor: navMode === m ? NAVY : '#fff' }}>
                    <Ionicons name={icon} size={15} color={navMode === m ? '#fff' : '#374151'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: navMode === m ? '#fff' : '#374151' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.profileAction} onPress={() => { setProfileOpen(false); navigate('settings'); }} activeOpacity={0.7}>
                <Ionicons name="options-outline" size={16} color="#374151" style={{ marginRight: 10 }} />
                <Text style={s.profileActionTxt}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.profileAction} onPress={handleSignOut} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={16} color={COLORS.danger} style={{ marginRight: 10 }} />
                <Text style={[s.profileActionTxt, { color: COLORS.danger }]}>Sign Out</Text>
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
  pageTitle: { flex: 1, fontSize: 16, fontFamily: FONT.heading, color: '#111827', marginLeft: 10 },
  avatarBtn: { padding: 4 },
  avCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' },
  avText: { color: '#fff', fontSize: 13, fontFamily: FONT.heading },

  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 20 },

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
  logo: { width: 34, height: 34, borderRadius: RADIUS.sm, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center' },
  brandName: { color: '#fff', fontSize: 14, fontFamily: FONT.display },
  brandOrg: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1, fontFamily: FONT.bodyRegular },

  navItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: RADIUS.sm, position: 'relative',
  },
  navActive: { backgroundColor: '#EFF6FF' },
  navIcon: { width: 26 },
  navLabel: { fontSize: 14, color: '#374151', fontFamily: FONT.bodyRegular, flex: 1 },
  navLabelA: { color: NAVY, fontFamily: FONT.heading },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderTopWidth: 1, borderTopColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  footerAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: NAVY + '1A', justifyContent: 'center', alignItems: 'center' },
  footerAvTxt: { fontSize: 13, fontFamily: FONT.heading, color: NAVY },
  footerName: { fontSize: 13, fontFamily: FONT.heading, color: '#1F2937' },
  footerEmail: { fontSize: 11, color: '#9CA3AF', marginTop: 1, fontFamily: FONT.bodyRegular },

  profileOverlay: { flex: 1 },
  profileCard: {
    position: 'absolute', right: 12,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 16, width: 260,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, elevation: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  profileAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  profileActionTxt: { fontSize: 14, color: '#374151', fontWeight: '500' },
});
