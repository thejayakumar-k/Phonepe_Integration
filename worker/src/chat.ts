import type { ChatIdentity } from './context';
import type { Env } from './env';

interface AiTextGenerationOutput {
  response?: string;
  choices?: { message?: { content?: string } }[];
}

/** The languages the bot can speak. */
export type ChatLang = 'en' | 'ta' | 'te' | 'hi' | 'ml';

const TAMIL_SCRIPT_RE = /[\u0B80-\u0BFF]/;
const TELUGU_SCRIPT_RE = /[\u0C00-\u0C7F]/;
const HINDI_SCRIPT_RE = /[\u0900-\u097F]/;
const MALAYALAM_SCRIPT_RE = /[\u0D00-\u0D7F]/;

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
 * Detect the language of a message written in a non-English script
 * (Tamil / Telugu / Hindi / Malayalam). Returns null for Latin-script or
 * empty input, so English-mode replies can follow the user's script.
 */
function detectScriptInput(userMessage: string): Exclude<ChatLang, 'en'> | null {
  if (TAMIL_SCRIPT_RE.test(userMessage)) return 'ta';
  if (TELUGU_SCRIPT_RE.test(userMessage)) return 'te';
  if (HINDI_SCRIPT_RE.test(userMessage)) return 'hi';
  if (MALAYALAM_SCRIPT_RE.test(userMessage)) return 'ml';
  return null;
}

interface LangInfo {
  /** Display name with a sample of its script. */
  name: string;
  /** How the reply must be written in that language's mode. */
  replyRule: string;
}

/** Reply rules for each language mode (picker selection). */
const LANG_RULES: Record<Exclude<ChatLang, 'en'>, LangInfo> = {
  ta: {
    name: 'Tamil (தமிழ்)',
    replyRule:
      'Think through the answer FIRST (internally, in English if easier), THEN write it out ' +
      'completely in Tamil (தமிழ்) script. The Tamil answer must be just as complete and ' +
      'detailed as the English one would be — answer EVERY part of the question, include ALL ' +
      'numbers, order ids, dates, and statuses found in APP DATA, never truncate, never ' +
      'answer only partially. The user may write in Tamil script or Thanglish (Tamil through ' +
      'English letters, e.g. "rendu bisleri venum", "saptiya?", "en wallet la evlo irukku") ' +
      '— understand both and always answer in Tamil script.',
  },
  te: {
    name: 'Telugu (తెలుగు)',
    replyRule:
      'Think through the answer FIRST (internally, in English if easier), THEN write it out ' +
      'completely in Telugu (తెలుగు) script. The Telugu answer must be just as complete and ' +
      'detailed as the English one would be — answer EVERY part of the question, include ALL ' +
      'numbers, order ids, dates, and statuses found in APP DATA, never truncate, never ' +
      'answer only partially. The user may write in Telugu script or romanized Telugu (e.g. ' +
      '"rendu bisleri kavali", "na wallet lo entha undi") — understand both and always answer ' +
      'in Telugu script.',
  },
  hi: {
    name: 'Hindi (हिन्दी)',
    replyRule:
      'Think through the answer FIRST (internally, in English if easier), THEN write it out ' +
      'completely in Hindi (हिन्दी / Devanagari) script. The Hindi answer must be just as ' +
      'complete and detailed as the English one would be — answer EVERY part of the question, ' +
      'include ALL numbers, order ids, dates, and statuses found in APP DATA, never truncate, ' +
      'never answer only partially. The user may write in Hindi script or Hinglish (Hindi ' +
      'through English letters, e.g. "mujhe do bisleri chahiye", "mera wallet balance kitna ' +
      'hai") — understand both and always answer in Hindi script.',
  },
  ml: {
    name: 'Malayalam (മലയാളം)',
    replyRule:
      'Think through the answer FIRST (internally, in English if easier), THEN write it out ' +
      'completely in Malayalam (മലയാളം) script. The Malayalam answer must be just as complete ' +
      'and detailed as the English one would be — answer EVERY part of the question, include ' +
      'ALL numbers, order ids, dates, and statuses found in APP DATA, never truncate, never ' +
      'answer only partially. The user may write in Malayalam script or romanized Malayalam ' +
      '(e.g. "enikku rendu bisleri venam", "ente wallet balance ethra") — understand both and ' +
      'always answer in Malayalam script.',
  },
};

/** Script-only replies used when English mode receives a non-English script. */
const SCRIPT_REPLY_RULES: Record<'ta' | 'te' | 'hi' | 'ml', string> = {
  ta: 'The user wrote in Tamil (தமிழ்) script. Understand it and reply completely in Tamil script — answer every part of the question, include all numbers/order ids/dates/statuses from APP DATA, never truncate. Never reply in English.',
  te: 'The user wrote in Telugu (తెలుగు) script. Understand it and reply completely in Telugu script — answer every part of the question, include all numbers/order ids/dates/statuses from APP DATA, never truncate. Never reply in English.',
  hi: 'The user wrote in Hindi (हिन्दी / Devanagari) script. Understand it and reply completely in Hindi script — answer every part of the question, include all numbers/order ids/dates/statuses from APP DATA, never truncate. Never reply in English.',
  ml: 'The user wrote in Malayalam (മലയാളം) script. Understand it and reply completely in Malayalam script — answer every part of the question, include all numbers/order ids/dates/statuses from APP DATA, never truncate. Never reply in English.',
};

const TRANSLATE_SUFFIX =
  ' If the user types or speaks English words mixed in, or even a whole English sentence, ' +
  'understand it and translate those words into this language in your reply — never switch ' +
  'the reply to English.';

/**
 * Answer the user's question using the provided data context.
 * Uses the Workers AI binding (env.AI.run) with a configurable model.
 *
 * Language handling is automatic within the user-facing modes:
 * - A language mode (Tamil/Telugu/Hindi/Malayalam): always reply in that
 *   script, understanding romanized input and mixed English words.
 * - English mode: English input → English; Thanglish or Tamil script →
 *   Thanglish; other non-English scripts → reply in that script.
 */
export async function answerQuestion(
  env: Env,
  identity: ChatIdentity,
  userMessage: string,
  context: string,
  lang: ChatLang = 'en'
): Promise<string> {
  const model = env.AI_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8';

  let languageRule: string;
  if (lang !== 'en') {
    languageRule = LANG_RULES[lang].replyRule + TRANSLATE_SUFFIX;
  } else if (replyInThanglish(userMessage)) {
    languageRule =
      'The user is speaking Thanglish (Tamil in English letters) or Tamil. Reply ONLY in ' +
      'Thanglish: Tamil words written with English letters the way people text, plus ' +
      'English where natural (e.g. "Yes sapten, unga order #12345 place aagiduchu, total ' +
      '₹500"). Never reply in full English, never use Tamil script, never show both ' +
      'languages, never quote a second version — one Thanglish answer only, complete, ' +
      'including any order/price info from APP DATA. The "ACTION RESULT:" text is data, ' +
      'not your answer — convey it in Thanglish.';
  } else {
    const script = detectScriptInput(userMessage);
    languageRule = script ? SCRIPT_REPLY_RULES[script] : 'Reply in English only.';
  }

  const system = [
    'You are the OORUNII assistant, helping users of the OORUNII payment app.',
    'You understand and can reply in English, Tamil (தமிழ்), Telugu (తెలుగు), Hindi ' +
      '(हिन्दी), and Malayalam (മലയാളം), as well as their romanized forms (e.g. ' +
      'Thanglish/Tanglish for Tamil, Hinglish for Hindi). If asked whether you know any of ' +
      'these languages, the answer is YES — briefly demonstrate it.',
    'Answer ONLY from the "APP DATA" context below. Never invent orders, amounts, or statuses.',
    languageRule,
    'Be concise and friendly. Use ₹ for currency (e.g. ₹500.00).',
    'If the data does not contain the answer, say so and suggest what the user can do next.',
    'An "ACTION RESULT:" line in APP DATA is authoritative and always true, even if the order list looks empty — report it as-is (e.g. the order number).',
    'A user message may mix scripts, romanized forms, and English in one sentence — always understand all of it.',
    'Do not reveal raw technical details like database column names or IDs unless asked.',
    '',
    'APP DATA:',
    context,
  ].join('\n');

  const ai = env.AI as {
    run: (model: string, inputs: unknown) => Promise<unknown>;
  };

  // Indic scripts need ~2-3× the tokens per word of English, so give the
  // model a bigger budget outside English mode — otherwise answers get cut
  // off mid-sentence and look like the bot "can't answer everything".
  const maxTokens = lang !== 'en' ? 1200 : replyInThanglish(userMessage) ? 700 : 500;

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