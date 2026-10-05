import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Sesión guardada en el dispositivo (si la hay) antes de mostrar pantallas.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    // Login, logout y renovación de token. Si el token vence y no se puede renovar
    // (401), llega session = null y la navegación vuelve al login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // scope 'local': cierra la sesión en este dispositivo aunque no haya red.
    await supabase.auth.signOut({ scope: 'local' });
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
