import React from 'react';
import {
  formatChatDateLabel,
  getMessageDate,
  shouldShowChatDateSeparator,
} from '@/lib/familyChatUtils';

export default function FamilyChatMessageList({ messages = [], sending = false }) {
  const visibleMessages = (messages || []).filter(Boolean);

  return (
    <>
      {visibleMessages.map((msg, index) => {
        const prev = visibleMessages[index - 1];
        const grouped = prev && prev.sender === msg.sender;
        const isStaff = msg.sender === 'staff';
        const showDate = shouldShowChatDateSeparator(msg, prev);
        const date = getMessageDate(msg);

        return (
          <React.Fragment key={msg.id || `msg-${msg.createdAt || msg.time}-${index}`}>
            {showDate && date ? (
              <div className="family-chat-date-sep" role="separator">
                <span>{formatChatDateLabel(date)}</span>
              </div>
            ) : null}
            <div
              className={`family-msg-row ${isStaff ? 'family-msg-row--received' : 'family-msg-row--sent'}`}
            >
              <div
                className={`family-msg-bubble ${isStaff ? 'family-msg-received' : 'family-msg-sent'}${grouped ? ' family-msg-grouped' : ''}`}
              >
                {msg.text}
                {msg.time ? (
                  <span className="family-msg-time">{msg.time}</span>
                ) : null}
              </div>
            </div>
          </React.Fragment>
        );
      })}
      {sending && (
        <div className="family-msg-row family-msg-row--received">
          <div className="family-typing-indicator" aria-label="Care team is typing">
            <div className="family-dot" />
            <div className="family-dot" />
            <div className="family-dot" />
          </div>
        </div>
      )}
    </>
  );
}
