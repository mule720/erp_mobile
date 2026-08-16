import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenant: AuthTenant | null;
  employeeId: string | null;
  ready: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (token: string, user: AuthUser, tenant: AuthTenant, refreshToken?: string) => Promise<void>;
  setEmployeeId: (id: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, user: null, tenant: null, employeeId: null, ready: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('erp_token');
        const userRaw = await AsyncStorage.getItem('erp_user');
        const tenantRaw = await AsyncStorage.getItem('erp_tenant');
        const employeeId = await AsyncStorage.getItem('erp_employee_id');
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
          });
          return;
        }
      } catch {}
      setState(s => ({ ...s, ready: true }));
    })();
  }, []);

  const signIn = async (token: string, user: AuthUser, tenant: AuthTenant, refreshToken?: string) => {
    await AsyncStorage.setItem('erp_token', token);
    await AsyncStorage.setItem('erp_user', JSON.stringify(user));
    await AsyncStorage.setItem('erp_tenant', JSON.stringify(tenant));
    if (refreshToken) await AsyncStorage.setItem('erp_refresh_token', refreshToken);
    setState(s => ({ ...s, token, user, tenant }));
  };

  const setEmployeeId = async (id: string) => {
    await AsyncStorage.setItem('erp_employee_id', id);
    setState(s => ({ ...s, employeeId: id }));
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove(['erp_token', 'erp_refresh_token', 'erp_user', 'erp_tenant', 'erp_employee_id']);
    setState({ token: null, user: null, tenant: null, employeeId: null, ready: true });
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, setEmployeeId, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
