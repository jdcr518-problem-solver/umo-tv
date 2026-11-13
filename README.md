# UMO TV — Random Video Chat & Real-Time Face Filters

> A modern, anonymous 1-on-1 random video chat web application inspired by OmeTV, featuring native WebRTC peer-to-peer streaming, serverless WebSocket signaling via Cloudflare Durable Objects, and real-time facial filters powered by MediaPipe and Three.js.

---

## 1. Architectural Highlights

- **Web-First & Zero Paid Subscriptions:** Designed for 100% free-tier operation across desktop and mobile browsers without third-party video SDKs, paid filter SDKs, or required monthly fees.
- **Serverless Real-Time Coordination:** Leverages **Cloudflare Workers** with **Durable Objects (`MatchmakerDO`, `RoomDO`)** for atomic, race-condition-free peer matching and WebSocket signaling.
- **D1 Persistent Storage:** Server-generated guest sessions, audit trails, abuse reports, and user blocklists are stored securely in **Cloudflare D1**.
- **Outgoing Stream AR Modification:** Unlike simple canvas preview overlays, UMO TV's AR filter pipeline composites Three.js 3D models and MediaPipe Face Landmarker tracking onto an offscreen canvas and broadcasts the rendered frames directly across the WebRTC `RTCPeerConnection` via `canvas.captureStream()`. The remote peer sees the rendered filter in real time.
- **Privacy & Safety First:** Strict 18+ compliance gate, zero video recording pledge, ephemeral in-call text chat, cryptographic guest session IDs, and zero-tolerance abuse reporting & permanent blocking workflows.

---

## 2. System Architecture & Component Separation

```
umo-tv/
├── src/                          # Frontend Application (React 19 + Vite + Tailwind CSS)
│   ├── assets/                   # Static assets & icons
│   ├── components/               # UI components
│   │   ├── Header.tsx            # Navigation, status indicators, guest ID badge, safety pill
│   │   ├── VideoStage.tsx        # Responsive split-screen video stage (Mobile stacked / Desktop side-by-side)
│   │   ├── ControlBar.tsx        # Start, Next, Stop, Mic, Camera, Filter Drawer, Chat, Report buttons
│   │   ├── FilterDrawer.tsx      # AR filter selector (Dog Ears & Nose, Neon Sunglasses)
│   │   ├── ChatDrawer.tsx        # In-call ephemeral text chat panel
│   │   ├── ReportModal.tsx       # Abuse reporting & instant blocking modal
│   │   └── AgeGateModal.tsx      # 18+ verification and community rules disclaimer
│   ├── modules/                  # Modular architecture & separation of concerns
│   │   ├── camera/               # MediaStream capture, resolution, and track management
│   │   ├── ar-filter/            # MediaPipe Face Landmarker & Three.js canvas AR pipeline
│   │   ├── webrtc/               # RTCPeerConnection transport, SDP negotiation, track swap
│   │   ├── signaling/            # WebSocket client communicating with Cloudflare DOs
│   │   ├── matchmaking/          # Matchmaking finite state machine & lifecycle timeouts
│   │   └── safety/               # Guest session, age verification, abuse reports & blocklist
│   ├── lib/                      # Tailwind utilities (clsx, twMerge)
│   ├── App.tsx                   # Main orchestrator component
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styling & Tailwind directives
│
├── worker/                       # Cloudflare Serverless Backend
│   ├── db/
│   │   └── schema.sql            # D1 database schema (sessions, reports, blocks, rate limits)
│   ├── durable-objects/
│   │   ├── MatchmakerDO.ts       # Global singleton for atomic FIFO/random queue pairing
│   │   └── RoomDO.ts             # Ephemeral 2-peer room for WebRTC signaling exchange
│   ├── types.ts                  # Worker environment bindings (DurableObjects, D1Database)
│   └── index.ts                  # Worker routing (/api/*, /ws/*) & guest session auth
│
├── shared/                       # Shared Domain Types & Communication Protocol
│   └── types.ts                  # Signaling message schemas, matchmaking states, filter metadata
│
├── wrangler.jsonc                # Cloudflare Workers, Static Assets, DOs, & D1 configuration
├── vite.config.ts                # Vite bundler configuration & local backend proxy
└── tsconfig.json                 # TypeScript project references (app, node, worker)
```

---

## 3. Data Flow & Communication Lifecycle

```
[Client A]                     [Cloudflare MatchmakerDO]                  [Client B]
     │                                     │                                   │
     ├── 1. POST /api/session ─────────────┤ (Generates hashed guest session)  │
     ├── 2. WebSocket /ws/match ───────────┤                                   │
     │      SIGNAL: QUEUE_JOIN             │                                   │
     │                                     ├────── 2b. SIGNAL: QUEUE_JOIN ─────┤
     │                                     │                                   │
     │                         [Atomic Matching Logic]                         │
     │                                     │                                   │
     │<── 3. SIGNAL: MATCH_FOUND ──────────┴───── 3. SIGNAL: MATCH_FOUND ──────>
     │       (roomId, isInitiator=true)             (roomId, isInitiator=false)
     │                                                                         │
     ▼                                                                         ▼
[Client A WebSocket] ───────────────> [RoomDO (roomId)] <────────── [Client B WebSocket]
     │                                     │                                   │
     ├── 4. SIGNAL: OFFER (SDP) ───────────┼──────────────────────────────────>│
     │<── 5. SIGNAL: ANSWER (SDP) ─────────┼───────────────────────────────────┤
     │<── 6. SIGNAL: ICE_CANDIDATE ────────┼──────────────────────────────────>│
     │                                     │                                   │
     ▼                                                                         ▼
[Client A WebRTC Peer] <═══════════════ P2P Media Stream ═══════════════> [Client B WebRTC Peer]
 (STUN Direct Connection)         (Audio + Canvas Filter Video)            (STUN Direct Connection)
```

---

## 4. Free-Tier Limits, Bottlenecks & Scaling Strategy

| Subsystem | Cloudflare Free-Tier Allocation | Potential Bottleneck | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Cloudflare Workers** | 100,000 requests/day, 10ms CPU/request | Burst traffic exceeding daily limit during viral spikes. | Keep Worker handlers ultra-lean; offload media entirely to P2P WebRTC; rely on Workers Assets caching for static files. |
| **Durable Objects** | Free-tier DO allowance (1M requests/mo, 1GB-hr storage) | Long-lived WebSocket connections consuming wall-clock duration. | Use lightweight WebSocket channels: `MatchmakerDO` for queuing (cleared upon match), and `RoomDO` for active in-call lifecycle signaling (Next, Stop, and disconnect alerts). |
| **Cloudflare D1** | 5M read rows/day, 100K write rows/day, 5GB storage | Frequent writes on every session check or block action. | Cloudflare D1 acts as the authoritative database for blocks, reports, and bans. Local browser storage is strictly a client-side UI cache. |
| **WebRTC Connectivity** | $0 (Public Google STUN servers) | Restrictive NAT and symmetric carrier firewalls. | Connections rely on STUN-assisted direct peer-to-peer transport without paid TURN relays. On networks where direct P2P is blocked by symmetric NAT, a configurable timeout trips gracefully and allows the user to skip to another stranger. |
| **MediaPipe & Three.js** | Client-Side Browser Execution ($0 server cost) | Older mobile devices experiencing thermal throttling or low frame rates during face mesh detection. | Adaptive frame skipping (detect every 2nd or 3rd frame), low-overhead WebGL rendering, and automatic fallback to raw camera stream if device FPS drops below 20. |

---

## 5. Development & Verification

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Installation
```bash
# Install dependencies
npm install
```

### Running Locally
```bash
# Start frontend with Vite HMR
npm run dev

# Run local Cloudflare Worker with Miniflare simulation
npm run worker:dev
```

### Linting & Type Checking
```bash
# Run oxlint (ultra-fast linter)
npm run lint

# Verify TypeScript compilation across app, worker, and shared schemas
npm run build
```

### End-to-End Protocol & Matchmaking Verification
```bash
# Start the local Wrangler server
npm run worker:dev

# Run automated 7-part verification suite in a separate terminal
npm run test:protocol
```

---

## 6. Implementation Roadmap

- [x] **Milestone 1: Project Architecture & Foundation Shell (Completed)**
  - Cloudflare React + Vite foundation.
  - Full module separation (`camera`, `ar-filter`, `webrtc`, `signaling`, `matchmaking`, `safety`).
  - Durable Objects & D1 backend schemas.
  - Responsive desktop & mobile application shell.
  - Zero-lint warnings & strict TypeScript type safety.
- [x] **Milestone 2: Real Video Chat & Matchmaking (Completed)**
  - Server-authoritative guest session management with D1 persistence.
  - Global `MatchmakerDO` with atomic candidate pairing, duplicate-session prevention, and rate limiting.
  - Ephemeral `RoomDO` with pre-authorized peer access (403 for unauthorized strangers) and active control channel.
  - Native WebRTC `RTCPeerConnection` with STUN-assisted offer/answer and ICE candidate exchange.
  - ICE candidate buffering before remote description to eliminate state race conditions.
  - Configurable WebRTC connection timeout (default 15 seconds) with graceful error recovery.
  - In-call text chat relayed over WebRTC RTCDataChannel and Room control channel.
  - Seamless Next / Skip and Stop lifecycle teardown with consecutive peer exclusion.
  - Automated 7-part verification suite (`npm run test:protocol`).
- [ ] **Milestone 3: MediaPipe + Three.js Real-Time Face Filters**
  - Load MediaPipe Face Landmarker model.
  - Render Dog Ears/Nose and Sunglasses 3D models with Three.js.
  - Stream outgoing canvas video directly to WebRTC sender via `replaceTrack()`.
- [ ] **Milestone 4: Abuse Moderation & Production Deployment**
  - Automated IP-rate limiting and ban enforcement in D1.
  - End-to-end testing across Chrome, Safari, Firefox, iOS, and Android.
  - Cloudflare deployment (`wrangler deploy`).
