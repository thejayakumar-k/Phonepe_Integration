import { useState } from 'react';
import { getChatLang, setChatLang, type ChatLang } from '../utils/chatLang';

const OPTIONS: { value: ChatLang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
];

export function ChatLanguagePicker() {
  const [lang, setLang] = useState<ChatLang>(getChatLang);

  const choose = (next: ChatLang) => {
    setChatLang(next);
    setLang(next);
  };

  return (
    <div className="chat-lang-picker">
      <span className="chat-lang-label">Chatbot Language</span>
      <div className="chat-lang-options">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`chat-lang-option ${lang === o.value ? 'active' : ''}`}
            onClick={() => choose(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}