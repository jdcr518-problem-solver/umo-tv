/**
 * UMO TV - Shared Domain Types and Communication Protocols
 * Shared across React client and Cloudflare Workers / Durable Objects
 */

export type MatchmakingState =
  | 'IDLE'
  | 'PERMISSION_CHECK'
  | 'PREPARING_MEDIA'
  | 'QUEUED'
  | 'MATCHING'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'REPORTED'
  | 'RATE_LIMITED'
  | 'ERROR';

export interface GuestSession {
  sessionId: string;
  token: string;
  issuedAt: number;
  expiresAt: number;
  ageVerified: boolean;
  country?: string;
  countryCode?: string;
}

export type FilterId = 'none' | 'dog-face' | 'sunglasses';

export interface FilterDefinition {
  id: FilterId;
  name: string;
  description: string;
  icon: string;
  isPremium: boolean; // Architecture readiness for future premium tier
  requiresAdUnlock: boolean; // Architecture readiness for future ad module
}

export type ReportReason =
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'UNDERAGE'
  | 'SPAM'
  | 'OTHER';

export interface ReportPayload {
  reportedSessionId: string;
  reason: ReportReason;
  notes?: string;
  timestamp: number;
}

export interface BlockPayload {
  blockedSessionId: string;
  timestamp: number;
}

/* WebSocket Signaling Protocol */
export type SignalingMessageType =
  | 'QUEUE_JOIN'
  | 'QUEUE_LEAVE'
  | 'MATCH_FOUND'
  | 'OFFER'
  | 'ANSWER'
  | 'ICE_CANDIDATE'
  | 'NEXT'
  | 'STOP'
  | 'PEER_LEFT'
  | 'CHAT_MESSAGE'
  | 'HEARTBEAT'
  | 'ERROR';

export interface BaseSignalMessage {
  type: SignalingMessageType;
  sessionId: string;
  token?: string;
  timestamp: number;
}

export interface QueueJoinMessage extends BaseSignalMessage {
  type: 'QUEUE_JOIN';
  token: string;
  excludePeerId?: string;
  country?: string;
  countryCode?: string;
  genderPreference?: 'all' | 'female' | 'male';
}

export interface QueueLeaveMessage extends BaseSignalMessage {
  type: 'QUEUE_LEAVE';
}

export interface SerializedIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SerializedSessionDescription {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';
  sdp?: string;
}

export interface SerializedIceCandidate {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface MatchFoundMessage extends BaseSignalMessage {
  type: 'MATCH_FOUND';
  roomId: string;
  peerSessionId: string;
  peerCountry?: string;
  peerCountryCode?: string;
  isInitiator: boolean;
  iceServers: SerializedIceServer[];
}

export interface SdpSignalMessage extends BaseSignalMessage {
  type: 'OFFER' | 'ANSWER';
  roomId: string;
  sdp: SerializedSessionDescription;
}

export interface IceCandidateSignalMessage extends BaseSignalMessage {
  type: 'ICE_CANDIDATE';
  roomId: string;
  candidate: SerializedIceCandidate;
}

export interface NextSignalMessage extends BaseSignalMessage {
  type: 'NEXT';
  roomId?: string;
}

export interface StopSignalMessage extends BaseSignalMessage {
  type: 'STOP';
  roomId?: string;
}

export interface PeerLeftMessage extends BaseSignalMessage {
  type: 'PEER_LEFT';
  roomId: string;
  reason?: 'skipped' | 'disconnected' | 'blocked';
}

export interface ChatPayload {
  messageId: string;
  roomId: string;
  senderSessionId: string;
  text: string;
  timestamp: number;
}

export interface ChatSignalMessage extends BaseSignalMessage {
  type: 'CHAT_MESSAGE';
  roomId: string;
  messageId: string;
  text: string;
}

export interface HeartbeatMessage extends BaseSignalMessage {
  type: 'HEARTBEAT';
}

export interface ErrorSignalMessage extends BaseSignalMessage {
  type: 'ERROR';
  code: 'RATE_LIMITED' | 'SESSION_EXPIRED' | 'MATCHMAKER_TIMEOUT' | 'INVALID_PAYLOAD' | 'PEER_ERROR';
  message: string;
}

export type SignalingMessage =
  | QueueJoinMessage
  | QueueLeaveMessage
  | MatchFoundMessage
  | SdpSignalMessage
  | IceCandidateSignalMessage
  | NextSignalMessage
  | StopSignalMessage
  | PeerLeftMessage
  | ChatSignalMessage
  | HeartbeatMessage
  | ErrorSignalMessage;
