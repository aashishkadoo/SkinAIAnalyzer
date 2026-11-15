import { useEffect, useState } from 'react';
import { getProfile, updateProfile } from '../services/profileService';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export function useProfile(userId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    getProfile(userId)
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  async function save(patch: { display_name?: string; bio?: string; skin_type?: string }) {
    if (!userId) return;
    const updated = await updateProfile(userId, patch);
    setProfile(updated);
  }

  return { profile, loading, error, save };
}