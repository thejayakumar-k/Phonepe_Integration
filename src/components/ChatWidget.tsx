import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getChatLang } from '../utils/chatLang';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_API_URL = (import.meta.env.VITE_CHAT_API_URL || '').replace(/\/$/, '');

export function ChatWidget() {
  const { session } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speakEnabledRef = useRef(false);
  // Browser-native speech recognition (Chrome/Android = Google's engine).
  const speechRecRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  useEffect(() => {
    speakEnabledRef.current = speakEnabled;
    if (!speakEnabled) {
      window.speechSynthesis?.cancel();
    }
  }, [speakEnabled]);

  // Speak assistant replies aloud when enabled, using the selected language's voice.
  useEffect(() => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      const last = messages[messages.length - 1];
      if (speakEnabledRef.current && 'speechSynthesis' in window) {
        const lang = getChatLang();
        const utterance = new SpeechSynthesisUtterance(last.content);
        utterance.rate = 1;
        utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-IN';
        // Prefer a voice matching the selected language.
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find((v) => v.lang.toLowerCase().startsWith(lang === 'ta' ? 'ta' : 'en'));
        if (voice) utterance.voice = voice;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${CHAT_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          role: session?.role,
          customerId: session?.customerId,
          customerName: session?.customerName,
          vendorId: session?.vendorId,
          vendorName: session?.vendorName,
          lang: getChatLang(),
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

  // Fallback: record audio and transcribe with Whisper on the worker.
  const startRecordingFallback = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        transcribeRecording();
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      alert('Microphone access was denied. Please allow mic access and try again.');
    }
  };

  // Start voice input: Google engine in Chrome/Android, Whisper elsewhere.
  const startVoiceInput = () => {
    type AnyRecognition = {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      start: () => void;
      stop: () => void;
      onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
      onerror: ((e: { error?: string }) => void) | null;
      onend: (() => void) | null;
    };
    const w = window as unknown as { SpeechRecognition?: new () => AnyRecognition; webkitSpeechRecognition?: new () => AnyRecognition };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;

    if (SR) {
      const rec = new SR();
      rec.lang = getChatLang() === 'ta' ? 'ta-IN' : 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let transcript = '';
      rec.onresult = (e) => {
        const result = e.results?.[0]?.[0];
        if (result) transcript = result.transcript;
      };
      rec.onerror = (e) => {
        setRecording(false);
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: 'Microphone access was denied. Please allow mic access and try again.' },
          ]);
        }
      };
      rec.onend = () => {
        speechRecRef.current = null;
        setRecording(false);
        const text = transcript.trim();
        if (text) send(text);
      };
      speechRecRef.current = rec;
      setRecording(true);
      rec.start();
      return;
    }

    startRecordingFallback();
  };

  const stopVoiceInput = () => {
    if (speechRecRef.current) {
      speechRecRef.current.stop();
      speechRecRef.current = null;
    } else {
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  };

  const transcribeRecording = async () => {
    const blob = new Blob(audioChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || 'audio/webm',
    });
    if (blob.size === 0) return;

    setTranscribing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(blob);
      });

      const res = await fetch(`${CHAT_API_URL}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, lang: getChatLang() }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      const text = (data.text || '').trim();
      if (text) {
        await send(text);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.error || 'Sorry, I could not hear you clearly. Please try again.',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Voice input failed. Please try again.',
        },
      ]);
    } finally {
      setTranscribing(false);
    }
  };

  // Hidden before login and on settings screens.
  const HIDDEN_PATHS = [
    '/customer/settings',
    '/vendor/settings',
    '/customer/manage-upi',
    '/customer/bank-mapping',
  ];
  if (HIDDEN_PATHS.includes(location.pathname)) return null;
  if (!session) return null;

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-title">OORUNII Assistant</span>
            <div className="chat-header-actions">
              <button
                className={`chat-speak-toggle ${speakEnabled ? 'active' : ''}`}
                onClick={() => setSpeakEnabled((v) => !v)}
                aria-label="Toggle voice replies"
                title={speakEnabled ? 'Voice replies: ON' : 'Voice replies: OFF'}
              >
                {speakEnabled ? '🔊' : '🔇'}
              </button>
              <button
                className="chat-close"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="chat-messages" ref={listRef}>
            {messages.length === 0 && (
              <div className="chat-empty">
                Ask me about your orders, wallet balance, payments, or refunds — or use the 🎤 to speak.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.content}
              </div>
            ))}
            {(loading || transcribing) && (
              <div className="chat-msg assistant chat-typing">…</div>
            )}
          </div>

          <div className="chat-input-row">
            <button
              className={`chat-mic ${recording ? 'recording' : ''}`}
              onClick={recording ? stopVoiceInput : startVoiceInput}
              disabled={transcribing}
              aria-label={recording ? 'Stop recording' : 'Start voice input'}
              title={recording ? 'Stop recording' : 'Voice input'}
            >
              {recording ? '⏹' : '🎤'}
            </button>
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
            <button className="chat-send" onClick={() => send()} disabled={loading || !input.trim()}>
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