//src/services/chatService.ts

import { supabase } from '../lib/supabase';

interface ChatReplyResponse {
  reply?: string;
  error?: string;
}

export async function getChatReply(
  conversationId: string,
  message: string,
): Promise<string> {
  const cleanMessage = message.trim();

  if (!conversationId) {
    throw new Error('Conversation ID is missing.');
  }

  if (!cleanMessage) {
    throw new Error('Please enter a message.');
  }

  if (cleanMessage.length > 500) {
    throw new Error('Your message cannot exceed 500 characters.');
  }

  try {
    const { data, error } =
      await supabase.functions.invoke<ChatReplyResponse>(
        'skin-chat',
        {
          body: {
            conversationId,
            message: cleanMessage,
          },
        },
      );

    if (error) {
      const functionError = error as Error & {
        context?: Response;
      };

      let status = 'Unknown';
      let serverMessage = '';

      if (functionError.context) {
        status = String(functionError.context.status);

        try {
          const response = functionError.context.clone();
          const responseBody = await response.json();

          serverMessage =
            responseBody?.error ||
            responseBody?.message ||
            JSON.stringify(responseBody);
        } catch {
          try {
            serverMessage = await functionError.context
              .clone()
              .text();
          } catch {
            serverMessage = 'Unable to read server response.';
          }
        }
      }

      console.error('SkinAI Edge Function error:', {
        status,
        message: serverMessage,
        originalError: functionError.message,
      });

      throw new Error(
        `SkinAI server error (${status}): ${
          serverMessage || functionError.message
        }`,
      );
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    if (typeof data?.reply !== 'string' || !data.reply.trim()) {
      throw new Error('SkinAI returned an empty response.');
    }

    return data.reply.trim();
  } catch (error: unknown) {
    console.error('Chat service failed:', error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      'Something went wrong while contacting SkinAI. Please try again.',
    );
  }
}
