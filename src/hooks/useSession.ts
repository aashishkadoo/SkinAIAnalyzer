import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function useSession() {
  // `undefined` = still checking storage, `null` = checked & no session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // 1. Read the persisted session from AsyncStorage on first mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    // 2. React to sign-in / sign-out / token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    session,
    loading: session === undefined,
    user: session?.user ?? null,
  };
}