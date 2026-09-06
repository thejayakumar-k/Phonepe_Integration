export type ChatLang = 'en' | 'ta';

const STORAGE_KEY = 'oorunii_chat_lang';

/** Chat language preference. Defaults to English. */
export function getChatLang(): ChatLang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ta' ? 'ta' : 'en';
    // Legacy 'thanglish' values fall back to English (Thanglish is now
    // auto-detected inside both modes, no separate option).
  } catch {
    return 'en';
  }
}

export function setChatLang(lang: ChatLang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage errors
  }
}
