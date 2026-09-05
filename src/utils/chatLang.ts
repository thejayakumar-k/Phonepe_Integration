export type ChatLang = 'en' | 'ta';

const STORAGE_KEY = 'oorunii_chat_lang';

/** Chat language preference. Defaults to English. */
export function getChatLang(): ChatLang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ta' ? 'ta' : 'en';
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