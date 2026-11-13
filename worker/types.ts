/**
 * Cloudflare Worker Environment Bindings
 */
export interface Env {
  MATCHMAKER: DurableObjectNamespace;
  ROOM: DurableObjectNamespace;
  DB: D1Database;
  ENVIRONMENT?: string;
  SESSION_SECRET?: string;
}
