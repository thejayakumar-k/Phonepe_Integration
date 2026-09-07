import { getSupabase } from './supabase';
import { buildContext, type ChatIdentity } from './context';
import { answerQuestion } from './chat';
import { detectIntent, detectIntentWithLLM, placeOrder, cancelOrders } from './actions';
import { fetchProducts } from './products';
import { fetchStoreSettings, fetchFaqs } from './settings';
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
        // Transcribe the spoken audio. In Tamil mode, hint the language so
        // mixed Tamil speech (with English words like "order", "wallet")
        // comes back as Tamil script instead of being auto-detected as
        // English. English mode keeps auto-detection — spoken Thanglish
        // arrives as romanized text either way.
        const whisperInput: { audio: string; language?: string } = { audio };
        if (lang === 'ta') whisperInput.language = 'ta';
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
      // Live data from the database — products, store identity, and the
      // FAQ knowledge base are all read fresh on every message, so
      // changes there are known instantly with no code changes.
      const products = await fetchProducts(supabase);
      const store = await fetchStoreSettings(supabase);
      const faqs = await fetchFaqs(supabase);
      const context = await buildContext(supabase, identity);
      const catalog = products
        .map((p) => `${p.name} — ₹${Number(p.price).toFixed(2)} per ${p.unit} (${p.image})`)
        .join('\n');
      const storeInfo =
        `Store: ${store.storeName} (ID: ${store.vendorId})` +
        (store.supportContact ? ` | Support contact: ${store.supportContact}` : '');
      const knowledge =
        faqs.length > 0
          ? '\n\nKNOWLEDGE BASE (answer from these when relevant):\n' +
            faqs
              .map((f) => `Q: ${f.question}\nA: ${f.answer}`)
              .join('\n\n')
          : '';

      // Detect and run any requested action, then let the LLM answer with
      // the action result included in its context. The catalog is always
      // present so price/catalog questions work for every product.
      let actionContext =
        `${context}\n\n${storeInfo}\n\nAVAILABLE PRODUCTS:\n${catalog}` + knowledge;
      if (identity.role === 'customer') {
        // Fast deterministic path first (product name mentioned directly),
        // then LLM function-calling for natural-language phrasings.
        let intent = detectIntent(message, products);
        if (intent.intent === 'ask') {
          const llmIntent = await detectIntentWithLLM(env, message, lang, products);
          if (llmIntent) intent = llmIntent;
        }
        if (intent.intent === 'place_order') {
          const result = await placeOrder(supabase, identity, intent.product, intent.qty ?? 1, products, store);
          actionContext += `\n\nACTION RESULT: ${result.message}`;
        } else if (intent.intent === 'cancel_orders') {
          const result = await cancelOrders(supabase, identity, intent.orderId);
          actionContext += `\n\nACTION RESULT: ${result.message}`;
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