import { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header.js';
import { VideoStage } from './components/VideoStage.js';
import { BottomSection } from './components/BottomSection.js';
import { FilterDrawer } from './components/FilterDrawer.js';
import { ReportModal } from './components/ReportModal.js';
import { AgeGateModal } from './components/AgeGateModal.js';
import { cameraManager } from './modules/camera/cameraManager.js';
import { filterManager } from './modules/ar-filter/filterManager.js';
import { matchmakingMachine } from './modules/matchmaking/matchmakingMachine.js';
import { safetyService } from './modules/safety/safetyService.js';
import { WebRTCTransport } from './modules/webrtc/webrtcTransport.js';
import { SignalingClient, buildWebSocketUrl } from './modules/signaling/signalingClient.js';
import { CountrySelectModal } from './components/CountrySelectModal.js';
import { GenderSelectModal } from './components/GenderSelectModal.js';
import {
  COUNTRIES,
  type CountryOption,
  type GenderPreference,
  type ChatMessageItem,
} from './lib/constants.js';
import type {
  MatchmakingState,
  FilterId,
  ReportReason,
  GuestSession,
  MatchFoundMessage,
  SdpSignalMessage,
  IceCandidateSignalMessage,
  ChatSignalMessage,
  ChatPayload,
  ErrorSignalMessage,
} from '@shared/types.js';

export function App() {
  const [matchState, setMatchState] = useState<MatchmakingState>('IDLE');
  const [guestId, setGuestId] = useState<string>('');
  const [remotePeerId, setRemotePeerId] = useState<string>('');
  const [_currentRoomId, setCurrentRoomId] = useState<string>('');
  const [partnerCountry, setPartnerCountry] = useState<string>('');

  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [selectedGender, setSelectedGender] = useState<GenderPreference>('all');
  const [isCountryModalOpen, setIsCountryModalOpen] = useState<boolean>(false);
  const [isGenderModalOpen, setIsGenderModalOpen] = useState<boolean>(false);

  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(() => safetyService.isAgeAcknowledged());
  const [isAgeModalOpen, setIsAgeModalOpen] = useState<boolean>(() => !safetyService.isAgeAcknowledged());
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<FilterId>('none');
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Connection and Session references
  const sessionRef = useRef<GuestSession | null>(null);
  const matchmakerClientRef = useRef<SignalingClient | null>(null);
  const roomClientRef = useRef<SignalingClient | null>(null);
  const webrtcRef = useRef<WebRTCTransport | null>(null);
  const lastPeerSessionIdRef = useRef<string | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);
  const isInitiatorRef = useRef<boolean>(false);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  // Centralized, idempotent incoming message handler (WebRTC DataChannel + RoomDO WebSocket fallback)
  const handleIncomingChatMessage = useCallback((payload: ChatPayload) => {
    // 1. Discard if message is from an old, stale, or mismatched room
    if (!currentRoomIdRef.current || (payload.roomId && payload.roomId !== currentRoomIdRef.current)) {
      console.log('[Chat] Discarded message from mismatched room:', payload.roomId);
      return;
    }

    // 2. Discard self-echo
    if (sessionRef.current && payload.senderSessionId === sessionRef.current.sessionId) {
      return;
    }

    // 3. Deduplicate by messageId
    if (seenMessageIdsRef.current.has(payload.messageId)) {
      console.log('[Chat] Deduplicated message already seen:', payload.messageId);
      return;
    }

    // 4. Record as seen
    seenMessageIdsRef.current.add(payload.messageId);

    // 5. Append new message to chat state
    const newMsg: ChatMessageItem = {
      id: payload.messageId,
      roomId: payload.roomId,
      sender: 'peer',
      senderSessionId: payload.senderSessionId,
      text: payload.text,
      timestamp: payload.timestamp || Date.now(),
      deliveryStatus: 'delivered',
    };

    setChatMessages((prev) => {
      if (prev.some((m) => m.id === payload.messageId)) {
        return prev;
      }
      return [...prev, newMsg];
    });
  }, []);

  // Teardown WebRTC and Room signaling connection
  const cleanupCall = useCallback((notifyRoom = false, reason: 'skipped' | 'stopped' = 'stopped') => {
    if (notifyRoom && roomClientRef.current && roomClientRef.current.isConnected()) {
      try {
        roomClientRef.current.send({
          type: reason === 'skipped' ? 'NEXT' : 'STOP',
          roomId: currentRoomIdRef.current || undefined,
          sessionId: sessionRef.current?.sessionId || 'unknown',
          timestamp: Date.now(),
        });
      } catch {
        // ignore
      }
    }

    if (webrtcRef.current) {
      webrtcRef.current.close();
      webrtcRef.current = null;
    }

    if (roomClientRef.current) {
      roomClientRef.current.disconnect();
      roomClientRef.current = null;
    }

    currentRoomIdRef.current = null;
    setCurrentRoomId('');
    setRemotePeerId('');
    setPartnerCountry('');
    seenMessageIdsRef.current.clear();
    setChatMessages([]);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, []);

  // Handle incoming match found from MatchmakerDO
  const handleMatchFound = useCallback(async (message: MatchFoundMessage) => {
    matchmakingMachine.transitionTo('MATCHING');
    lastPeerSessionIdRef.current = message.peerSessionId;
    currentRoomIdRef.current = message.roomId;
    setCurrentRoomId(message.roomId);
    isInitiatorRef.current = message.isInitiator;
    setRemotePeerId(message.peerSessionId);
    setPartnerCountry(message.peerCountry || '');
    seenMessageIdsRef.current.clear();
    setChatMessages([]);

    const session = sessionRef.current;
    if (!session) return;

    // 1. Initialize WebRTC Transport
    const webrtc = new WebRTCTransport(
      {
        onRemoteTrack: (_track, streams) => {
          if (remoteVideoRef.current) {
            if (streams && streams[0]) {
              remoteVideoRef.current.srcObject = streams[0];
            }
          }
        },
        onConnectionStateChange: (state) => {
          if (state === 'connected') {
            matchmakingMachine.transitionTo('CONNECTED');
            showNotification('Connected with stranger!');
          } else if (state === 'disconnected') {
            matchmakingMachine.transitionTo('DISCONNECTED');
            showNotification('Stranger disconnected.');
          } else if (state === 'failed') {
            matchmakingMachine.transitionTo('ERROR');
            showNotification('WebRTC connection failed (NAT traversal or network issue).');
          }
        },
        onIceCandidate: (candidate) => {
          if (roomClientRef.current && roomClientRef.current.isConnected()) {
            roomClientRef.current.send({
              type: 'ICE_CANDIDATE',
              roomId: message.roomId,
              sessionId: session.sessionId,
              candidate,
              timestamp: Date.now(),
            });
          }
        },
        onChatMessage: handleIncomingChatMessage,
        onConnectionTimeout: () => {
          matchmakingMachine.transitionTo('ERROR');
          showNotification('Direct connection timed out. Click Next to try another stranger.');
        },
        onError: (err) => {
          console.error('[WebRTC Error]', err);
          matchmakingMachine.transitionTo('ERROR');
        },
      },
      { connectionTimeoutMs: 15000 }
    );

    webrtc.initialize(message.iceServers);
    webrtcRef.current = webrtc;

    // Attach local camera & microphone tracks (use filtered track if a filter is active)
    const localStream = cameraManager.getRawStream();
    if (localStream) {
      const activeVideoTrack =
        filterManager.getActiveFilter() !== 'none'
          ? filterManager.getActiveVideoTrack() || localStream.getVideoTracks()[0]
          : localStream.getVideoTracks()[0];
      webrtc.attachMediaTracks(localStream, activeVideoTrack);
    }

    // 2. Connect to RoomDO for signaling and control channel
    const roomUrl = buildWebSocketUrl(
      `/ws/room/${message.roomId}?sessionId=${session.sessionId}&token=${session.token}`
    );

    const roomClient = new SignalingClient({
      onOpen: async () => {
        matchmakingMachine.transitionTo('CONNECTING');

        // Initiator creates DataChannel and sends initial SDP offer
        if (message.isInitiator) {
          try {
            webrtc.createDataChannel('umo-chat');
            const offer = await webrtc.createOffer();
            roomClient.send({
              type: 'OFFER',
              roomId: message.roomId,
              sessionId: session.sessionId,
              sdp: offer,
              timestamp: Date.now(),
            });
          } catch (err) {
            console.error('[WebRTC] Failed to create offer:', err);
            matchmakingMachine.transitionTo('ERROR');
          }
        }
      },
      onMessage: async (signal) => {
        if (signal.type === 'OFFER') {
          const offerMsg = signal as SdpSignalMessage;
          try {
            await webrtc.setRemoteDescription(offerMsg.sdp);
            const answer = await webrtc.createAnswer();
            roomClient.send({
              type: 'ANSWER',
              roomId: message.roomId,
              sessionId: session.sessionId,
              sdp: answer,
              timestamp: Date.now(),
            });
          } catch (err) {
            console.error('[WebRTC] Error handling offer:', err);
          }
        } else if (signal.type === 'ANSWER') {
          const answerMsg = signal as SdpSignalMessage;
          try {
            await webrtc.setRemoteDescription(answerMsg.sdp);
          } catch (err) {
            console.error('[WebRTC] Error handling answer:', err);
          }
        } else if (signal.type === 'ICE_CANDIDATE') {
          const iceMsg = signal as IceCandidateSignalMessage;
          try {
            await webrtc.addIceCandidate(iceMsg.candidate);
          } catch (err) {
            console.warn('[WebRTC] Error adding ICE candidate:', err);
          }
        } else if (signal.type === 'CHAT_MESSAGE') {
          const chatMsg = signal as ChatSignalMessage;
          handleIncomingChatMessage({
            messageId: chatMsg.messageId,
            roomId: chatMsg.roomId,
            senderSessionId: chatMsg.sessionId,
            text: chatMsg.text,
            timestamp: chatMsg.timestamp,
          });
        } else if (signal.type === 'PEER_LEFT') {
          showNotification('Stranger disconnected.');
          cleanupCall(false);
          matchmakingMachine.transitionTo('DISCONNECTED');
        }
      },
      onClose: () => {
        // Room control channel closed
      },
      onError: (err) => {
        console.warn('[RoomClient] WebSocket error', err);
      },
    });

    roomClientRef.current = roomClient;
    await roomClient.connect(roomUrl);
  }, [cleanupCall, showNotification, handleIncomingChatMessage]);

  // Connect to MatchmakerDO queue
  const startMatchmaking = useCallback(async (excludePeerId?: string) => {
    let session = sessionRef.current;
    if (!session) {
      session = await safetyService.acquireSession();
      sessionRef.current = session;
      setGuestId(session.sessionId);
    }

    matchmakingMachine.transitionTo('QUEUED');

    // If Matchmaker client is already open, send QUEUE_JOIN directly
    if (matchmakerClientRef.current && matchmakerClientRef.current.isConnected()) {
      matchmakerClientRef.current.send({
        type: 'QUEUE_JOIN',
        sessionId: session.sessionId,
        token: session.token,
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        genderPreference: selectedGender,
        excludePeerId,
        timestamp: Date.now(),
      });
      return;
    }

    // Connect to Matchmaker DO WebSocket endpoint
    const matchmakerUrl = buildWebSocketUrl('/ws/match');
    const matchmakerClient = new SignalingClient({
      onOpen: () => {
        matchmakerClient.send({
          type: 'QUEUE_JOIN',
          sessionId: session!.sessionId,
          token: session!.token,
          country: selectedCountry.name,
          countryCode: selectedCountry.code,
          genderPreference: selectedGender,
          excludePeerId,
          timestamp: Date.now(),
        });
      },
      onMessage: (msg) => {
        if (msg.type === 'MATCH_FOUND') {
          handleMatchFound(msg as MatchFoundMessage);
        } else if (msg.type === 'ERROR') {
          const errorMsg = msg as ErrorSignalMessage;
          showNotification(`Matchmaker error: ${errorMsg.message}`);
          if (errorMsg.code === 'RATE_LIMITED') {
            matchmakingMachine.transitionTo('RATE_LIMITED');
          } else {
            matchmakingMachine.transitionTo('ERROR');
          }
        }
      },
      onClose: () => {
        // Reconnection or close handled cleanly
      },
      onError: (err) => {
        console.error('[MatchmakerClient] WebSocket error:', err);
        matchmakingMachine.transitionTo('ERROR');
      },
    });

    matchmakerClientRef.current = matchmakerClient;
    try {
      await matchmakerClient.connect(matchmakerUrl);
    } catch {
      matchmakingMachine.transitionTo('ERROR');
      showNotification('Failed to connect to matchmaking server.');
    }
  }, [handleMatchFound, showNotification, selectedCountry.name, selectedCountry.code, selectedGender]);

  // Initialize session and sync state machine
  useEffect(() => {
    safetyService.acquireSession().then((session) => {
      sessionRef.current = session;
      setGuestId(session.sessionId);
    });

    filterManager.setNotificationHandler((msg) => {
      showNotification(msg);
    });

    const unsubscribe = matchmakingMachine.subscribe((newState) => {
      setMatchState(newState);
    });

    const statsInterval = setInterval(async () => {
      if (webrtcRef.current) {
        const stats = await webrtcRef.current.getStatsReport();
        const filterDiag = filterManager.getDiagnostics();
        if (filterDiag.activeFilter !== 'none') {
          console.log('[UMO-Call-Diagnostics]', {
            filter: filterDiag.activeFilter,
            visibility: filterDiag.visibilityState,
            fpsRendered: filterDiag.canvasFps,
            detectionsPerSec: filterDiag.detectionsPerSec,
            framesEncoded: stats.framesEncoded,
            framesDecoded: stats.framesDecoded,
          });
        }
      }
    }, 3000);

    const handleBeforeUnload = () => {
      cleanupCall(true, 'stopped');
      if (matchmakerClientRef.current) {
        matchmakerClientRef.current.disconnect();
      }
      filterManager.destroy();
      cameraManager.stopAllTracks();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(statsInterval);
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupCall(true, 'stopped');
      if (matchmakerClientRef.current) {
        matchmakerClientRef.current.disconnect();
      }
      filterManager.destroy();
      cameraManager.stopAllTracks();
    };
  }, [cleanupCall, showNotification]);

  const handleAgeConfirm = () => {
    safetyService.setAgeAcknowledged(true);
    setIsAgeVerified(true);
    setIsAgeModalOpen(false);
  };

  // Start Chat Action
  const handleStartChat = async () => {
    if (!isAgeVerified) {
      setIsAgeModalOpen(true);
      return;
    }

    try {
      let stream = cameraManager.getRawStream();
      if (!stream) {
        matchmakingMachine.transitionTo('PREPARING_MEDIA');
        showNotification('Requesting camera & microphone access...');
        stream = await cameraManager.requestMedia();
        if (activeFilter !== 'none') {
          const filterRes = await filterManager.setFilter(activeFilter, stream);
          if (localVideoRef.current && filterRes.filteredStream) {
            localVideoRef.current.srcObject = filterRes.filteredStream;
          }
        } else if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      }

      await startMatchmaking();
    } catch (err) {
      console.error('Failed to initialize media stream', err);
      matchmakingMachine.transitionTo('ERROR');
      showNotification('Camera or microphone permission was denied.');
    }
  };

  // Next Chat Action
  const handleNextChat = async () => {
    if (matchState === 'IDLE') {
      await handleStartChat();
      return;
    }
    cleanupCall(true, 'skipped');
    showNotification('Skipping to next stranger...');
    await startMatchmaking(lastPeerSessionIdRef.current || undefined);
  };

  // Stop Chat Action
  const handleStopChat = () => {
    cleanupCall(true, 'stopped');

    if (matchmakerClientRef.current && matchmakerClientRef.current.isConnected()) {
      if (sessionRef.current) {
        matchmakerClientRef.current.send({
          type: 'QUEUE_LEAVE',
          sessionId: sessionRef.current.sessionId,
          timestamp: Date.now(),
        });
      }
      matchmakerClientRef.current.disconnect();
      matchmakerClientRef.current = null;
    }

    matchmakingMachine.reset();
    showNotification('Chat stopped. Session is idle.');
  };

  // Device Toggles
  const handleToggleMic = () => {
    const muted = cameraManager.toggleAudio();
    setIsMuted(muted);
    showNotification(muted ? 'Microphone muted' : 'Microphone active');
  };

  const handleToggleCamera = () => {
    const enabled = cameraManager.toggleVideo();
    setIsCameraOn(enabled);
    showNotification(enabled ? 'Camera enabled' : 'Camera disabled');
  };

  // Filter Selection
  const handleSelectFilter = async (filterId: FilterId) => {
    setActiveFilter(filterId);

    // Request camera media if not yet acquired and user chose an AR filter
    let rawStream = cameraManager.getRawStream();
    if (!rawStream && filterId !== 'none') {
      try {
        rawStream = await cameraManager.requestMedia();
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = rawStream;
        }
      } catch (err) {
        console.error('Failed to access camera for filter:', err);
        showNotification('Camera access required for AR face filters.');
        setActiveFilter('none');
        return;
      }
    }

    try {
      const result = await filterManager.setFilter(filterId, rawStream);

      // 1. Update local video preview (filtered canvas stream or raw camera)
      if (localVideoRef.current && result.filteredStream) {
        localVideoRef.current.srcObject = result.filteredStream;
      }

      // 2. Seamlessly update remote stranger's video track without renegotiation
      if (webrtcRef.current && result.videoTrack && result.changedTrack) {
        await webrtcRef.current.replaceVideoTrack(result.videoTrack);
      }

      const label =
        filterId === 'dog-face'
          ? 'Dog Ears & Nose'
          : filterId === 'sunglasses'
          ? 'Neon Sunglasses'
          : 'Normal Camera';
      showNotification(`Active Filter: ${label}`);
    } catch (err) {
      console.error('Failed to apply face filter:', err);
      showNotification('Filter error. Reverting to normal camera.');
      setActiveFilter('none');
    }
  };

  // Authoritative Chat Message Send: Primary (WebRTC DataChannel) + Fallback (RoomDO WebSocket)
  const handleSendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    const currentRoomId = currentRoomIdRef.current;
    const session = sessionRef.current;

    // Reject empty messages or messages without active call/session
    if (!trimmed || !currentRoomId || !session) return;

    // Enforce message length limit (500 chars)
    const boundedText = trimmed.slice(0, 500);
    const messageId = crypto.randomUUID();
    const now = Date.now();

    const payload: ChatPayload = {
      messageId,
      roomId: currentRoomId,
      senderSessionId: session.sessionId,
      text: boundedText,
      timestamp: now,
    };

    // 1. Mark in seen set so echoes or retransmissions are ignored
    seenMessageIdsRef.current.add(messageId);

    // 2. Optimistic local UI state update
    const newMsg: ChatMessageItem = {
      id: messageId,
      roomId: currentRoomId,
      sender: 'self',
      senderSessionId: session.sessionId,
      text: boundedText,
      timestamp: now,
      deliveryStatus: 'sent',
    };
    setChatMessages((prev) => [...prev, newMsg]);

    // 3. Primary transport: WebRTC DataChannel
    let deliveredViaDataChannel = false;
    if (webrtcRef.current) {
      deliveredViaDataChannel = webrtcRef.current.sendChatMessage(payload);
    }

    // 4. Fallback transport: RoomDO WebSocket (only if DataChannel not yet open or failed)
    if (!deliveredViaDataChannel && roomClientRef.current && roomClientRef.current.isConnected()) {
      roomClientRef.current.send({
        type: 'CHAT_MESSAGE',
        roomId: currentRoomId,
        messageId,
        sessionId: session.sessionId,
        text: boundedText,
        timestamp: now,
      });
    }
  }, []);

  // Report & Block
  const handleReportAndBlock = async (reason: ReportReason, notes?: string) => {
    const targetPeer = lastPeerSessionIdRef.current || remotePeerId;
    if (targetPeer) {
      await safetyService.reportPeer(targetPeer, reason, notes);
      await safetyService.blockPeer(targetPeer);
    }
    showNotification('User reported and permanently blocked.');
    await handleNextChat();
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Top Navigation */}
      <Header
        state={matchState}
        guestId={guestId}
        isAgeVerified={isAgeVerified}
        onOpenRules={() => setIsAgeModalOpen(true)}
      />

      {/* Main Video Stage & Bottom Controls (Pixel-Accurate Two-Column Grid) */}
      <main className="flex-1 flex flex-col w-full min-h-0 p-1 sm:p-1.5 overflow-y-auto lg:overflow-hidden select-none bg-slate-950 relative">
        {notification && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-medium px-4 py-2 rounded-lg shadow-xl border border-indigo-500/40 backdrop-blur-md animate-fade-in flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            <span>{notification}</span>
          </div>
        )}

        {/* 1. Main Video Grid: 50% Left (Stranger) / 50% Right (Local) */}
        <VideoStage
          state={matchState}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          isCameraOn={isCameraOn}
          isMuted={isMuted}
          activeFilter={activeFilter}
          remotePeerSessionId={remotePeerId}
          onStartChat={handleStartChat}
          onOpenFilterDrawer={() => setIsFilterDrawerOpen(true)}
          onSelectFilter={handleSelectFilter}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onOpenReportModal={() => setIsReportModalOpen(true)}
        />

        {/* 2. Bottom Grid: 50% Left (4 Large Buttons) / 50% Right (Status + Messages + Input) */}
        <BottomSection
          state={matchState}
          selectedCountry={selectedCountry}
          selectedGender={selectedGender}
          partnerCountry={partnerCountry}
          chatMessages={chatMessages}
          onStartOrNext={handleNextChat}
          onStop={handleStopChat}
          onOpenCountryModal={() => setIsCountryModalOpen(true)}
          onOpenGenderModal={() => setIsGenderModalOpen(true)}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onSendMessage={handleSendMessage}
        />
      </main>

      {/* Modals & Drawers */}
      <CountrySelectModal
        isOpen={isCountryModalOpen}
        selectedCode={selectedCountry.code}
        onSelectCountry={(c) => {
          setSelectedCountry(c);
          showNotification(`Country: ${c.name}`);
        }}
        onClose={() => setIsCountryModalOpen(false)}
      />

      <GenderSelectModal
        isOpen={isGenderModalOpen}
        selectedGender={selectedGender}
        onSelectGender={(g) => {
          setSelectedGender(g);
          showNotification(`Gender filter: ${g}`);
        }}
        onClose={() => setIsGenderModalOpen(false)}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        activeFilter={activeFilter}
        onSelectFilter={handleSelectFilter}
        onClose={() => setIsFilterDrawerOpen(false)}
      />

      <ReportModal
        isOpen={isReportModalOpen}
        peerSessionId={remotePeerId || undefined}
        onReportAndBlock={handleReportAndBlock}
        onClose={() => setIsReportModalOpen(false)}
      />

      <AgeGateModal
        isOpen={isAgeModalOpen}
        onConfirm={handleAgeConfirm}
        onClose={() => setIsAgeModalOpen(false)}
        canDismiss={isAgeVerified}
      />
    </div>
  );
}

export default App;
