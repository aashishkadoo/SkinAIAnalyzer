
// src/services/chatService.ts

import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export type Message =
  Database['public']['Tables']['messages']['Row'];

export type Conversation =
  Database['public']['Tables']['conversations']['Row'];

const MAX_MESSAGE_LENGTH = 500;

// =====================================================
// GET OR CREATE CONVERSATION
// =====================================================

export async function getOrCreateConversation(
  userId: string,
): Promise<Conversation> {
  if (!userId) {
    throw new Error('You must be signed in to use SkinAI.');
  }

  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error('Conversation lookup failed:', findError);
    throw new Error('Unable to load your conversation.');
  }

  if (existing) {
    return existing;
  }

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({
      user_id: userId,
      title: 'Skin advisor chat',
    })
    .select()
    .single();

  if (createError) {
    console.error('Conversation creation failed:', createError);
    throw new Error('Unable to create a conversation.');
  }

  return created;
}

// =====================================================
// GET MESSAGES
// =====================================================

export async function getMessages(
  conversationId: string,
): Promise<Message[]> {
  if (!conversationId) {
    throw new Error('Conversation ID is required.');
  }

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Message retrieval failed:', error);
    throw new Error('Unable to load chat messages.');
  }

  return data ?? [];
}

// =====================================================
// SEND USER MESSAGE
// =====================================================

export async function sendUserMessage(
  conversationId: string,
  content: string,
): Promise<Message> {
  const cleanContent = content.trim();

  if (!conversationId) {
    throw new Error('Conversation ID is required.');
  }

  if (!cleanContent) {
    throw new Error('Please enter a message.');
  }

  if (cleanContent.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Your message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
    );
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role: 'user',
      content: cleanContent,
    })
    .select()
    .single();

  if (error) {
    console.error('User message insertion failed:', error);
    throw new Error('Unable to send your message. Please try again.');
  }

  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) {
    console.warn('Conversation timestamp update failed:', updateError);
  }

  return data;
}

// =====================================================
// CLEAR CONVERSATION HISTORY
// =====================================================

export async function clearConversationHistory(
  conversationId: string,
): Promise<number> {
  if (!conversationId) {
    throw new Error('Conversation ID is required.');
  }

  // Count existing messages first so that an RLS-blocked delete
  // cannot silently appear to have succeeded.
  const { count, error: countError } = await supabase
    .from('messages')
    .select('id', {
      count: 'exact',
      head: true,
    })
    .eq('conversation_id', conversationId);

  if (countError) {
    console.error('Message count failed:', countError);
    throw new Error('Unable to check your chat history.');
  }

  const existingCount = count ?? 0;

  if (existingCount === 0) {
    return 0;
  }

  // Delete only messages belonging to the selected conversation.
  const { data: deletedMessages, error: deleteError } = await supabase
    .from('messages')
    .delete()
    .eq('conversation_id', conversationId)
    .select('id');

  if (deleteError) {
    console.error('Chat history deletion failed:', deleteError);
    throw new Error(
      deleteError.message ||
        'Unable to clear your chat history. Check your database permissions.',
    );
  }

  const deletedCount = deletedMessages?.length ?? 0;

  // Supabase can return zero deleted rows when RLS blocks deletion.
  if (deletedCount !== existingCount) {
    console.error('Chat history deletion incomplete:', {
      expected: existingCount,
      deleted: deletedCount,
    });

    throw new Error(
      'Chat history could not be completely deleted. Check the messages DELETE policy in Supabase.',
    );
  }

  // Keep the conversation record, but refresh its timestamp.
  const { error: updateError } = await supabase
    .from('conversations')
    .update({
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  if (updateError) {
    console.warn(
      'Conversation timestamp update failed after clearing:',
      updateError,
    );
  }

  return deletedCount;
}
