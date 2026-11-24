import React, { useState, useRef } from 'react';
import {
  Image, View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions,
  ScrollView, Platform, StatusBar, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeMode } from '../store/ThemeContext';
import { useConfirm } from '../store/ConfirmContext';
import { gql } from '../api/graphql';
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
import NotificationBell from '../components/NotificationBell';
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
const TWO_PLANS = ['neton_sell_lite', 'neton_sell', 'neton_books'];
const NEEDS_MODULE: Record<string, string[]> = {
  sales: ['crm', 'sales', 'finance', 'accounting'], pos: ['pos'], purchasing: ['supply_chain'], inventory: ['supply_chain'], finance: ['finance', 'accounting'],
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
  { key: 'plan_advisor', label: 'AI setup help',  icon: 'sparkles-outline',      component: SetupAdvisorScreen, roleCheck: r => r.isAdmin },
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
  const [branchModules, setBranchModules] = useState<string[]>([]);
  React.useEffect(() => { tenantModules().then(setModules); tenantSetup().then(t => setPlan(t?.plan ?? null)); }, []);
  // a person tied to one branch also gets the modules THEIR branch added (the web sidebar does the same)
  React.useEffect(() => {
    if (!role.branchId || !tenant?.id) { setBranchModules([]); return; }
    gql<any>(`query($t:UUID!,$b:UUID){ moduleSubscriptions(tenantId:$t, branchId:$b){ module{ code } } }`, { t: tenant.id, b: role.branchId })
      .then(d => setBranchModules((d?.moduleSubscriptions || []).map((m: any) => m?.module?.code).filter(Boolean))).catch(() => setBranchModules([]));
  }, [role.branchId, tenant?.id]);
  const [profileOpen, setProfileOpen] = useState(false);
  // a web page shown inside the app (the long tail of the web app that has no native screen)
  const [webPage, setWebPage] = useState<{ path: string; title: string } | null>(null);
  const [morePages, setMorePages] = useState(false);
  const [infinityOpen, setInfinityOpen] = useState(0);   // bumped by the bottom bar's More to open the Infinity sheet
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
  const hasPart = (key: string) => !twoPlan || !NEEDS_MODULE[key] || NEEDS_MODULE[key].some(c => [...(modules as string[]), ...branchModules].includes(c));
  const visible = NAV.filter(item => (!item.roleCheck || item.roleCheck(role)) && (!item.module || modules === null || modules.includes(item.module)) && hasPart(item.key));
  const activeItem = visible.find(n => n.key === activeKey) || visible[0];
  const ActiveScreen = activeItem?.component || HomeScreen;

  const confirm = useConfirm();
  const handleSignOut = async () => {
    setProfileOpen(false);
    // the question is asked in the app's own dialog (the system alert does nothing in a browser and can fail to show while a sheet is closing)
    await new Promise(r => setTimeout(r, 200));
    if (await confirm({ title: 'Sign out', message: 'Are you sure you want to sign out?', confirmLabel: 'Sign out', destructive: true })) signOut();
  };

  const insets = useSafeAreaInsets();
  const { dark, toggle: toggleTheme } = useThemeMode();
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
          <View style={s.iconBtn}><Ionicons name="infinite" size={22} color="#334155" /></View>
        )}
        <Text style={s.pageTitle} numberOfLines={1}>{activeItem?.label || 'Neton ERP Pro'}</Text>
        <NotificationBell onOpenLink={(path, title) => setWebPage({ path, title })} />
        {!!MODULE_GROUPS[activeItem?.key || ''] && (
          <TouchableOpacity onPress={() => setMorePages(true)} style={s.iconBtn} activeOpacity={0.7} accessibilityLabel="All pages in this module">
            <Ionicons name="apps-outline" size={22} color="#334155" />
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

      {/* ─── Bottom bar: Home, the main section for this plan, Capture, NetOn AI, More ─── */}
      <View style={s.tabBar}>
        {(() => {
          const has = (k: string) => visible.some(n => n.key === k);
          const main = ['pos', 'sales', 'inventory', 'finance'].find(has);
          const mainItem = NAV.find(n => n.key === main);
          const tabs: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; big?: boolean }[] = [
            { key: 'dashboard', label: 'Home', icon: 'home-outline', onPress: () => navigate('dashboard') },
            ...(mainItem ? [{ key: mainItem.key, label: mainItem.label.replace('Point of Sale', 'Sell'), icon: mainItem.icon, onPress: () => navigate(mainItem.key) }] : []),
            ...(has('capture') ? [{ key: 'capture', label: 'Capture', icon: 'scan-outline' as const, onPress: () => navigate('capture'), big: true }] : []),
            ...(has('ai_assistant') ? [{ key: 'ai_assistant', label: 'NetOn AI', icon: 'sparkles-outline' as const, onPress: () => navigate('ai_assistant') }] : []),
            { key: '__more', label: 'More', icon: 'menu-outline', onPress: () => { if (navMode === 'infinity') setInfinityOpen(n => n + 1); else openDrawer(); } },
          ];
          return tabs.map(t => {
            const active = t.key === activeKey;
            return (
              <TouchableOpacity key={t.key} style={s.tab} onPress={t.onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t.label}>
                {t.big ? (
                  <View style={s.tabBig}><Ionicons name={t.icon} size={22} color="#fff" /></View>
                ) : (
                  <Ionicons name={active ? (t.icon.replace('-outline', '') as any) : t.icon} size={22} color={active ? COLORS.primary : COLORS.subtle} />
                )}
                <Text style={[s.tabLabel, active && { color: COLORS.primary, fontFamily: FONT.heading }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          });
        })()}
      </View>

      {!!MODULE_GROUPS[activeItem?.key || ''] && (
        <ModulePagesSheet moduleKey={activeItem!.key} title={activeItem!.label} visible={morePages} onClose={() => setMorePages(false)}
          onNavigate={navigate} onOpenWeb={(path, title) => setWebPage({ path, title })} />
      )}

      {webPage && <WebPageView path={webPage.path} title={webPage.title} onClose={() => setWebPage(null)} />}

      {navMode === 'infinity' && (
        <InfinityMenu items={visible.map(v => ({ key: v.key, label: v.label, icon: v.icon }))} activeKey={activeItem?.key || 'dashboard'}
          onSelect={navigate} onUseDashboard={() => chooseMode('dashboard')} openSignal={infinityOpen} />
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
          <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Neton ERP Pro" />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.brandName}>Neton ERP Pro</Text>
            <Text style={s.brandOrg} numberOfLines={1}>{tenant?.name}</Text>
          </View>
          <TouchableOpacity onPress={closeDrawer} style={{ padding: 6 }}>
            <Ionicons name="close" size={18} color={COLORS.subtle} />
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
                <Ionicons name={item.icon} size={18} color={isActive ? NAVY : '#64748B'} style={s.navIcon} />
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
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{user?.firstName} {user?.lastName}</Text>
                <Text style={{ fontSize: 12, color: '#64748B' }}>{user?.email}</Text>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{tenant?.name}</Text>
              </View>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6 }}>HOW TO MOVE AROUND</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                {([['dashboard', 'menu-outline', 'Hamburger button'], ['infinity', 'infinite', 'Infinity button']] as const).map(([m, icon, label]) => (
                  <TouchableOpacity key={m} onPress={() => { chooseMode(m); setProfileOpen(false); }} activeOpacity={0.8}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: navMode === m ? NAVY : '#E2E8F0', backgroundColor: navMode === m ? NAVY : '#fff' }}>
                    <Ionicons name={icon} size={15} color={navMode === m ? '#fff' : '#334155'} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: navMode === m ? '#fff' : '#334155' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.profileAction} onPress={() => { setProfileOpen(false); toggleTheme(); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
                <Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={16} color="#334155" style={{ marginRight: 10 }} />
                <Text style={s.profileActionTxt}>{dark ? 'Light mode' : 'Dark mode'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.profileAction} onPress={() => { setProfileOpen(false); navigate('settings'); }} activeOpacity={0.7}>
                <Ionicons name="options-outline" size={16} color="#334155" style={{ marginRight: 10 }} />
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
  tabBar: { flexDirection: 'row', backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 4, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
  tabBig: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginTop: -2, ...SHADOW.card },
  tabLabel: { fontSize: 11, color: COLORS.subtle, fontFamily: FONT.body },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 2, elevation: 3,
    zIndex: 10,
  },
  iconBtn: { padding: 10 },
  ham: { gap: 4 },
  line: { height: 2, width: 22, backgroundColor: '#334155', borderRadius: 2 },
  pageTitle: { flex: 1, fontSize: 16, fontFamily: FONT.heading, color: '#0F172A', marginLeft: 10 },
  avatarBtn: { padding: 4 },
  avCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' },
  avText: { color: '#fff', fontSize: 13, fontFamily: FONT.heading },

  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 20 },

  drawer: {
    position: 'absolute', top: 0, left: 0, bottom: 0, width: SIDEBAR_W,
    backgroundColor: '#fff', zIndex: 30,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, elevation: 20,
    borderRightWidth: 1, borderRightColor: '#E2E8F0',
  },
  brand: {
    backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  logo: { width: 34, height: 34 },
  brandName: { color: COLORS.ink, fontSize: 14, fontFamily: FONT.display },
  brandOrg: { color: COLORS.subtle, fontSize: 11, marginTop: 1, fontFamily: FONT.bodyRegular },

  navItem: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 8, paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: RADIUS.sm, position: 'relative',
  },
  navActive: { backgroundColor: '#EFF6FF' },
  navIcon: { width: 26 },
  navLabel: { fontSize: 14, color: '#334155', fontFamily: FONT.bodyRegular, flex: 1 },
  navLabelA: { color: NAVY, fontFamily: FONT.heading },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  footerAv: { width: 34, height: 34, borderRadius: 17, backgroundColor: NAVY + '1A', justifyContent: 'center', alignItems: 'center' },
  footerAvTxt: { fontSize: 13, fontFamily: FONT.heading, color: NAVY },
  footerName: { fontSize: 13, fontFamily: FONT.heading, color: '#0F172A' },
  footerEmail: { fontSize: 11, color: '#94A3B8', marginTop: 1, fontFamily: FONT.bodyRegular },

  profileOverlay: { flex: 1 },
  profileCard: {
    position: 'absolute', right: 12,
    backgroundColor: '#fff', borderRadius: RADIUS.lg, padding: 16, width: 260,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, elevation: 12,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  profileAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  profileActionTxt: { fontSize: 14, color: '#334155', fontWeight: '500' },
});
