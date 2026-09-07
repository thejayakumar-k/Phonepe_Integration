import type { ChatIdentity } from './context';
import type { Env } from './env';

interface AiTextGenerationOutput {
  response?: string;
  choices?: { message?: { content?: string } }[];
}

const TAMIL_SCRIPT_RE = /[\u0B80-\u0BFF]/;

/**
 * Common Thanglish (Romanized Tamil) words that mark a Tamil message
 * written in English letters. If any of these appear in a Latin-script
 * message, the user is speaking Thanglish.
 */
const THANGLISH_HINT_RE =
  /\b(thanglish|tanglish|enna|endha|ethu|ethana|eppadi|epdi|evlo|evalo|enakku|enaku|unga|unnga|unbar|irukku|iruku|irukken|irukanga|vachurukken|vachuruku|vachirukken|venum|venam|vaanganum|vaangi|sapten|saptiya|saptacha|sapten|tharumaa|tharen|pannu|panrathu|pannen|pannuunga|podu|podunga|podanum|rathu|raththu|rendu|moonu|naalu|anju|aindhu|onnu|ondru|oru|pathu|pattu|nanri|nandri|seri|aamam|aama|illa|illai|illama|kandippa|podhuma|kaasu|panam|vasooli|kattunga|thambi|anna|akka|thanga|vaanga|poga|varum|kidaikkum|kidaikum|vendaam|vendam|sari|aana|appo|ippo|ipdi|romba|konjam|puriyala|purinjithu|mattum|verum|ellam|ella)\b/i;

/**
 * Should the assistant answer this message in Thanglish (Tamil written
 * with English letters)? True when the user typed Thanglish (Latin letters
 * + Tamil words) or wrote in Tamil script — voice input in English mode
 * arrives as Tamil script after auto-detection, and spoken Tamil gets a
 * Thanglish reply so it stays in English letters. Purely-English messages
 * stay English.
 */
function replyInThanglish(userMessage: string): boolean {
  return TAMIL_SCRIPT_RE.test(userMessage) || THANGLISH_HINT_RE.test(userMessage);
}

/**
 * Answer the user's question using the provided data context.
 * Uses the Workers AI binding (env.AI.run) with a configurable model.
 *
 * Language handling is automatic within the two user-facing modes:
 * - English mode: plain English input → English reply; Thanglish or Tamil
 *   (script, e.g. from voice) input → Thanglish reply (English letters).
 * - Tamil mode: always reply in Tamil script, understanding Thanglish input.
 */
export async function answerQuestion(
  env: Env,
  identity: ChatIdentity,
  userMessage: string,
  context: string,
  lang: 'en' | 'ta' = 'en'
): Promise<string> {
  const model = env.AI_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8';

  const languageRule =
    lang === 'ta'
      ? 'Think through the answer FIRST (internally, in English if easier), THEN write it out ' +
        'completely in Tamil (தமிழ்) script. The Tamil answer must be just as complete and ' +
        'detailed as the English one would be — answer EVERY part of the question, include ALL ' +
        'numbers, order ids, dates, and statuses found in APP DATA, never truncate, never ' +
        'answer only partially. The user may write in Tamil script or Thanglish (Tamil through ' +
        'English letters, e.g. "rendu bisleri venum", "saptiya?", "en wallet la evlo irukku") ' +
        '— understand both and always answer in Tamil script.'
      : replyInThanglish(userMessage)
        ? 'The user is speaking Thanglish (Tamil in English letters) or Tamil. Reply ONLY in ' +
          'Thanglish: Tamil words written with English letters the way people text, plus ' +
          'English where natural (e.g. "Yes sapten, unga order #12345 place aagiduchu, total ' +
          '₹500"). Never reply in full English, never use Tamil script, never show both ' +
          'languages, never quote a second version — one Thanglish answer only, complete, ' +
          'including any order/price info from APP DATA. The "ACTION RESULT:" text is data, ' +
          'not your answer — convey it in Thanglish.'
        : 'Reply in English only.';

  const system = [
    'You are the OORUNII assistant, helping users of the OORUNII payment app.',
    'You understand and can reply in English, Tamil (தமிழ் script), and Thanglish/Tanglish ' +
      '(Tamil written in English letters, e.g. "sapten", "rendu bisleri venum"). If asked ' +
      'whether you know Tanglish/Thanglish/Tamil, the answer is YES — briefly demonstrate it.',
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

  // Tamil script needs ~2-3× the tokens per word of English, so give the
  // model a bigger budget in Tamil mode — otherwise answers get cut off
  // mid-sentence and look like the bot "can't answer everything".
  const maxTokens = lang === 'ta' ? 1200 : replyInThanglish(userMessage) ? 700 : 500;

  const out = await ai.run(model, {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
    max_tokens: maxTokens,
  });

  const parsed = out as AiTextGenerationOutput;
  const text = (parsed?.response ?? parsed?.choices?.[0]?.message?.content)?.trim();
  return text || 'Sorry, I could not generate an answer right now. Please try again.';
}
