import { useState } from 'react';
import type React from 'react';
import { X, Send, Lock, MessageCircle } from 'lucide-react';

export interface ChatMessageItem {
  id: string;
  sender: 'self' | 'peer';
  text: string;
  timestamp: number;
}

interface ChatDrawerProps {
  isOpen: boolean;
  messages: ChatMessageItem[];
  isConnected: boolean;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  messages,
  isConnected,
  onSendMessage,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !isConnected) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden animate-fade-in"
        onClick={onClose}
      />

      {/* 
        Responsive Chat Panel:
        - Mobile: Slide-up Bottom Sheet (rounded-t-3xl, h-[65vh])
        - Desktop: Docked right-hand panel (md:w-80 lg:w-96 h-full border-l border-slate-800)
      */}
      <div className="fixed md:absolute inset-x-0 bottom-0 md:inset-y-0 md:left-auto md:right-0 h-[65vh] md:h-full w-full md:w-84 lg:w-96 bg-slate-900/98 backdrop-blur-xl border-t md:border-t-0 md:border-l border-slate-800 z-50 flex flex-col shadow-2xl rounded-t-3xl md:rounded-none animate-slide-up md:animate-slide-left select-none">
        {/* Mobile Drag Handle */}
        <div className="w-full flex items-center justify-center pt-2.5 pb-1 md:hidden">
          <div className="w-10 h-1.5 rounded-full bg-slate-700/80" />
        </div>

        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-slate-800/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-400">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Conversation</h3>
              <p className="text-[11px] text-slate-400">In-call instant messenger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Privacy Callout */}
        <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800/60 flex items-center gap-2 text-[10px] text-slate-400">
          <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
          <span>Peer-to-peer ephemeral messages. Never saved.</span>
        </div>

        {/* Message Bubble Feed */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-400 mb-2">
                <MessageCircle className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-300 mb-1">No messages yet</p>
              <p className="text-[11px] text-slate-400 max-w-[200px]">
                {isConnected
                  ? 'Send a friendly greeting to your partner below.'
                  : 'Connect with a stranger to begin texting.'}
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSelf = msg.sender === 'self';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-medium ${
                      isSelf
                        ? 'bg-emerald-600 text-white rounded-br-xs shadow-sm shadow-emerald-950/20'
                        : 'bg-slate-800 text-slate-100 rounded-bl-xs border border-slate-700/70 shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Text Input Footer */}
        <form
          onSubmit={handleSubmit}
          className="p-3 border-t border-slate-800 bg-slate-950/90 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isConnected ? 'Type a message...' : 'Connect to a partner to chat...'
            }
            disabled={!isConnected}
            maxLength={300}
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isConnected || !inputText.trim()}
            className="h-10 w-10 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );
};
