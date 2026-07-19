import React from 'react';
import bridgesLogo from '@/assets/BRIDGESOFHOPELOGO.png';

export default function FamilyChatEmptyState() {
  return (
    <div className="family-chat-empty" role="status">
      <div className="family-chat-empty__icon" aria-hidden>
        <img src={bridgesLogo} alt="" className="family-chat-empty__logo" />
      </div>
      <div className="family-chat-empty__title">Start a conversation</div>
      <p className="family-chat-empty__sub">
        Send a message and our care team will respond as soon as possible.
      </p>
    </div>
  );
}
