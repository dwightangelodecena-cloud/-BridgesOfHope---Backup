import React from 'react';
import bridgesLogo from '@/assets/BRIDGESOFHOPELOGO.png';

export default function FamilyChatBrandMark({ className = '' }) {
  return (
    <div className={`family-chat-avatar${className ? ` ${className}` : ''}`} aria-hidden>
      <img src={bridgesLogo} alt="" />
    </div>
  );
}
