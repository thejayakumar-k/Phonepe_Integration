import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_API_URL = (import.meta.env.VITE_CHAT_API_URL || '').replace(/\/$/, '');

export function ChatWidget() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${CHAT_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          role: session?.role,
          customerId: session?.customerId,
          customerName: session?.customerName,
          vendorId: session?.vendorId,
          vendorName: session?.vendorName,
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || data.error || 'Sorry, something went wrong.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Could not reach the assistant. Make sure the chat worker is running (VITE_CHAT_API_URL).',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-title">OORUNII Assistant</span>
            <button
              className="chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div className="chat-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="chat-empty">
                Ask me about your orders, wallet balance, payments, or refunds.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && <div className="chat-msg assistant chat-typing">…</div>}
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              type="text"
              placeholder="Ask about your account…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send();
              }}
            />
            <button className="chat-send" onClick={send} disabled={loading || !input.trim()}>
              ➤
            </button>
          </div>
        </div>
      )}

      <button
        className="chat-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open assistant"
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}