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
  lang: 'en' | 'ta' = 'en'
): Promise<string> {
  const model = env.AI_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

  const languageRule =
    lang === 'ta'
      ? 'Reply in Tamil (தமிழ்). Use Tamil script for the answer.'
      : 'Reply in English only.';

  const system = [
    'You are the OORUNII assistant, helping users of the OORUNII payment app.',
    'Answer ONLY from the "APP DATA" context below. Never invent orders, amounts, or statuses.',
    languageRule,
    'Be concise and friendly. Use ₹ for currency (e.g. ₹500.00).',
    'If the data does not contain the answer, say so and suggest what the user can do next.',
    'An "ACTION RESULT:" line in APP DATA is authoritative and always true, even if the order list looks empty — report it as-is (e.g. the order number).',
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