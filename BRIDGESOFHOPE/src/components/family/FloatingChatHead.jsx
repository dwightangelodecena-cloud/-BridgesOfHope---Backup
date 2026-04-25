import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

export default function FloatingChatHead() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Hello! How can I help you today?', sender: 'bot', time: '3:18 PM' },
  ]);
  const chatBodyRef = useRef(null);

  useEffect(() => {
    if (!chatBodyRef.current) return;
    chatBodyRef.current.scrollTo({
      top: chatBodyRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isChatOpen, isTyping]);

  const handleSendMessage = () => {
    if (!inputValue.trim() || isTyping) return;

    const userMsg = {
      id: Date.now(),
      text: inputValue,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      const botMsg = {
        id: Date.now() + 1,
        text: 'Thank you for reaching out to Bridges of Hope. How can I assist you with your recovery journey today?',
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 1500);
  };

  return (
    <>
      {isChatOpen && (
        <div className="family-chat-window">
          <div className="family-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, background: '#F54E25', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#1B2559' }}>Support AI</div>
                <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>Active now</div>
              </div>
            </div>
            <X size={20} color="#A3AED0" style={{ cursor: 'pointer' }} onClick={() => setIsChatOpen(false)} />
          </div>

          <div className="family-chat-body" ref={chatBodyRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`family-msg-bubble ${msg.sender === 'bot' ? 'family-msg-received' : 'family-msg-sent'}`}>
                {msg.text}
                <div style={{ fontSize: 9, marginTop: 6, opacity: 0.6, textAlign: msg.sender === 'bot' ? 'left' : 'right' }}>{msg.time}</div>
              </div>
            ))}
            {isTyping && (
              <div className="family-typing-indicator">
                <div className="family-dot" />
                <div className="family-dot" />
                <div className="family-dot" />
              </div>
            )}
          </div>

          <div className="family-chat-input-wrap">
            <input
              className="family-chat-input"
              placeholder="Type your message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              className="family-chat-send-btn"
            >
              <Send size={18} color="white" />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className="floating-chat-head"
        aria-label="Open chat support"
        onClick={() => setIsChatOpen((v) => !v)}
      >
        {isChatOpen ? <X size={26} color="#FFFFFF" /> : <MessageCircle size={24} color="#FFFFFF" strokeWidth={2.25} />}
      </button>
      <style>{`
        .family-chat-window {
          position: fixed;
          bottom: 100px;
          right: 20px;
          width: 350px;
          height: 500px;
          background: #ffffff;
          border-radius: 24px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          z-index: 5001;
          overflow: hidden;
          border: 1px solid rgba(0,0,0,0.05);
          animation: familySlideUp 0.3s ease;
        }
        @keyframes familySlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .family-chat-header {
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          border-bottom: 1px solid #F1F1F1;
        }
        .family-chat-body {
          flex: 1;
          padding: 20px;
          background: #F8F9FD;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          scrollbar-width: none;
        }
        .family-chat-body::-webkit-scrollbar { display: none; }
        .family-msg-bubble {
          max-width: 85%;
          padding: 12px 16px;
          font-size: 13.5px;
          line-height: 1.4;
          position: relative;
        }
        .family-msg-received {
          background: #ffffff;
          color: #1B2559;
          align-self: flex-start;
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.03);
        }
        .family-msg-sent {
          background: #F54E25;
          color: #ffffff;
          align-self: flex-end;
          border-radius: 18px 18px 4px 18px;
        }
        .family-typing-indicator {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          background: #ffffff;
          width: fit-content;
          border-radius: 18px 18px 18px 4px;
        }
        .family-dot {
          width: 6px;
          height: 6px;
          background: #A3AED0;
          border-radius: 50%;
          animation: familyBounce 1.4s infinite ease-in-out;
        }
        .family-dot:nth-child(2) { animation-delay: 0.2s; }
        .family-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes familyBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        .family-chat-input-wrap {
          padding: 15px 20px;
          background: #ffffff;
          display: flex;
          gap: 12px;
          align-items: center;
          border-top: 1px solid #F1F1F1;
        }
        .family-chat-input {
          flex: 1;
          border: none;
          background: #F4F7FE;
          border-radius: 15px;
          padding: 12px 18px;
          outline: none;
          font-size: 13px;
          color: #1B2559;
        }
        .family-chat-send-btn {
          background: #F54E25;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .family-chat-send-btn:disabled {
          background: #E9EDF7;
          cursor: not-allowed;
        }
        .floating-chat-head {
          position: fixed;
          right: 20px;
          bottom: 24px;
          width: 60px;
          height: 60px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(145deg, #F97316, #F54E25);
          box-shadow: 0 14px 30px rgba(245, 78, 37, 0.32);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 5000;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .floating-chat-head:hover {
          transform: translateY(-1px) scale(1.01);
          box-shadow: 0 18px 34px rgba(245, 78, 37, 0.36);
        }
        @media (max-width: 768px) {
          .family-chat-window {
            width: 320px;
            height: 450px;
            bottom: 85px;
            right: 15px;
            border-radius: 20px;
          }
          .floating-chat-head {
            width: 56px;
            height: 56px;
            right: 14px;
            bottom: 84px;
          }
        }
      `}</style>
    </>
  );
}
