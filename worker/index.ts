import { MatchmakerDO } from './durable-objects/MatchmakerDO.js';
import { RoomDO } from './durable-objects/RoomDO.js';
import type { Env } from './types.js';
import type { GuestSession, ReportPayload, BlockPayload } from '@shared/types.js';

// Export Durable Object classes for Cloudflare Workers runtime
export { MatchmakerDO, RoomDO };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for local Vite development and API access
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === '/api/health') {
      return Response.json(
        {
          status: 'ok',
          service: 'UMO TV Worker',
          timestamp: Date.now(),
          version: '1.0.0-foundation',
        },
        { headers: corsHeaders }
      );
    }

    // Guest Session Generation
    if (url.pathname === '/api/session' && request.method === 'POST') {
      const sessionId = crypto.randomUUID();
      const clientIp = request.headers.get('cf-connecting-ip') || '127.0.0.1';
      const userAgent = request.headers.get('user-agent') || 'unknown';
      const countryCode = request.headers.get('cf-ipcountry') || 'US';

      // Hash client IP for privacy preservation
      const encoder = new TextEncoder();
      const ipData = encoder.encode(clientIp + (env.SESSION_SECRET || 'umo_salt'));
      const hashBuffer = await crypto.subtle.digest('SHA-256', ipData);
      const ipHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 16);

      const issuedAt = Date.now();
      const expiresAt = issuedAt + 24 * 60 * 60 * 1000; // 24 hours

      // Store in D1 if available
      if (env.DB) {
        try {
          await env.DB.prepare(
            `INSERT INTO guest_sessions (session_id, ip_hash, user_agent, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?)`
          )
            .bind(sessionId, ipHash, userAgent, issuedAt, expiresAt)
            .run();
        } catch (err) {
          console.warn('D1 write skipped or uninitialized in local mock:', err);
        }
      }

      const session: GuestSession = {
        sessionId,
        token: `umo_gst_${sessionId}`,
        issuedAt,
        expiresAt,
        ageVerified: true,
        countryCode,
        country: countryCode === 'US' ? 'United States' : countryCode,
      };

      return Response.json(session, { headers: corsHeaders });
    }

    // Abuse Reporting
    if (url.pathname === '/api/report' && request.method === 'POST') {
      try {
        const payload = (await request.json()) as ReportPayload;
        const reporterSessionId = request.headers.get('X-Session-Id') || 'unknown';

        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO abuse_reports (reporter_session_id, reported_session_id, reason, notes, reporter_ip_hash, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
            .bind(
              reporterSessionId,
              payload.reportedSessionId,
              payload.reason,
              payload.notes || '',
              'hash_placeholder',
              Date.now()
            )
            .run();
        }

        return Response.json({ success: true, message: 'Report submitted' }, { headers: corsHeaders });
      } catch {
        return Response.json({ error: 'Failed to record report' }, { status: 500, headers: corsHeaders });
      }
    }

    // Peer Blocking
    if (url.pathname === '/api/block' && request.method === 'POST') {
      try {
        const payload = (await request.json()) as BlockPayload;
        const blockerSessionId = request.headers.get('X-Session-Id') || 'unknown';

        if (env.DB) {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO blocked_peers (blocker_session_id, blocked_session_id, created_at)
             VALUES (?, ?, ?)`
          )
            .bind(blockerSessionId, payload.blockedSessionId, Date.now())
            .run();
        }

        return Response.json({ success: true, message: 'Peer blocked' }, { headers: corsHeaders });
      } catch {
        return Response.json({ error: 'Failed to record block' }, { status: 500, headers: corsHeaders });
      }
    }

    // WebSocket Matchmaker Route
    if (url.pathname === '/ws/match') {
      // Connect to the global singleton Matchmaker Durable Object
      const matchmakerId = env.MATCHMAKER.idFromName('global-matchmaker');
      const matchmakerStub = env.MATCHMAKER.get(matchmakerId);
      
      const newUrl = new URL(request.url);
      newUrl.pathname = '/match/queue';
      return matchmakerStub.fetch(new Request(newUrl.toString(), request));
    }

    // WebSocket Room Signaling Route
    if (url.pathname.startsWith('/ws/room/')) {
      const parts = url.pathname.split('/');
      const roomId = parts[3];

      if (!roomId) {
        return new Response('Room ID is required', { status: 400 });
      }

      const roomObjectId = env.ROOM.idFromName(roomId);
      const roomStub = env.ROOM.get(roomObjectId);

      const newUrl = new URL(request.url);
      newUrl.pathname = '/signal';
      return roomStub.fetch(new Request(newUrl.toString(), request));
    }

    // Fallback for non-asset worker requests
    return new Response('UMO TV API Endpoint', { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;
