import { getSupabase } from './supabase';
import { buildContext, type ChatIdentity } from './context';
import { answerQuestion } from './chat';
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
        role?: string;
        customerId?: string;
        customerName?: string;
        vendorId?: string;
        vendorName?: string;
      };

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
      const reply = await answerQuestion(env, identity, message, context);

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