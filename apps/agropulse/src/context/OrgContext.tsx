import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

export type Role = 'producer' | 'operator' | 'advisor';

export const ROLE_LABELS: Record<Role, string> = {
  producer: 'Productor',
  operator: 'Operador de riego',
  advisor: 'Asesor',
};

export type Organization = { id: string; name: string; region: string | null };
export type Membership = { role: Role; organization: Organization };

type OrgContextType = {
  memberships: Membership[];
  activeOrg: Organization | null;
  role: Role | null;
  isLoading: boolean;
  error: unknown;
  selectOrg: (organizationId: string) => void;
  reload: () => void;
};

const OrgContext = createContext<OrgContextType>({
  memberships: [],
  activeOrg: null,
  role: null,
  isLoading: true,
  error: null,
  selectOrg: () => {},
  reload: () => {},
});

// Establecimientos del usuario y cuál está activo. RLS ya filtra: cada usuario solo
// recibe sus propias membresías (RF-02). El mapa y las listas usan el activo (RF-03).
export function OrgProvider({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // Cada vez que cambia reloadKey se vuelven a pedir las membresías ("Reintentar").
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('memberships')
      .select('role, organization:organizations(id, name, region)')
      .overrideTypes<Membership[], { merge: false }>()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError);
        } else {
          const sorted = [...data].sort((a, b) => a.organization.name.localeCompare(b.organization.name));
          setMemberships(sorted);
          setActiveOrgId((current) =>
            sorted.some((m) => m.organization.id === current) ? current : sorted[0]?.organization.id ?? null,
          );
          setError(null);
        }
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = () => {
    setIsLoading(true);
    setReloadKey((key) => key + 1);
  };

  const active = memberships.find((m) => m.organization.id === activeOrgId) ?? null;

  return (
    <OrgContext.Provider
      value={{
        memberships,
        activeOrg: active?.organization ?? null,
        role: active?.role ?? null,
        isLoading,
        error,
        selectOrg: setActiveOrgId,
        reload,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export const useOrg = () => useContext(OrgContext);
