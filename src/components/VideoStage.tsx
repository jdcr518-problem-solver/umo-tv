import { useState } from 'react';
import type React from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Sparkles,
  Users,
  Compass,
  AlertCircle,
  Shield,
  Loader2,
  Flag,
  Smile,
  Dog,
  Glasses,
} from 'lucide-react';
import type { MatchmakingState, FilterId } from '@shared/types.js';

interface VideoStageProps {
  state: MatchmakingState;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraOn: boolean;
  isMuted: boolean;
  activeFilter: FilterId;
  remotePeerSessionId?: string;
  onStartChat: () => void;
  onOpenFilterDrawer: () => void;
  onSelectFilter?: (id: FilterId) => void;
  onToggleMic?: () => void;
  onToggleCamera?: () => void;
  onOpenReportModal?: () => void;
}

export const VideoStage: React.FC<VideoStageProps> = ({
  state,
  remoteVideoRef,
  localVideoRef,
  isCameraOn,
  isMuted,
  activeFilter,
  remotePeerSessionId,
  onStartChat,
  onOpenFilterDrawer,
  onSelectFilter,
  onToggleMic,
  onToggleCamera,
  onOpenReportModal,
}) => {
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);

  const getFilterLabel = (id: FilterId) => {
    switch (id) {
      case 'dog-face':
        return 'Dog Ears';
      case 'sunglasses':
        return 'Sunglasses';
      default:
        return 'No Filter';
    }
  };

  const handleSelectAndClose = (id: FilterId) => {
    onSelectFilter?.(id);
    setIsFilterPopoverOpen(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 sm:gap-1.5 w-full flex-1 min-h-0 overflow-hidden relative select-none">
      {/* Remote Peer Video Pane (Left 50% on Desktop) */}
      <div className="relative w-full h-[38vh] lg:h-full bg-slate-950 rounded-[8px] overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
        {/* Actual Video Element */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${
            state === 'CONNECTED' ? 'block' : 'hidden'
          }`}
        />

        {/* Remote Overlay / Placeholder States */}
        {state !== 'CONNECTED' && (
          <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm z-10 select-none">
            {state === 'IDLE' && (
              <>
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-400 shadow-lg shadow-emerald-950/20">
                  <Compass className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-white mb-2 tracking-tight">Ready to Chat?</h3>
                <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                  Press <span className="text-emerald-400 font-bold">START</span> below to begin random one-to-one video matching. Anonymous, free, and protected by real-time safety controls.
                </p>
                <button
                  onClick={onStartChat}
                  className="px-8 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold uppercase tracking-wider shadow-lg shadow-emerald-950/40 transition-all active:scale-95 cursor-pointer"
                >
                  Start Random Chat
                </button>
              </>
            )}

            {state === 'QUEUED' && (
              <>
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 text-amber-400">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Looking for a Stranger...</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Searching the global matchmaking queue. You will be connected as soon as a partner is available.
                </p>
              </>
            )}

            {state === 'MATCHING' && (
              <>
                <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                  <Users className="w-8 h-8 animate-bounce" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Stranger Found!</h3>
                <p className="text-xs text-slate-400 max-w-xs">
                  Assigning private room and negotiating encrypted connection...
                </p>
              </>
            )}

            {state === 'CONNECTING' && (
              <>
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Connecting Video...</h3>
                <p className="text-xs text-slate-400">
                  Establishing direct peer-to-peer WebRTC connection...
                </p>
              </>
            )}

            {state === 'DISCONNECTED' && (
              <>
                <div className="w-16 h-16 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4 text-slate-300">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Stranger Disconnected</h3>
                <p className="text-xs text-slate-400 mb-4">
                  The other user skipped to the next person or left.
                </p>
                <button
                  onClick={onStartChat}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-colors cursor-pointer"
                >
                  Find Next Stranger
                </button>
              </>
            )}

            {state === 'ERROR' && (
              <>
                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4 text-rose-400">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Connection Failed</h3>
                <p className="text-xs text-slate-400 mb-4 max-w-xs leading-relaxed">
                  WebRTC P2P direct negotiation timed out. On restrictive networks without a TURN relay, some firewall pairings cannot connect.
                </p>
                <button
                  onClick={onStartChat}
                  className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-colors cursor-pointer"
                >
                  Try Another Stranger
                </button>
              </>
            )}
          </div>
        )}

        {/* Remote Top Bar Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-900/85 backdrop-blur-md text-slate-300 border border-slate-700/60 shadow">
            Stranger
          </span>
          {state === 'CONNECTED' && remotePeerSessionId && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-slate-950/70 text-slate-400 border border-slate-800">
              #{remotePeerSessionId.slice(0, 6)}
            </span>
          )}
        </div>

        {/* Remote Top Right: Report & Block button */}
        {onOpenReportModal && (
          <div className="absolute top-3 right-3 z-20">
            <button
              onClick={onOpenReportModal}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-rose-950/50 border border-slate-700/70 hover:border-rose-500/50 text-slate-400 hover:text-rose-400 transition-colors shadow-sm cursor-pointer"
              title="Report or Block this stranger"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Remote Watermark / Safety notice */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-xl border border-slate-800">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>UMO TV Safe Guard</span>
        </div>
      </div>

      {/* Local Camera Preview Pane (Right 50% on Desktop) */}
      <div className="relative w-full h-[38vh] lg:h-full bg-slate-950 rounded-[8px] overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
        {/* Local Video Preview */}
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover scale-x-[-1] ${
            isCameraOn ? 'block' : 'hidden'
          }`}
        />

        {/* Camera Off Overlay */}
        {!isCameraOn && (
          <div className="flex flex-col items-center justify-center p-6 text-center z-10 select-none">
            <div className="w-14 h-14 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3 text-rose-400">
              <VideoOff className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Camera Turned Off</h4>
            <p className="text-xs text-slate-400 max-w-xs">
              Your video stream is currently disabled. Click the camera button to enable.
            </p>
          </div>
        )}

        {/* Local Top Bar: Label & Filter Tag & Popover */}
        <div className="absolute top-3 left-3 flex items-center gap-2 z-20">
          <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-900/85 backdrop-blur-md text-slate-300 border border-slate-700/60 shadow">
            You
          </span>

          <div className="relative">
            <button
              onClick={() => setIsFilterPopoverOpen((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                activeFilter !== 'none'
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700/60 hover:text-white hover:bg-slate-800'
              }`}
              title="Click to choose AR face filter"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{getFilterLabel(activeFilter)}</span>
            </button>

            {/* Quick Compact Popover */}
            {isFilterPopoverOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-48 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-1.5 z-30 flex flex-col gap-1 animate-fade-in">
                <button
                  onClick={() => handleSelectAndClose('none')}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                    activeFilter === 'none'
                      ? 'bg-purple-600/30 text-purple-200 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Smile className="w-3.5 h-3.5 text-slate-400" />
                  <span>No Filter</span>
                </button>

                <button
                  onClick={() => handleSelectAndClose('dog-face')}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                    activeFilter === 'dog-face'
                      ? 'bg-purple-600/30 text-purple-200 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Dog className="w-3.5 h-3.5 text-amber-400" />
                  <span>Dog Ears & Nose</span>
                </button>

                <button
                  onClick={() => handleSelectAndClose('sunglasses')}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer ${
                    activeFilter === 'sunglasses'
                      ? 'bg-purple-600/30 text-purple-200 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Glasses className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Neon Sunglasses</span>
                </button>

                <div className="border-t border-slate-800 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setIsFilterPopoverOpen(false);
                      onOpenFilterDrawer();
                    }}
                    className="w-full text-center py-1 text-[10px] text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
                  >
                    View Filter Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Local Top-Right: Quick Device Toggles (Mic & Camera) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
          {onToggleMic && (
            <button
              onClick={onToggleMic}
              className={`p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

          {onToggleCamera && (
            <button
              onClick={onToggleCamera}
              className={`p-2 rounded-xl border transition-all cursor-pointer shadow-sm ${
                !isCameraOn
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {!isCameraOn ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Compact AR Filter Dock on Local Video (Bottom Left) */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1 p-1 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 shadow-lg z-20">
          <button
            onClick={() => onSelectFilter?.('none')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
              activeFilter === 'none'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Normal raw camera stream (No Filter)"
            aria-label="No Filter"
          >
            <Smile className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">None</span>
          </button>

          <button
            onClick={() => onSelectFilter?.('dog-face')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
              activeFilter === 'dog-face'
                ? 'bg-amber-600 text-white shadow shadow-amber-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Dog Ears & Nose AR Face Filter"
            aria-label="Dog Filter"
          >
            <Dog className="w-3.5 h-3.5" />
            <span>Dog</span>
          </button>

          <button
            onClick={() => onSelectFilter?.('sunglasses')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
              activeFilter === 'sunglasses'
                ? 'bg-cyan-600 text-white shadow shadow-cyan-950/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Neon Sunglasses AR Face Filter"
            aria-label="Neon Sunglasses Filter"
          >
            <Glasses className="w-3.5 h-3.5" />
            <span>Glasses</span>
          </button>
        </div>

        {/* Stream Transformation Guarantee Tag */}
        <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-slate-950/70 px-2.5 py-1 rounded-xl border border-slate-800">
          {activeFilter !== 'none' ? 'AR Filter Stream Active' : 'P2P Stream Active'}
        </div>
      </div>
    </div>
  );
};
