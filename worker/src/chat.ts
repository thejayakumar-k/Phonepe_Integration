import type { ChatIdentity } from './context';
import type { Env } from './env';

interface AiTextGenerationOutput {
  response?: string;
}

/**
 * Answer the user's question using the provided data context.
 * Uses the Workers AI binding (env.AI.run) with a configurable model.
 */
export async function answerQuestion(
  env: Env,
  identity: ChatIdentity,
  userMessage: string,
  context: string,
  lang: 'en' | 'ta' | 'thanglish' = 'en'
): Promise<string> {
  const model = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

  const languageRule =
    lang === 'ta'
      ? 'Reply in Tamil (தமிழ்). Use Tamil script for the answer.'
      : lang === 'thanglish'
        ? 'The user may write in Thanglish — Tamil spoken in English/Latin letters ' +
          '(e.g. "rendu bisleri venum", "enakku oru kinley tharumaa", "ethana vachurukken", ' +
          '"en wallet la evlo irukku"). Understand it even when mixed with English words ' +
          '("enna price", "order podanum"). REPLY IN THANGLISH ONLY: write Tamil words using ' +
          'English letters the way people text (e.g. "Unga order #12345 successfully place aagiduchu. ' +
          'Total: ₹500"). Never use Tamil script in the reply; use English only for words the user ' +
          'used in English (order, price, wallet, refund).'
        : 'Reply in English only.';

  const system = [
    'You are the OORUNII assistant, helping users of the OORUNII payment app.',
    'Answer ONLY from the "APP DATA" context below. Never invent orders, amounts, or statuses.',
    languageRule,
    'Be concise and friendly. Use ₹ for currency (e.g. ₹500.00).',
    'If the data does not contain the answer, say so and suggest what the user can do next.',
    'An "ACTION RESULT:" line in APP DATA is authoritative and always true, even if the order list looks empty — report it as-is (e.g. the order number).',
    'A user message may mix Tamil script, Thanglish (Tamil in English letters), and English in one sentence — always understand all three.',
    'Do not reveal raw technical details like database column names or IDs unless asked.',
    '',
    'APP DATA:',
    context,
  ].join('\n');

  const ai = env.AI as {
    run: (model: string, inputs: unknown) => Promise<unknown>;
  };

  const out = await ai.run(model, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 500,
  });

  const text = (out as AiTextGenerationOutput)?.response?.trim();
  return text || 'Sorry, I could not generate an answer right now. Please try again.';
}