import React from 'react';
import { MessageCircle, X } from 'lucide-react';

export default function FamilyChatFab({
  isOpen,
  onClick,
  unreadCount = 0,
  bottom,
  style = {},
  className = '',
}) {
  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <button
      type="button"
      className={`family-chat-fab${isOpen ? ' family-chat-fab--open' : ''}${className ? ` ${className}` : ''}`}
      aria-label={isOpen ? 'Close chat support' : 'Open chat support'}
      aria-expanded={isOpen}
      onClick={onClick}
      style={{ '--family-chat-fab-bottom': `${bottom}px`, ...style }}
    >
      <span className="family-chat-fab__icon family-chat-fab__icon--chat" aria-hidden>
        <MessageCircle size={24} color="#FFFFFF" strokeWidth={2.25} />
      </span>
      <span className="family-chat-fab__icon family-chat-fab__icon--close" aria-hidden>
        <X size={26} color="#FFFFFF" strokeWidth={2.25} />
      </span>
      {!isOpen && unreadCount > 0 ? (
        <span className="family-chat-fab__badge" aria-label={`${unreadCount} unread messages`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}
