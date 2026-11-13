import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types.js';
import type { SignalingMessage } from '@shared/types.js';

interface ConnectedPeer {
  sessionId: string;
  socket: WebSocket;
  connectedAt: number;
}

/**
 * RoomDO
 * Ephemeral Durable Object instance created per active chat pair.
 * Strictly limits access to the two pre-authorized peer sessions.
 * Maintains an active control channel for WebRTC signaling (SDP offer/answer, ICE candidates),
 * in-call chat, and lifecycle events (Next, Stop, Disconnect).
 */
export class RoomDO extends DurableObject<Env> {
  private peers: Map<string, ConnectedPeer> = new Map();
  private authorizedPeers: Set<string> = new Set();
  private isDestroyed = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal endpoint: Pre-authorize the two paired peer session IDs
    if (url.pathname === '/authorize' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { peers: string[] };
        if (Array.isArray(body.peers)) {
          this.authorizedPeers = new Set(body.peers);
          return Response.json({ success: true, authorized: Array.from(this.authorizedPeers) });
        }
        return Response.json({ error: 'Invalid peers payload' }, { status: 400 });
      } catch {
        return Response.json({ error: 'Failed to parse authorization body' }, { status: 400 });
      }
    }

    // WebSocket Signaling & Control Channel
    if (url.pathname === '/signal') {
      if (this.isDestroyed) {
        return new Response('Room already closed', { status: 410 });
      }

      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const sessionId = url.searchParams.get('sessionId');
      const token = url.searchParams.get('token');

      if (!sessionId || !token) {
        return new Response('Missing sessionId or token', { status: 400 });
      }

      // Verify token structure
      if (token !== `umo_gst_${sessionId}` && !token.startsWith('umo_gst_')) {
        return new Response('Invalid session token', { status: 403 });
      }

      // Enforce strict authorization: Only the two matched peers can join
      if (this.authorizedPeers.size > 0 && !this.authorizedPeers.has(sessionId)) {
        return new Response('Unauthorized peer for this room', { status: 403 });
      }

      // Prevent more than 2 concurrent connections
      if (this.peers.size >= 2 && !this.peers.has(sessionId)) {
        return new Response('Room capacity reached', { status: 409 });
      }

      const webSocketPair = new WebSocketPair();
      const [clientSocket, serverSocket] = Object.values(webSocketPair);

      serverSocket.accept();
      this.attachPeer(sessionId, serverSocket);

      return new Response(null, {
        status: 101,
        webSocket: clientSocket,
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private attachPeer(sessionId: string, socket: WebSocket): void {
    // If this session had a previous socket in this room, close it
    const existing = this.peers.get(sessionId);
    if (existing) {
      try {
        existing.socket.close(1000, 'Replaced by new connection');
      } catch {
        // ignore
      }
    }

    this.peers.set(sessionId, {
      sessionId,
      socket,
      connectedAt: Date.now(),
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data as string) as SignalingMessage;
        this.handleMessage(sessionId, message);
      } catch (err) {
        console.error('[RoomDO] Failed to parse message', err);
      }
    });

    socket.addEventListener('close', () => {
      this.handlePeerDisconnect(sessionId, 'disconnected');
    });

    socket.addEventListener('error', () => {
      this.handlePeerDisconnect(sessionId, 'disconnected');
    });
  }

  private handleMessage(senderSessionId: string, message: SignalingMessage): void {
    // Validate sender authenticity
    if (message.sessionId && message.sessionId !== senderSessionId) {
      console.warn('[RoomDO] Spoofed sessionId detected in signaling message');
      return;
    }

    switch (message.type) {
      case 'OFFER':
      case 'ANSWER':
      case 'ICE_CANDIDATE':
      case 'CHAT_MESSAGE':
        // Forward directly to counterpart peer
        this.forwardToCounterpart(senderSessionId, message);
        break;

      case 'NEXT':
        // Caller skipped to next stranger
        this.notifyRemainingPeer(senderSessionId, 'skipped');
        this.destroyRoom();
        break;

      case 'STOP':
        // Caller stopped video chat
        this.notifyRemainingPeer(senderSessionId, 'disconnected');
        this.destroyRoom();
        break;

      case 'HEARTBEAT':
        // Keep-alive acknowledgment
        break;

      default:
        console.warn(`[RoomDO] Unrecognized message type: ${message.type}`);
    }
  }

  private forwardToCounterpart(senderSessionId: string, message: SignalingMessage): void {
    for (const [peerId, peer] of this.peers.entries()) {
      if (peerId !== senderSessionId) {
        try {
          peer.socket.send(JSON.stringify(message));
        } catch (err) {
          console.warn(`[RoomDO] Failed to forward to peer ${peerId}`, err);
        }
      }
    }
  }

  private handlePeerDisconnect(sessionId: string, reason: 'skipped' | 'disconnected' | 'blocked'): void {
    if (!this.peers.has(sessionId)) return;
    this.peers.delete(sessionId);
    this.notifyRemainingPeer(sessionId, reason);

    if (this.peers.size === 0) {
      this.destroyRoom();
    }
  }

  private notifyRemainingPeer(leavingSessionId: string, reason: 'skipped' | 'disconnected' | 'blocked'): void {
    for (const [peerId, peer] of this.peers.entries()) {
      if (peerId !== leavingSessionId) {
        try {
          peer.socket.send(
            JSON.stringify({
              type: 'PEER_LEFT',
              sessionId: leavingSessionId,
              roomId: 'current',
              reason,
              timestamp: Date.now(),
            })
          );
        } catch (e) {
          console.warn('[RoomDO] Failed to send PEER_LEFT', e);
        }
      }
    }
  }

  private destroyRoom(): void {
    this.isDestroyed = true;
    for (const peer of this.peers.values()) {
      try {
        peer.socket.close(1000, 'Room closed');
      } catch {
        // ignore
      }
    }
    this.peers.clear();
  }
}
