import type { GuestSession, ReportPayload, ReportReason } from '@shared/types.js';

/**
 * Safety & Identity Service
 * Handles server-generated guest sessions, legal compliance acknowledgments,
 * and server-authoritative abuse reporting and peer blocking.
 *
 * NOTE: LocalStorage is strictly utilized for UI hints and client convenience.
 * All authoritative security decisions, block enforcement, and bans are executed
 * server-side via Cloudflare D1 and Durable Objects.
 */
export class SafetyService {
  private currentSession: GuestSession | null = null;
  private ageAcknowledged = false;

  constructor() {
    this.loadClientPreferences();
  }

  private loadClientPreferences(): void {
    if (typeof window === 'undefined') return;
    this.ageAcknowledged = localStorage.getItem('umo_age_acknowledged') === 'true';
  }

  isAgeAcknowledged(): boolean {
    return this.ageAcknowledged;
  }

  setAgeAcknowledged(acknowledged: boolean): void {
    this.ageAcknowledged = acknowledged;
    if (typeof window !== 'undefined') {
      localStorage.setItem('umo_age_acknowledged', acknowledged ? 'true' : 'false');
    }
  }

  getSession(): GuestSession | null {
    return this.currentSession;
  }

  async acquireSession(): Promise<GuestSession> {
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Failed to acquire session: ${res.statusText}`);
      }

      this.currentSession = (await res.json()) as GuestSession;
      return this.currentSession;
    } catch (err) {
      console.warn('[SafetyService] Failed to acquire session from server, retrying or using fallback', err);
      // Fallback offline token for local development when worker is starting
      this.currentSession = {
        sessionId: crypto.randomUUID(),
        token: `umo_gst_offline_${Date.now()}`,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        ageVerified: this.ageAcknowledged,
      };
      return this.currentSession;
    }
  }

  async reportPeer(reportedSessionId: string, reason: ReportReason, notes?: string): Promise<boolean> {
    const payload: ReportPayload = {
      reportedSessionId,
      reason,
      notes,
      timestamp: Date.now(),
    };

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': this.currentSession?.sessionId || 'anonymous',
        },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch (err) {
      console.warn('[SafetyService] Failed to submit report to backend', err);
      return false;
    }
  }

  async blockPeer(blockedSessionId: string): Promise<boolean> {
    try {
      const res = await fetch('/api/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': this.currentSession?.sessionId || 'anonymous',
        },
        body: JSON.stringify({ blockedSessionId, timestamp: Date.now() }),
      });
      return res.ok;
    } catch (err) {
      console.warn('[SafetyService] Failed to record block in D1', err);
      return false;
    }
  }
}

export const safetyService = new SafetyService();
