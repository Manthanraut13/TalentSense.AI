import { useRef, useEffect, useState, KeyboardEvent } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';

import { useCoach } from '../hooks/useCoach';

export default function Coach() {
  const { messages, sendMessage, isLoading } = useCoach();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] bg-base">
      <div className="border-b border-line px-6 py-4 bg-elevated">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-primary" />
          <h1 className="font-semibold text-textPrimary">AI Career Coach</h1>
        </div>
        <p className="text-xs text-textSecondary mt-0.5">
          Knows your resume history · Powered by Llama 3.3
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                msg.role === 'assistant' ? 'bg-primary-subtle' : 'bg-elevated'
              }`}
            >
              {msg.role === 'assistant' ? (
                <Bot size={14} className="text-primary" />
              ) : (
                <User size={14} className="text-textSecondary" />
              )}
            </div>
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'assistant'
                  ? 'bg-surface border border-line text-textPrimary'
                  : 'bg-primary text-white'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-subtle flex items-center justify-center">
              <Bot size={14} className="text-primary" />
            </div>
            <div className="bg-surface border border-line rounded-2xl px-4 py-3">
              <Loader2 size={14} className="text-primary animate-spin" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="px-6 pb-2 flex flex-wrap gap-2">
          {[
            'Why do I keep missing the same skills?',
            'Which job type fits my background best?',
            'How do I improve my score quickly?',
            'What should I learn in the next 30 days?',
          ].map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="text-xs bg-surface border border-line text-textSecondary hover:text-primary hover:border-primary px-3 py-1.5 rounded-full transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-line px-6 py-4 bg-elevated">
        <div className="flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your career coach anything..."
            rows={1}
            className="flex-1 bg-surface border border-line rounded-xl px-4 py-3 text-sm text-textPrimary placeholder:text-textMuted resize-none focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-xl flex items-center justify-center transition-colors"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
        <p className="text-xs text-textMuted mt-2">Press Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
