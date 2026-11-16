import { supabase } from '../lib/supabase';
import type {
  ProfileInsert,
  ProfileRow,
  ProfileUpdate,
} from './schema';

export async function getProfile(
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createOrUpdateProfile(
  profile: ProfileInsert,
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile, { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  updates: Omit<ProfileUpdate, 'id'>,
): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
