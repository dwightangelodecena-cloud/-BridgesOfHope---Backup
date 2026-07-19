import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useSupportChat } from '@/hooks/useSupportChat';
import FamilyChatComposer from '@/components/family/FamilyChatComposer';
import FamilyChatMessageList from '@/components/family/FamilyChatMessageList';
import FamilyChatFab from '@/components/family/FamilyChatFab';
import FamilyChatBrandMark from '@/components/family/FamilyChatBrandMark';

export default function FloatingChatHead({ bottomOffset = 24 }) {
  const inputRef = useRef(null);
  const chatBodyRef = useRef(null);
  const {
    messages,
    loading,
    sending,
    sendError,
    isChatOpen,
    setIsChatOpen,
    sendMessage,
  } = useSupportChat();
  const [inputValue, setInputValue] = useState('');

  const chatWindowBottom = bottomOffset + 76;
  const fabBottom = bottomOffset;

  useEffect(() => {
    if (!chatBodyRef.current) return;
    chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isChatOpen, sending]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || sending) return;
    const text = inputValue;
    setInputValue('');
    await sendMessage(text);
    inputRef.current?.focus();
  };

  const visibleMessages = (messages || []).filter(Boolean);

  return (
    <>
      {isChatOpen && (
        <div
          className="family-chat-window"
          style={{ '--family-chat-bottom': `${chatWindowBottom}px` }}
        >
          <header className="family-chat-header">
            <div className="family-chat-header__brand">
              <FamilyChatBrandMark />
              <div className="family-chat-header__text">
                <div className="family-chat-title">Bridges of Hope</div>
                <div className="family-chat-status">
                  <span className="family-chat-status__dot" aria-hidden />
                  <span>Care team</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className="family-chat-close"
              onClick={() => setIsChatOpen(false)}
              aria-label="Close chat"
            >
              <X size={20} strokeWidth={2} aria-hidden />
            </button>
          </header>

          <div className="family-chat-body-wrap">
            <div ref={chatBodyRef} className="family-chat-body">
              {loading && <div className="family-chat-loading">Loading messages…</div>}
              <FamilyChatMessageList messages={visibleMessages} sending={sending} />
            </div>
          </div>

          {sendError ? (
            <div className="family-chat-error" role="alert">
              {sendError}
            </div>
          ) : null}
          <FamilyChatComposer
            inputRef={inputRef}
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            sending={sending}
          />
        </div>
      )}

      <FamilyChatFab
        isOpen={isChatOpen}
        onClick={() => setIsChatOpen((v) => !v)}
        bottom={fabBottom}
      />
    </>
  );
}
