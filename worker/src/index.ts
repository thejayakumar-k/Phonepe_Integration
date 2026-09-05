import { getSupabase } from './supabase';
import { buildContext, type ChatIdentity } from './context';
import { answerQuestion } from './chat';
import { detectIntent, detectIntentWithLLM, placeOrder, cancelOrders } from './actions';
import { PRODUCTS } from './products';
import type { Env } from './env';

const corsHeaders = (origin: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': origin || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const headers = corsHeaders(origin);
    const path = new URL(request.url).pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = (await request.json()) as {
        message?: string;
        audio?: string;
        lang?: string;
        role?: string;
        customerId?: string;
        customerName?: string;
        vendorId?: string;
        vendorName?: string;
      };

      const lang = body.lang === 'ta' ? 'ta' : 'en';

      // ── Speech-to-text: transcribe recorded audio with Whisper ────────
      if (path === '/api/transcribe') {
        const audio = body.audio;
        if (!audio) {
          return new Response(JSON.stringify({ error: 'audio is required' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        const ai = env.AI as {
          run: (model: string, inputs: unknown) => Promise<unknown>;
        };
        // English: force transcription/translation into English so replies
        // never come back in Tamil. Tamil: auto-detect and keep the script.
        const whisperInput =
          lang === 'en'
            ? { audio, language: 'en', task: 'translate' }
            : { audio };
        const out = await ai.run('@cf/openai/whisper-large-v3-turbo', whisperInput);
        const text = ((out as { text?: string })?.text || '').trim();
        return new Response(JSON.stringify({ text }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      const message = (body.message || '').trim();
      if (!message) {
        return new Response(JSON.stringify({ error: 'message is required' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      const identity: ChatIdentity = {
        role: body.role === 'vendor' ? 'vendor' : 'customer',
        customerId: body.customerId,
        customerName: body.customerName,
        vendorId: body.vendorId,
        vendorName: body.vendorName,
      };

      const supabase = getSupabase(env);
      const context = await buildContext(supabase, identity);

      // Detect and run any requested action, then let the LLM answer with
      // the action result included in its context.
      let actionContext = context;
      if (identity.role === 'customer') {
        // Fast deterministic path first (product name mentioned directly),
        // then LLM function-calling for natural-language phrasings.
        let intent = detectIntent(message);
        if (intent.intent === 'ask') {
          const llmIntent = await detectIntentWithLLM(env, message);
          if (llmIntent) intent = llmIntent;
        }
        if (intent.intent === 'place_order') {
          const result = await placeOrder(supabase, identity, intent.product, intent.qty ?? 1);
          actionContext += `\n\nACTION RESULT: ${result.message}`;
        } else if (intent.intent === 'cancel_orders') {
          const result = await cancelOrders(supabase, identity, intent.orderId);
          actionContext += `\n\nACTION RESULT: ${result.message}`;
        } else if (intent.intent === 'list_products') {
          const catalog = PRODUCTS.map(
            (p) => `${p.name} — ${p.price} INR per ${p.unit} (${p.image})`
          ).join('\n');
          actionContext += `\n\nAVAILABLE PRODUCTS:\n${catalog}`;
        }
      }

      const reply = await answerQuestion(env, identity, message, actionContext, lang);

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return new Response(JSON.stringify({ error: 'Chat failed', detail }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
  },
};