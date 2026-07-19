import React, { useRef } from 'react';
import { Send } from 'lucide-react';

export default function FamilyChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  sending = false,
  inputRef: externalRef,
}) {
  const internalRef = useRef(null);
  const inputRef = externalRef || internalRef;

  const canSend = Boolean(value.trim()) && !sending && !disabled;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="family-chat-input-wrap">
      <input
        ref={inputRef}
        className="family-chat-input"
        type="text"
        placeholder="Type your message..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        aria-label="Message input"
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className={`family-chat-send-btn${canSend ? ' family-chat-send-btn--ready' : ''}`}
        aria-label="Send message"
      >
        <Send size={18} color="white" strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  );
}
