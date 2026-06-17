import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types/game';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ messages, onSendMessage }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="panel rounded-xl p-4 flex flex-col h-64">
      <h3 className="text-lg font-bold mb-3 text-mars-400">💬 聊天</h3>

      <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-4 text-sm">
            暂无消息
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="text-sm">
              <span className="font-semibold" style={{ color: msg.playerName === '系统' ? '#22c55e' : '#fbbf24' }}>
                {msg.playerName}:
              </span>
              <span className="ml-1 text-gray-300">{msg.message}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-mars-500"
          maxLength={200}
        />
        <button
          onClick={handleSend}
          className="btn-primary px-4 py-2 text-sm"
        >
          发送
        </button>
      </div>
    </div>
  );
};
