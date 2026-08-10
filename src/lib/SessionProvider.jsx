import { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "./supabase.js";

const SessionContext = createContext({ session: null, userId: null, loading: false });

/**
 * Holds the Supabase auth session for the whole app.
 *
 * A context rather than a hook per consumer: useDatabaseState is called around
 * a dozen times per render tree and each instance needs the current user id, so
 * subscribing once here avoids a dozen duplicate auth listeners.
 */
export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  // Only block on a session lookup when there is actually a backend to ask.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = { session, userId: session?.user?.id ?? null, loading };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
