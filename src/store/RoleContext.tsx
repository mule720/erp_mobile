import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { gql } from '../api/graphql';
import { useAuth } from './AuthContext';

interface Permission { name: string; module: string; }
interface Role { id: string; code: string; name: string; permissions: Permission[]; }
interface UserRole { id: string; role: Role; }

interface RoleContextValue {
  loading: boolean;
  userRoles: UserRole[];
  roleCodes: string[];
  isAdmin: boolean;
  isHRAdmin: boolean;
  isAccountant: boolean;
  isPayrollManager: boolean;
  isStaff: boolean;
  hasPermission: (name: string) => boolean;
  refetch: () => void;
}

const RoleContext = createContext<RoleContextValue>({
  loading: true,
  userRoles: [],
  roleCodes: [],
  isAdmin: false,
  isHRAdmin: false,
  isAccountant: false,
  isPayrollManager: false,
  isStaff: false,
  hasPermission: () => false,
  refetch: () => {},
});

const MY_ROLES_QUERY = `{
  myRoles { id role { id code name permissions { name module } } }
  me { isStaff }
}`;

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isStaff, setIsStaff] = useState(false);

  const [fetchFailed, setFetchFailed] = useState(false);

  const fetch = useCallback(async () => {
    if (!token) { setLoading(false); setUserRoles([]); setIsStaff(false); return; }
    try {
      const d = await gql<any>(MY_ROLES_QUERY);
      setUserRoles(d?.myRoles || []);
      setIsStaff(!!d?.me?.isStaff);
      setFetchFailed(false);
    } catch {
      setUserRoles([]);
      setFetchFailed(true);  // grant full access on fetch failure
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetch(); }, [fetch]);

  const roleCodes = userRoles.map(ur => ur.role?.code?.toLowerCase() || '');
  const allPermissions = new Set(
    userRoles.flatMap(ur => (ur.role?.permissions || []).map(p => p.name))
  );

  // If roles fetch failed or still loading, grant full access so all nav items are visible
  const grantAll = fetchFailed || (loading && token != null);

  const isAdmin = grantAll || isStaff || roleCodes.some(c => ['admin', 'superadmin', 'owner', 'super_admin'].includes(c));
  const isHRAdmin = isAdmin || roleCodes.some(c => ['hr_admin', 'hr_manager', 'hr'].includes(c));
  const isAccountant = isAdmin || roleCodes.some(c => ['accountant', 'finance', 'cfo', 'finance_manager'].includes(c));
  const isPayrollManager = isAdmin || isHRAdmin || roleCodes.some(c => ['payroll', 'payroll_manager'].includes(c));

  const hasPermission = (name: string) => isAdmin || allPermissions.has(name);

  return (
    <RoleContext.Provider value={{
      loading, userRoles, roleCodes,
      isAdmin, isHRAdmin, isAccountant, isPayrollManager, isStaff,
      hasPermission, refetch: fetch,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export const useRole = () => useContext(RoleContext);
