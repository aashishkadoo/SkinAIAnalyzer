import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { env } from './env';
import type { Database } from '../types/database';

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,         // ← THIS is what persists the session
      autoRefreshToken: true,        // ← refreshes JWT before it expires
      persistSession: true,          // ← keeps session across app restarts
      detectSessionInUrl: false,     // ← not needed for native (only web OAuth)
    },
  }
);

// Supabase docs: pause token refresh while app is in background,
// resume when it returns to foreground. Without this, tokens expire
// silently when the app has been backgrounded for a while.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});