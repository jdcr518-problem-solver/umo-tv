import type {
  SerializedIceServer,
  SerializedSessionDescription,
  SerializedIceCandidate,
} from '@shared/types.js';

export interface WebRTCTransportCallbacks {
  onRemoteTrack: (track: MediaStreamTrack, streams: readonly MediaStream[]) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onIceCandidate: (candidate: SerializedIceCandidate) => void;
  onChatMessage?: (message: string) => void;
  onConnectionTimeout?: () => void;
  onError?: (error: Error) => void;
}

export interface WebRTCTransportOptions {
  connectionTimeoutMs?: number;
}

/**
 * WebRTC P2P Transport Layer
 * Manages RTCPeerConnection, ICE gathering, candidate buffering,
 * SDP negotiation, configurable connection timeouts, and track lifecycle.
 */
export class WebRTCTransport {
  private peerConnection: RTCPeerConnection | null = null;
  private videoSender: RTCRtpSender | null = null;
  private audioSender: RTCRtpSender | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private callbacks: WebRTCTransportCallbacks;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionTimeoutMs: number;

  // Candidate buffering to avoid InvalidStateError when candidates arrive before remote description
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;

  constructor(callbacks: WebRTCTransportCallbacks, options: WebRTCTransportOptions = {}) {
    this.callbacks = callbacks;
    this.connectionTimeoutMs = options.connectionTimeoutMs || 15000;
  }

  getAudioSender(): RTCRtpSender | null {
    return this.audioSender;
  }

  getVideoSender(): RTCRtpSender | null {
    return this.videoSender;
  }

  initialize(iceServers: SerializedIceServer[] = []): void {
    this.close();

    const formattedServers: RTCIceServer[] =
      iceServers.length > 0
        ? (iceServers as RTCIceServer[])
        : [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

    this.peerConnection = new RTCPeerConnection({
      iceServers: formattedServers,
      iceCandidatePoolSize: 2,
    });

    this.hasRemoteDescription = false;
    this.pendingRemoteCandidates = [];

    // Start configurable connection timeout
    this.startConnectionTimeout();

    this.peerConnection.ontrack = (event) => {
      this.callbacks.onRemoteTrack(event.track, event.streams);
    };

    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.connectionState;

      if (state === 'connected') {
        this.clearConnectionTimeout();
      } else if (state === 'failed') {
        this.clearConnectionTimeout();
        if (this.callbacks.onError) {
          this.callbacks.onError(new Error('WebRTC connection failed (NAT traversal or network issue)'));
        }
      }

      this.callbacks.onConnectionStateChange(state);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate({
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          usernameFragment: event.candidate.usernameFragment,
        });
      }
    };

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannel();
    };
  }

  private startConnectionTimeout(): void {
    this.clearConnectionTimeout();
    this.timeoutTimer = setTimeout(() => {
      if (this.peerConnection && this.peerConnection.connectionState !== 'connected') {
        console.warn(`[WebRTCTransport] Connection timeout after ${this.connectionTimeoutMs}ms`);
        if (this.callbacks.onConnectionTimeout) {
          this.callbacks.onConnectionTimeout();
        }
      }
    }, this.connectionTimeoutMs);
  }

  private clearConnectionTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  attachMediaTracks(stream: MediaStream): void {
    if (!this.peerConnection) return;

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];

    if (audioTrack) {
      this.audioSender = this.peerConnection.addTrack(audioTrack, stream);
    }
    if (videoTrack) {
      this.videoSender = this.peerConnection.addTrack(videoTrack, stream);
    }
  }

  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (this.videoSender) {
      await this.videoSender.replaceTrack(newTrack);
    }
  }

  createDataChannel(channelName = 'umo-chat'): void {
    if (!this.peerConnection) return;
    try {
      this.dataChannel = this.peerConnection.createDataChannel(channelName, {
        ordered: true,
      });
      this.setupDataChannel();
    } catch (err) {
      console.warn('[WebRTCTransport] DataChannel creation error', err);
    }
  }

  private setupDataChannel(): void {
    if (!this.dataChannel) return;
    this.dataChannel.onmessage = (event) => {
      if (this.callbacks.onChatMessage) {
        this.callbacks.onChatMessage(event.data as string);
      }
    };
  }

  sendChatMessage(message: string): boolean {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(message);
      return true;
    }
    return false;
  }

  async createOffer(): Promise<SerializedSessionDescription> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return {
      type: offer.type,
      sdp: offer.sdp,
    };
  }

  async createAnswer(): Promise<SerializedSessionDescription> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return {
      type: answer.type,
      sdp: answer.sdp,
    };
  }

  async setRemoteDescription(desc: SerializedSessionDescription): Promise<void> {
    if (!this.peerConnection) throw new Error('PeerConnection not initialized');
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({
        type: desc.type,
        sdp: desc.sdp,
      })
    );
    this.hasRemoteDescription = true;

    // Drain and apply buffered ICE candidates
    await this.drainPendingCandidates();
  }

  async addIceCandidate(candidate: SerializedIceCandidate): Promise<void> {
    const candidateInit: RTCIceCandidateInit = {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      usernameFragment: candidate.usernameFragment,
    };

    if (!this.peerConnection || !this.hasRemoteDescription) {
      // Buffer until remote description is set
      this.pendingRemoteCandidates.push(candidateInit);
      return;
    }

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
    } catch (err) {
      console.warn('[WebRTCTransport] Error adding ICE candidate', err);
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.peerConnection || !this.hasRemoteDescription) return;

    while (this.pendingRemoteCandidates.length > 0) {
      const candidateInit = this.pendingRemoteCandidates.shift()!;
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
      } catch (err) {
        console.warn('[WebRTCTransport] Error draining buffered candidate', err);
      }
    }
  }

  close(): void {
    this.clearConnectionTimeout();
    this.pendingRemoteCandidates = [];
    this.hasRemoteDescription = false;

    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch {
        // ignore
      }
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch {
        // ignore
      }
      this.peerConnection = null;
    }

    this.videoSender = null;
    this.audioSender = null;
  }
}
