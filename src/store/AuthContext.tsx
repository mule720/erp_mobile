import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from '../api/secureStorage';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export interface AuthTenant {
  id: string;
  name: string;
}

/** Set while an accounting firm person is working inside a client company. */
export interface InsideClient { client: string; firm: string }

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  employeeId: string | null;
  ready: boolean;
  /** Changes whenever the session is swapped (into or out of a client), so everything under it starts again with the new sign-in. */
  sessionKey: number;
  insideClient: InsideClient | null;
}

interface AuthContextValue extends AuthState {
  signIn: (token: string, user: AuthUser, tenant: AuthTenant, refreshToken?: string) => Promise<void>;
  setEmployeeId: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Put the firm's sign-in aside and use the restricted account the client gave the firm person. */
  enterClient: (token: string, user: AuthUser, tenant: AuthTenant, refreshToken: string | undefined, firmName: string) => Promise<void>;
  /** Put the firm's own sign-in back. */
  leaveClient: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, user: null, tenant: null, employeeId: null, ready: false, sessionKey: 0, insideClient: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('erp_token');
        const userRaw = await AsyncStorage.getItem('erp_user');
        const tenantRaw = await AsyncStorage.getItem('erp_tenant');
        const employeeId = await AsyncStorage.getItem('erp_employee_id');
        const insideRaw = await AsyncStorage.getItem('erp_inside_client');
        // Check if token is expired
        const isExpired = token ? (() => {
          try {
            const p = JSON.parse(atob(token.split('.')[1]));
            return p.exp < Math.floor(Date.now() / 1000) + 30;
          } catch { return true; }
        })() : true;

        if (token && !isExpired && userRaw && tenantRaw) {
          setState({
            token,
            user: JSON.parse(userRaw),
            tenant: JSON.parse(tenantRaw),
            employeeId,
            ready: true,
            sessionKey: 0,
            insideClient: insideRaw ? JSON.parse(insideRaw) : null,
          });
          return;
        }
      } catch {}
      setState(s => ({ ...s, ready: true }));
    })();
  }, []);

  const signIn = async (token: string, user: AuthUser, tenant: AuthTenant, refreshToken?: string) => {
    await SecureStore.setItemAsync('erp_token', token);
    await AsyncStorage.setItem('erp_user', JSON.stringify(user));
    await AsyncStorage.setItem('erp_tenant', JSON.stringify(tenant));
    if (refreshToken) await SecureStore.setItemAsync('erp_refresh_token', refreshToken);
    setState(s => ({ ...s, token, user, tenant }));
  };

  const setEmployeeId = async (id: string) => {
    await AsyncStorage.setItem('erp_employee_id', id);
    setState(s => ({ ...s, employeeId: id }));
  };

  const signOut = async () => {
    await SecureStore.deleteItemAsync('erp_token');
    await SecureStore.deleteItemAsync('erp_refresh_token');
    await AsyncStorage.multiRemove(['erp_user', 'erp_tenant', 'erp_employee_id']);
    await AsyncStorage.multiRemove(['erp_inside_client', 'erp_firm_backup']);
    await SecureStore.deleteItemAsync('erp_firm_backup_token');
    await SecureStore.deleteItemAsync('erp_firm_backup_refresh');
    setState(s => ({ token: null, user: null, tenant: null, employeeId: null, ready: true, sessionKey: s.sessionKey + 1, insideClient: null }));
  };

  const enterClient = async (token: string, user: AuthUser, tenant: AuthTenant, refreshToken: string | undefined, firmName: string) => {
    // the firm's own sign-in is kept aside (once) so the way back is never lost
    const already = await AsyncStorage.getItem('erp_firm_backup');
    if (!already) {
      await SecureStore.setItemAsync('erp_firm_backup_token', (await SecureStore.getItemAsync('erp_token')) || '');
      await SecureStore.setItemAsync('erp_firm_backup_refresh', (await SecureStore.getItemAsync('erp_refresh_token')) || '');
      await AsyncStorage.setItem('erp_firm_backup', JSON.stringify({
        user: await AsyncStorage.getItem('erp_user'), tenant: await AsyncStorage.getItem('erp_tenant'), employeeId: await AsyncStorage.getItem('erp_employee_id'),
      }));
    }
    await SecureStore.setItemAsync('erp_token', token);
    if (refreshToken) await SecureStore.setItemAsync('erp_refresh_token', refreshToken); else await SecureStore.deleteItemAsync('erp_refresh_token');
    await AsyncStorage.setItem('erp_user', JSON.stringify(user));
    await AsyncStorage.setItem('erp_tenant', JSON.stringify(tenant));
    await AsyncStorage.removeItem('erp_employee_id');
    const inside = { client: tenant.name, firm: firmName };
    await AsyncStorage.setItem('erp_inside_client', JSON.stringify(inside));
    setState(s => ({ ...s, token, user, tenant, employeeId: null, insideClient: inside, sessionKey: s.sessionKey + 1 }));
  };

  const leaveClient = async () => {
    const raw = await AsyncStorage.getItem('erp_firm_backup');
    if (!raw) { await signOut(); return; }
    const b = JSON.parse(raw);
    const token = (await SecureStore.getItemAsync('erp_firm_backup_token')) || '';
    const refresh = (await SecureStore.getItemAsync('erp_firm_backup_refresh')) || '';
    await SecureStore.setItemAsync('erp_token', token);
    if (refresh) await SecureStore.setItemAsync('erp_refresh_token', refresh); else await SecureStore.deleteItemAsync('erp_refresh_token');
    if (b.user) await AsyncStorage.setItem('erp_user', b.user);
    if (b.tenant) await AsyncStorage.setItem('erp_tenant', b.tenant);
    if (b.employeeId) await AsyncStorage.setItem('erp_employee_id', b.employeeId); else await AsyncStorage.removeItem('erp_employee_id');
    await AsyncStorage.multiRemove(['erp_inside_client', 'erp_firm_backup']);
    await SecureStore.deleteItemAsync('erp_firm_backup_token');
    await SecureStore.deleteItemAsync('erp_firm_backup_refresh');
    setState(s => ({ ...s, token, user: b.user ? JSON.parse(b.user) : null, tenant: b.tenant ? JSON.parse(b.tenant) : null,
                     employeeId: b.employeeId || null, insideClient: null, sessionKey: s.sessionKey + 1 }));
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, setEmployeeId, signOut, enterClient, leaveClient }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
