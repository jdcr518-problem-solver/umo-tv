import type { SignalingMessage } from '@shared/types.js';

export interface SignalingClientHandlers {
  onMessage: (message: SignalingMessage) => void;
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (err: Event) => void;
}

export class SignalingClient {
  private socket: WebSocket | null = null;
  private handlers: SignalingClientHandlers;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(handlers: SignalingClientHandlers) {
    this.handlers = handlers;
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();

      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.startHeartbeat();
        if (this.handlers.onOpen) this.handlers.onOpen();
        resolve();
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as SignalingMessage;
          this.handlers.onMessage(msg);
        } catch (e) {
          console.error('[SignalingClient] Parse error', e);
        }
      };

      this.socket.onclose = (event) => {
        this.stopHeartbeat();
        if (this.handlers.onClose) this.handlers.onClose(event);
      };

      this.socket.onerror = (err) => {
        this.stopHeartbeat();
        if (this.handlers.onError) this.handlers.onError(err);
        reject(err);
      };
    });
  }

  send(message: SignalingMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.warn('[SignalingClient] Socket not open, cannot send message:', message.type);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({
            type: 'HEARTBEAT',
            sessionId: 'ping',
            timestamp: Date.now(),
          })
        );
      }
    }, 20000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
}

export function buildWebSocketUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}
