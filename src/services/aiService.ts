import { supabase } from '../lib/supabase';

/**
 * Sends a message to the chatbot and returns the assistant's reply.
 *
 * Currently stubbed — returns a placeholder after 800ms. When the Edge
 * Function is ready, replace the stub with:
 *
 *   const { data, error } = await supabase.functions.invoke('chat', {
 *     body: { conversationId, message },
 *   });
 *   if (error) throw error;
 *   return data.reply;
 */
export async function getChatReply(
  conversationId: string,
  message: string
): Promise<string> {
  // Simulate network latency so the UI shows the "thinking" indicator
  await new Promise((r) => setTimeout(r, 800));

  if (message.toLowerCase().includes('dry')) {
    return "For dry skin, look for products with ceramides, hyaluronic acid, and glycerin. Avoid alcohol-based toners. Want me to look at your latest scan?";
  }
  if (message.toLowerCase().includes('oily')) {
    return "For oily skin, a gentle salicylic acid cleanser in the morning helps regulate sebum. Niacinamide is your friend. Want me to check your last scan for consistency?";
  }
  return "I can help with skin routines, ingredient questions, and interpreting your scan results. What would you like to know?";
}