//supabase/functions/skin-chat/index.ts

import { withSupabase } from '@supabase/server';

// ======================================================
// CONFIGURATION
// ======================================================

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
];

const GEMINI_TIMEOUT_MS = 12_000;
const MAX_MESSAGE_LENGTH = 500;
const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_CONTENT_LENGTH = 1200;

const SYSTEM_PROMPT = `
You are SkinAI, a professional skincare education assistant.

Your purpose:
- Explain acne, dryness, oiliness, sensitivity and hyperpigmentation.
- Explain skincare ingredients and their benefits.
- Recommend practical morning and evening skincare routines.
- Explain how to introduce skincare products safely.
- Help users understand general skincare concepts.
- Personalize advice based on information provided by the user.

Safety:
- You are not a dermatologist and cannot diagnose medical conditions.
- Never prescribe medication or recommend stopping prescribed treatment.
- Never guarantee skincare results.
- Recommend consulting a dermatologist for persistent, painful,
  severe or worsening skin concerns.
- Be particularly careful with pregnancy, children and medication.
- Never present AI skin analysis as a definitive medical diagnosis.
- Do not make unsupported medical claims.

Communication:
- Be friendly, professional and informative.
- Use clear paragraphs and bullet points when appropriate.
- Avoid unnecessarily complicated medical terminology.
- Give practical, realistic skincare recommendations.
- Explain potential irritation and patch testing where relevant.
`;

// ======================================================
// TYPES
// ======================================================

interface GeminiContent {
  role: 'user' | 'model';
  parts: { text: string }[];
}

interface GeminiResult {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
    finishReason?: string;
  }[];
  error?: {
    message?: string;
    status?: string;
  };
}

interface GeminiAttemptResult {
  success: boolean;
  result?: GeminiResult;
  status?: number;
  error?: string;
  timedOut?: boolean;
}

interface ChatRequest {
  conversationId?: string;
  message?: string;
}

// ======================================================
// RESPONSE HELPER
// ======================================================

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

// ======================================================
// HISTORY PROCESSING
// ======================================================

function prepareHistory(
  messages: Array<{ role: string; content: string }>,
): GeminiContent[] {
  const normalized: GeminiContent[] = [];

  for (const message of messages) {
    if (
      (message.role !== 'user' && message.role !== 'assistant') ||
      typeof message.content !== 'string' ||
      !message.content.trim()
    ) {
      continue;
    }

    const role = message.role === 'assistant' ? 'model' : 'user';

    const text = message.content
      .trim()
      .slice(0, MAX_HISTORY_CONTENT_LENGTH);

    const previous = normalized[normalized.length - 1];

    if (previous && previous.role === role) {
      previous.parts[0].text += '\n' + text;
    } else {
      normalized.push({
        role,
        parts: [{ text }],
      });
    }
  }

  // Gemini conversation history must start with a user message.
  while (
    normalized.length > 0 &&
    normalized[0].role !== 'user'
  ) {
    normalized.shift();
  }

  return normalized;
}

// ======================================================
// GEMINI REQUEST
// ======================================================

async function callGemini(
  model: string,
  apiKey: string,
  contents: GeminiContent[],
): Promise<GeminiAttemptResult> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          },
        }),
        signal: controller.signal,
      },
    );

    const responseText = await response.text();

    let result: GeminiResult;

    try {
      result = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        status: response.status,
        error: 'Gemini returned an invalid JSON response.',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error:
          result.error?.message ||
          `Gemini returned HTTP ${response.status}.`,
      };
    }

    return {
      success: true,
      result,
      status: response.status,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === 'AbortError';

    return {
      success: false,
      timedOut,
      error: timedOut
        ? 'Gemini request timed out.'
        : error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ======================================================
// GEMINI RETRY + FALLBACK
// ======================================================

async function generateGeminiReply(
  requestId: string,
  apiKey: string,
  contents: GeminiContent[],
): Promise<string> {
  let lastError = 'Gemini is temporarily unavailable.';
  let lastStatus = 503;

  for (let modelIndex = 0; modelIndex < GEMINI_MODELS.length; modelIndex++) {
    const model = GEMINI_MODELS[modelIndex];
    const attempts = modelIndex === 0 ? 2 : 1;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      console.log(
        `[${requestId}] Model ${model}, attempt ${attempt}/${attempts}`,
      );

      const response = await callGemini(
        model,
        apiKey,
        contents,
      );

      if (response.success && response.result) {
        const reply = response.result.candidates?.[0]?.content?.parts
          ?.map((part) =>
            typeof part.text === 'string' ? part.text : ''
          )
          .join('')
          .trim();

        if (reply) {
          console.log(
            `[${requestId}] Gemini succeeded using ${model}`,
          );

          return reply;
        }

        lastError =
          `Gemini returned no text. Finish reason: ${
            response.result.candidates?.[0]?.finishReason ?? 'unknown'
          }`;

        lastStatus = 502;
        break;
      }

      lastError = response.error || 'Unknown Gemini error.';
      lastStatus = response.status || 503;

      console.error(
        `[${requestId}] ${model} failed: ${lastError}`,
      );

      const temporaryFailure =
        response.timedOut ||
        lastStatus === 429 ||
        lastStatus >= 500;

      if (!temporaryFailure) {
        throw new Error(
          `Gemini configuration/request error (${lastStatus}): ${lastError}`,
        );
      }

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    }
  }

  console.error(
    `[${requestId}] All Gemini models failed. Last status: ${lastStatus}`,
  );

  throw new Error(
    `Gemini temporarily unavailable (${lastStatus}): ${lastError}`,
  );
}

// ======================================================
// SUPABASE EDGE FUNCTION
// ======================================================

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req, ctx) => {
      const requestId = crypto.randomUUID().slice(0, 8);

      try {
        console.log(`[${requestId}] SkinAI request started`);

        // 1. Verify authenticated user.
        const userId = ctx.userClaims?.id;

        if (!userId) {
          return jsonError('Authentication required.', 401);
        }

        // 2. Validate request method.
        if (req.method !== 'POST') {
          return jsonError('Method not allowed.', 405);
        }

        // 3. Read request.
        let body: ChatRequest;

        try {
          body = await req.json();
        } catch {
          return jsonError('Invalid request body.', 400);
        }

        const conversationId =
          typeof body.conversationId === 'string'
            ? body.conversationId.trim()
            : '';

        const message =
          typeof body.message === 'string'
            ? body.message.trim()
            : '';

        if (!conversationId) {
          return jsonError('Conversation ID is required.', 400);
        }

        if (!message || message.length > MAX_MESSAGE_LENGTH) {
          return jsonError(
            'Message must contain between 1 and 500 characters.',
            400,
          );
        }

        // 4. Verify conversation ownership using the authenticated
        // client. RLS restricts this query to the current user.
        const { data: conversation, error: conversationError } =
          await ctx.supabase
            .from('conversations')
            .select('id')
            .eq('id', conversationId)
            .maybeSingle();

        if (conversationError) {
          console.error(
            `[${requestId}] Conversation lookup failed:`,
            conversationError,
          );

          return jsonError('Unable to verify conversation.', 500);
        }

        if (!conversation) {
          return jsonError(
            'Conversation not found or access denied.',
            404,
          );
        }

        // 5. Retrieve the latest messages from Supabase.
        // The current user message must already have been inserted
        // by sendUserMessage() before this function is invoked.
        const { data: recentMessages, error: historyError } =
          await ctx.supabase
            .from('messages')
            .select('role, content, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .limit(MAX_HISTORY_MESSAGES);

        if (historyError) {
          console.error(
            `[${requestId}] History retrieval failed:`,
            historyError,
          );

          return jsonError('Unable to retrieve chat history.', 500);
        }

        const chronologicalMessages = (recentMessages ?? []).reverse();

        // 6. Verify that the current message was saved.
        const latestMessage =
          chronologicalMessages[chronologicalMessages.length - 1];

        if (
          !latestMessage ||
          latestMessage.role !== 'user' ||
          latestMessage.content.trim() !== message
        ) {
          return jsonError(
            'Your message was not found in the conversation. Please try again.',
            409,
          );
        }

        // 7. Convert database messages to Gemini format.
        // The latest user message is already included.
        const contents = prepareHistory(
          chronologicalMessages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        );

        if (contents.length === 0) {
          return jsonError('No valid conversation history found.', 400);
        }

        // 8. Read Gemini API key.
        const geminiKey = Deno.env.get('GEMINI_API_KEY');

        if (!geminiKey) {
          console.error(
            `[${requestId}] GEMINI_API_KEY is missing.`,
          );

          return jsonError('AI service is not configured.', 500);
        }

        console.log(
          `[${requestId}] Authenticated user: ${userId}`,
        );

        console.log(
          `[${requestId}] Gemini history entries: ${contents.length}`,
        );

        // 9. Generate Gemini response.
        const reply = await generateGeminiReply(
          requestId,
          geminiKey,
          contents,
        );

        // 10. Save assistant response using the administrative
        // client. This bypasses the messages_insert_own policy,
        // which intentionally permits only user messages.
        //
        // Ownership was verified above using ctx.supabase.
        const { data: savedMessage, error: saveError } =
          await ctx.supabaseAdmin
            .from('messages')
            .insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: reply,
            })
            .select('*')
            .single();

        if (saveError) {
          console.error(
            `[${requestId}] Assistant message persistence failed:`,
            saveError,
          );

          return jsonError(
            'SkinAI generated a response but could not save it. Please reload your conversation.',
            500,
          );
        }

        // 11. Update conversation ordering.
        const { error: updateError } = await ctx.supabaseAdmin
          .from('conversations')
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq('id', conversationId)
          .eq('user_id', userId);

        if (updateError) {
          console.warn(
            `[${requestId}] Conversation timestamp update failed:`,
            updateError,
          );
        }

        console.log(
          `[${requestId}] SkinAI response saved successfully.`,
        );

        // 12. Return persisted assistant message.
        return Response.json({
          reply: savedMessage.content,
          messageId: savedMessage.id,
          createdAt: savedMessage.created_at,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          `[${requestId}] SkinAI function error: ${errorMessage}`,
        );

        if (
          errorMessage.startsWith('Gemini temporarily unavailable')
        ) {
          return jsonError(
            'SkinAI is temporarily busy. Please try again shortly.',
            503,
          );
        }

        if (
          errorMessage.startsWith('Gemini configuration/request error')
        ) {
          return jsonError(
            'The AI service encountered a configuration or request error.',
            502,
          );
        }

        return jsonError(
          'An unexpected error occurred. Please try again.',
          500,
        );
      }
    },
  ),
};
