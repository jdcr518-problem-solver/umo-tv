import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import {
  Play,
  SkipForward,
  Square,
  Loader2,
  Send,
} from 'lucide-react';
import type { MatchmakingState } from '@shared/types.js';
import {
  type CountryOption,
  type GenderPreference,
  type ChatMessageItem,
  getCountryFlag,
  getGenderIcon,
  getGenderLabel,
} from '../lib/constants.js';

interface BottomSectionProps {
  state: MatchmakingState;
  selectedCountry: CountryOption;
  selectedGender: GenderPreference;
  partnerCountry?: string;
  chatMessages: ChatMessageItem[];
  onStartOrNext: () => void;
  onStop: () => void;
  onOpenCountryModal: () => void;
  onOpenGenderModal: () => void;
  onOpenReportModal?: () => void;
  onSendMessage: (text: string) => void;
}

function formatMessageTime(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const BottomSection: React.FC<BottomSectionProps> = ({
  state,
  selectedCountry,
  selectedGender,
  partnerCountry,
  chatMessages,
  onStartOrNext,
  onStop,
  onOpenCountryModal,
  onOpenGenderModal,
  onOpenReportModal,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isConnected = state === 'CONNECTED';
  const isSearching = state === 'QUEUED' || state === 'MATCHING';
  const isConnecting = state === 'CONNECTING';
  const isIdle = state === 'IDLE';

  // Smart auto-scroll: only scrolls to bottom if user is already near bottom
  const handleScroll = () => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    isNearBottomRef.current = scrollHeight - (scrollTop + clientHeight) < 50;
  };

  useEffect(() => {
    if (chatScrollRef.current && isNearBottomRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || !isConnected || isSubmitting) return;

    setIsSubmitting(true);
    try {
      onSendMessage(trimmed);
      setInputText('');
    } finally {
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  // Start / Next button label and icon based on state
  const getStartNextLabel = () => {
    switch (state) {
      case 'CONNECTED':
        return 'NEXT';
      case 'QUEUED':
      case 'MATCHING':
        return 'SEARCHING';
      case 'CONNECTING':
        return 'CONNECTING';
      case 'ERROR':
      case 'DISCONNECTED':
        return 'RETRY';
      default:
        return 'START';
    }
  };

  const partnerFlag = partnerCountry ? getCountryFlag(partnerCountry) : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-1.5 w-full h-auto lg:h-[155px] select-none">
      {/* 
        ============================================================
        BOTTOM-LEFT SECTION: Exactly 4 large adjacent controls
        Takes 50% of the total screen width on desktop.
        Each button takes ~25% of left section (12.5% of total width).
        ============================================================
      */}
      <div className="grid grid-cols-4 gap-1 sm:gap-1.5 w-full h-16 sm:h-20 lg:h-full">
        {/* 1. Start / Next (Soft Mint Green) */}
        <button
          type="button"
          onClick={onStartOrNext}
          className="h-full w-full flex flex-col items-center justify-center p-1 sm:p-2 rounded-[8px] bg-[#24c36a] hover:bg-[#20b360] active:bg-[#1da356] text-white shadow-sm transition-all active:scale-[0.99] cursor-pointer"
          title={isConnected ? 'Skip to next stranger' : 'Start random video chat'}
        >
          {isConnected ? (
            <SkipForward className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 fill-current stroke-none" />
          ) : isSearching || isConnecting ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 animate-spin" />
          ) : (
            <Play className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 fill-current stroke-none" />
          )}
          <span className="text-xs sm:text-sm md:text-base lg:text-lg font-black uppercase tracking-wider text-center leading-tight">
            {getStartNextLabel()}
          </span>
        </button>

        {/* 2. Stop (Coral / Orange) */}
        <button
          type="button"
          onClick={onStop}
          disabled={isIdle}
          className={`h-full w-full flex flex-col items-center justify-center p-1 sm:p-2 rounded-[8px] font-black uppercase tracking-wider text-center shadow-sm transition-all active:scale-[0.99] cursor-pointer ${
            isIdle
              ? 'bg-[#ff9587] text-white/70 cursor-not-allowed opacity-60'
              : 'bg-[#ff6f61] hover:bg-[#f55f51] active:bg-[#e65345] text-white'
          }`}
          title="Stop chatting"
        >
          <Square className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 sm:mb-1 fill-current stroke-none" />
          <span className="text-xs sm:text-sm md:text-base lg:text-lg leading-tight">STOP</span>
        </button>

        {/* 3. Country (Very Light Gray) */}
        <button
          type="button"
          onClick={onOpenCountryModal}
          className="h-full w-full flex flex-col items-center justify-center p-1 sm:p-2 rounded-[8px] bg-[#f1f3f5] hover:bg-[#e9ecef] active:bg-[#dee2e6] text-[#2d3436] border border-[#e2e8f0] shadow-sm transition-all active:scale-[0.99] cursor-pointer"
          title="Choose country preference"
        >
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">
            Country
          </span>
          <span className="text-lg sm:text-2xl lg:text-3xl leading-none my-0.5">
            {selectedCountry.flag}
          </span>
          <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-slate-800 truncate max-w-full px-1">
            {selectedCountry.name.split(' ')[0]}
          </span>
        </button>

        {/* 4. Gender (Very Light Gray) */}
        <button
          type="button"
          onClick={onOpenGenderModal}
          className="h-full w-full flex flex-col items-center justify-center p-1 sm:p-2 rounded-[8px] bg-[#f1f3f5] hover:bg-[#e9ecef] active:bg-[#dee2e6] text-[#2d3436] border border-[#e2e8f0] shadow-sm transition-all active:scale-[0.99] cursor-pointer"
          title="Choose gender preference"
        >
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1">
            Gender
          </span>
          <span className="text-lg sm:text-2xl lg:text-3xl leading-none my-0.5">
            {getGenderIcon(selectedGender)}
          </span>
          <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-slate-800 truncate max-w-full px-1">
            {getGenderLabel(selectedGender)}
          </span>
        </button>
      </div>

      {/* 
        ============================================================
        BOTTOM-RIGHT SECTION: Connection Status & Text Chat Panel
        Takes 50% of the total screen width on desktop.
        Splits vertically into:
          - TOP: Compact connection status box
          - MIDDLE: Scrollable chat messages
          - BOTTOM: Full-width anchored text message input
        ============================================================
      */}
      <div className="flex flex-col justify-between w-full h-40 sm:h-44 lg:h-full bg-white rounded-[8px] border border-slate-200 p-2 sm:p-2.5 overflow-hidden shadow-sm">
        {/* TOP AREA: Compact Connection Status Box */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 shrink-0 select-none text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            {isConnected ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-bold text-slate-800 truncate">Connection established</span>
                {partnerCountry && (
                  <span className="text-slate-600 text-xs truncate flex items-center gap-1 font-medium">
                    <span className="text-slate-400">•</span>
                    {partnerFlag && <span>{partnerFlag}</span>}
                    <span className="font-semibold text-slate-700">{partnerCountry}</span>
                  </span>
                )}
              </>
            ) : isSearching ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                <span className="font-semibold text-slate-700">Looking for a stranger...</span>
              </>
            ) : isConnecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
                <span className="font-semibold text-slate-700">Connecting...</span>
              </>
            ) : state === 'DISCONNECTED' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                <span className="font-semibold text-slate-600">Stranger disconnected</span>
              </>
            ) : state === 'ERROR' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="font-semibold text-rose-600">Connection failed</span>
              </>
            ) : (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 shrink-0" />
                <span className="font-semibold text-slate-500">Press Start to begin</span>
              </>
            )}
          </div>

          {/* Report abuse link when in call or disconnected */}
          {(isConnected || state === 'DISCONNECTED') && onOpenReportModal && (
            <button
              type="button"
              onClick={onOpenReportModal}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 underline shrink-0 cursor-pointer"
              title="Report inappropriate content or abuse"
            >
              Report abuse
            </button>
          )}
        </div>

        {/* MIDDLE AREA: WhatsApp-style Scrollable Chat Messages */}
        <div
          ref={chatScrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0 py-1.5 px-1 sm:px-1.5 space-y-2 bg-[#f8fafc]/60 rounded-[6px] my-1"
        >
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-[11px] sm:text-xs italic select-none">
              {isConnected ? 'Say hello to your partner!' : 'Chat will be active once connected.'}
            </div>
          ) : (
            <>
              {chatMessages.map((msg) => {
                const isSelf = msg.sender === 'self';
                return (
                  <div
                    key={msg.id}
                    className={`flex w-full ${isSelf ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative max-w-[85%] sm:max-w-[78%] px-2.5 py-1.5 shadow-xs text-xs leading-relaxed select-text ${
                        isSelf
                          ? 'bg-[#d9fdd3] text-slate-900 border border-[#bbf7d0]/60 rounded-2xl rounded-tr-xs'
                          : 'bg-white text-slate-900 border border-slate-200/90 rounded-2xl rounded-tl-xs'
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="break-words whitespace-pre-wrap flex-1">{msg.text}</span>
                        <span
                          className={`text-[9px] sm:text-[10px] shrink-0 select-none ml-auto font-normal ${
                            isSelf ? 'text-emerald-800/60' : 'text-slate-400'
                          }`}
                        >
                          {formatMessageTime(msg.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {state === 'DISCONNECTED' && (
                <div className="flex justify-center my-1 select-none">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 shadow-xs">
                    Stranger disconnected
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* BOTTOM AREA: WhatsApp-style Anchored Text Input */}
        <form
          onSubmit={handleSubmit}
          className="w-full flex items-center gap-1.5 mt-auto pt-1.5 border-t border-slate-100"
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            maxLength={500}
            placeholder="Write a message..."
            className="flex-1 resize-none py-1.5 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-[8px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1.5 focus:ring-[#24c36a] focus:bg-white disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed leading-snug max-h-16"
          />
          <button
            type="submit"
            disabled={!isConnected || !inputText.trim() || isSubmitting}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-[8px] bg-[#24c36a] hover:bg-[#20b360] active:scale-95 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs"
            title="Send message (Enter)"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
