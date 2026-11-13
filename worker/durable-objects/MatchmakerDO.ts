import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types.js';
import type { SignalingMessage, QueueJoinMessage } from '@shared/types.js';

interface QueuedPeer {
  sessionId: string;
  token: string;
  socket: WebSocket;
  enqueuedAt: number;
  excludePeerId?: string;
  country?: string;
  countryCode?: string;
}

interface RateLimitTracker {
  count: number;
  windowStart: number;
}

/**
 * MatchmakerDO
 * Coordinates random pairing across active peers atomically in single-threaded memory.
 * Guarantees no two peers are matched redundantly, prevents race conditions,
 * enforces session validation, rate limiting, and blocklist separation.
 */
export class MatchmakerDO extends DurableObject<Env> {
  private queue: QueuedPeer[] = [];
  // Tracks active pairings: sessionId -> roomId
  private activeMatches: Map<string, string> = new Map();
  // Rate limiting map: sessionId -> tracker
  private rateLimits: Map<string, RateLimitTracker> = new Map();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/match/queue') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const webSocketPair = new WebSocketPair();
      const [clientSocket, serverSocket] = Object.values(webSocketPair);

      serverSocket.accept();
      this.handleSocketConnection(serverSocket);

      return new Response(null, {
        status: 101,
        webSocket: clientSocket,
      });
    }

    if (url.pathname === '/status') {
      return Response.json({
        queueLength: this.queue.length,
        activeMatchesCount: this.activeMatches.size,
        status: 'healthy',
      });
    }

    // Endpoint for rooms or workers to clear active match
    if (url.pathname === '/match/clear' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { sessionId: string };
        if (body.sessionId) {
          this.activeMatches.delete(body.sessionId);
          return Response.json({ success: true });
        }
      } catch {
        // ignore
      }
      return Response.json({ error: 'Invalid payload' }, { status: 400 });
    }

    return new Response('Not found', { status: 404 });
  }

  private handleSocketConnection(socket: WebSocket): void {
    let boundSessionId: string | null = null;

    socket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string) as SignalingMessage;

        if (message.type === 'QUEUE_JOIN') {
          boundSessionId = message.sessionId;
          await this.handleQueueJoin(message as QueueJoinMessage, socket);
        } else if (message.type === 'QUEUE_LEAVE') {
          if (boundSessionId) {
            this.dequeuePeer(boundSessionId);
          }
        }
      } catch (err) {
        console.error('[MatchmakerDO] Message parse error', err);
      }
    });

    socket.addEventListener('close', () => {
      if (boundSessionId) {
        this.dequeuePeer(boundSessionId);
      }
    });

    socket.addEventListener('error', () => {
      if (boundSessionId) {
        this.dequeuePeer(boundSessionId);
      }
    });
  }

  private async handleQueueJoin(message: QueueJoinMessage, socket: WebSocket): Promise<void> {
    const { sessionId, token, excludePeerId, country, countryCode } = message;

    // 1. Server-side validation
    if (!sessionId || !token || !token.startsWith('umo_gst_')) {
      this.sendError(socket, 'INVALID_PAYLOAD', 'Invalid session identity or token');
      return;
    }

    // 2. Server-side rate limiting (max 12 join attempts per 10s)
    const now = Date.now();
    const rate = this.rateLimits.get(sessionId) || { count: 0, windowStart: now };
    if (now - rate.windowStart > 10000) {
      rate.count = 1;
      rate.windowStart = now;
    } else {
      rate.count += 1;
    }
    this.rateLimits.set(sessionId, rate);

    if (rate.count > 12) {
      this.sendError(socket, 'RATE_LIMITED', 'Too many matching attempts. Please slow down.');
      return;
    }

    // 3. Duplicate-session protection: remove any previous queue entries or active match
    this.dequeuePeer(sessionId);
    this.activeMatches.delete(sessionId);

    // 4. Atomic matching: search for an eligible candidate in the waiting queue
    let candidateToPair: QueuedPeer | null = null;

    // Filter dead sockets synchronously
    this.queue = this.queue.filter(
      (item) => item.socket.readyState === WebSocket.OPEN && item.sessionId !== sessionId
    );

    for (let i = 0; i < this.queue.length; i++) {
      const candidate = this.queue[i];

      // Honor consecutive skip exclusion (do not match back-to-back if another peer can be found)
      if (excludePeerId && candidate.sessionId === excludePeerId && this.queue.length > 1) {
        continue;
      }
      if (candidate.excludePeerId && candidate.excludePeerId === sessionId && this.queue.length > 1) {
        continue;
      }

      // Atomically remove candidate from queue BEFORE any async yields
      this.queue.splice(i, 1);
      candidateToPair = candidate;
      break;
    }

    // 5. If eligible candidate found, verify blocklist and pair them
    if (candidateToPair) {
      const isBlocked = await this.isBlockedInD1(sessionId, candidateToPair.sessionId);
      if (isBlocked) {
        // Return candidate to queue if blocked
        this.queue.push(candidateToPair);
        this.queue.push({ sessionId, token, socket, enqueuedAt: now, excludePeerId, country, countryCode });
        return;
      }

      await this.pairPeers(
        { sessionId, token, socket, enqueuedAt: now, excludePeerId, country, countryCode },
        candidateToPair
      );
    } else {
      // 6. Otherwise, place in waiting queue
      this.queue.push({
        sessionId,
        token,
        socket,
        enqueuedAt: now,
        excludePeerId,
        country,
        countryCode,
      });

      // Send heartbeat confirmation
      try {
        socket.send(
          JSON.stringify({
            type: 'HEARTBEAT',
            sessionId,
            timestamp: now,
          })
        );
      } catch {
        this.dequeuePeer(sessionId);
      }
    }
  }

  private dequeuePeer(sessionId: string): void {
    this.queue = this.queue.filter((item) => item.sessionId !== sessionId);
  }

  private async isBlockedInD1(sessionA: string, sessionB: string): Promise<boolean> {
    if (!this.env.DB) return false;
    try {
      const result = await this.env.DB.prepare(
        `SELECT 1 FROM blocked_peers
         WHERE (blocker_session_id = ? AND blocked_session_id = ?)
            OR (blocker_session_id = ? AND blocked_session_id = ?)
         LIMIT 1`
      )
        .bind(sessionA, sessionB, sessionB, sessionA)
        .first();

      return result !== null;
    } catch (err) {
      console.warn('[MatchmakerDO] D1 block check fallback:', err);
      return false;
    }
  }

  private async pairPeers(peerA: QueuedPeer, peerB: QueuedPeer): Promise<void> {
    const roomId = crypto.randomUUID();

    // Mark both peers as actively matched to prevent duplicate matching
    this.activeMatches.set(peerA.sessionId, roomId);
    this.activeMatches.set(peerB.sessionId, roomId);

    // Pre-authorize the two paired peer session IDs with the designated RoomDO instance
    try {
      const roomObjectId = this.env.ROOM.idFromName(roomId);
      const roomStub = this.env.ROOM.get(roomObjectId);
      await roomStub.fetch('http://internal/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peers: [peerA.sessionId, peerB.sessionId] }),
      });
    } catch (err) {
      console.error('[MatchmakerDO] Failed to pre-authorize room:', err);
    }

    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // Peer A is assigned as WebRTC Initiator (creates SDP offer)
    try {
      peerA.socket.send(
        JSON.stringify({
          type: 'MATCH_FOUND',
          sessionId: peerA.sessionId,
          peerSessionId: peerB.sessionId,
          peerCountry: peerB.country || 'Global',
          peerCountryCode: peerB.countryCode || 'GLOBAL',
          roomId,
          isInitiator: true,
          iceServers,
          timestamp: Date.now(),
        })
      );
    } catch (e) {
      console.warn('[MatchmakerDO] Failed to notify Peer A', e);
      this.activeMatches.delete(peerA.sessionId);
    }

    // Peer B is assigned as WebRTC Receiver (answers SDP offer)
    try {
      peerB.socket.send(
        JSON.stringify({
          type: 'MATCH_FOUND',
          sessionId: peerB.sessionId,
          peerSessionId: peerA.sessionId,
          peerCountry: peerA.country || 'Global',
          peerCountryCode: peerA.countryCode || 'GLOBAL',
          roomId,
          isInitiator: false,
          iceServers,
          timestamp: Date.now(),
        })
      );
    } catch (e) {
      console.warn('[MatchmakerDO] Failed to notify Peer B', e);
      this.activeMatches.delete(peerB.sessionId);
    }
  }

  private sendError(socket: WebSocket, code: 'RATE_LIMITED' | 'SESSION_EXPIRED' | 'MATCHMAKER_TIMEOUT' | 'INVALID_PAYLOAD' | 'PEER_ERROR', message: string): void {
    try {
      socket.send(
        JSON.stringify({
          type: 'ERROR',
          sessionId: 'system',
          code,
          message,
          timestamp: Date.now(),
        })
      );
    } catch {
      // ignore
    }
  }
}
