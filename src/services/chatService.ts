import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type Message = Database['public']['Tables']['messages']['Row'];
type Conversation = Database['public']['Tables']['conversations']['Row'];

export async function getOrCreateConversation(userId: string): Promise<Conversation> {
  const { data: existing, error: findErr } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({ user_id: userId, title: 'Skin advisor chat' })
    .select()
    .single();

  if (createErr) throw createErr;
  return created;
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function sendUserMessage(conversationId: string, content: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}