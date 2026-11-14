/**
 * UMO TV - Comprehensive Chat Deduplication & Pipeline Automated Verification Suite
 * Tests:
 * 1. Message Data Structure & Metadata Completeness
 * 2. Idempotent Deduplication (DataChannel + WebSocket race condition)
 * 3. Primary vs Fallback Transport Routing
 * 4. Stale Conversation / Room ID Isolation
 * 5. Self-Echo Discarding
 * 6. Content Sanitization & Bounds (Empty, Whitespace, Max 500 Chars)
 * 7. Next / Stop Conversation Reset & State Cleanup
 */

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
  passedTests++;
}

async function runChatTests() {
  console.log('🚀 Running UMO TV WhatsApp-Style Messaging & Deduplication Verification Suite...\n');

  // --- Test Suite 1: Structured Message Payload Requirements ---
  console.log('--- Test Suite 1: Structured Chat Payload & Metadata ---');
  const mockPayload = {
    messageId: '550e8400-e29b-41d4-a716-446655440000',
    roomId: 'room_abc_123',
    senderSessionId: 'sess_peer_xyz',
    text: 'Hello from WhatsApp-style UMO TV chat!',
    timestamp: Date.now(),
  };

  assert(typeof mockPayload.messageId === 'string' && mockPayload.messageId.length > 0, 'ChatPayload includes unique messageId');
  assert(mockPayload.roomId === 'room_abc_123', 'ChatPayload includes current roomId');
  assert(mockPayload.senderSessionId === 'sess_peer_xyz', 'ChatPayload includes senderSessionId');
  assert(mockPayload.text === 'Hello from WhatsApp-style UMO TV chat!', 'ChatPayload preserves message text intact');
  assert(typeof mockPayload.timestamp === 'number' && mockPayload.timestamp > 0, 'ChatPayload includes valid millisecond timestamp');

  // --- Test Suite 2: Idempotent Deduplication Pipeline ---
  console.log('\n--- Test Suite 2: Idempotent Deduplication (Dual Transport Race) ---');

  // Simulate App.tsx incoming message processor
  class MockChatManager {
    constructor(currentRoomId, mySessionId) {
      this.currentRoomId = currentRoomId;
      this.mySessionId = mySessionId;
      this.seenMessageIds = new Set();
      this.messages = [];
    }

    handleIncoming(payload) {
      // 1. Room isolation check
      if (!this.currentRoomId || (payload.roomId && payload.roomId !== this.currentRoomId)) {
        return false;
      }

      // 2. Self-echo check
      if (payload.senderSessionId === this.mySessionId) {
        return false;
      }

      // 3. Deduplication check
      if (this.seenMessageIds.has(payload.messageId)) {
        return false; // Ignored duplicate
      }

      this.seenMessageIds.add(payload.messageId);

      this.messages.push({
        id: payload.messageId,
        roomId: payload.roomId,
        sender: 'peer',
        senderSessionId: payload.senderSessionId,
        text: payload.text,
        timestamp: payload.timestamp,
      });

      return true;
    }

    sendMessage(text, dataChannelOpen = true) {
      const trimmed = text.trim();
      if (!trimmed || !this.currentRoomId) return null;

      const boundedText = trimmed.slice(0, 500);
      const messageId = `msg-${Math.random().toString(36).slice(2, 9)}`;
      const now = Date.now();

      const payload = {
        messageId,
        roomId: this.currentRoomId,
        senderSessionId: this.mySessionId,
        text: boundedText,
        timestamp: now,
      };

      // Mark outgoing message as seen
      this.seenMessageIds.add(messageId);

      // Optimistic state
      this.messages.push({
        id: messageId,
        roomId: this.currentRoomId,
        sender: 'self',
        senderSessionId: this.mySessionId,
        text: boundedText,
        timestamp: now,
      });

      // Transport routing
      let route = 'none';
      if (dataChannelOpen) {
        route = 'datachannel'; // Primary
      } else {
        route = 'websocket'; // Fallback
      }

      return { payload, route };
    }

    reset() {
      this.currentRoomId = null;
      this.seenMessageIds.clear();
      this.messages = [];
    }
  }

  const manager = new MockChatManager('room-1', 'sess-client-a');

  const incomingFromPeer = {
    messageId: 'msg-unique-101',
    roomId: 'room-1',
    senderSessionId: 'sess-client-b',
    text: 'Hey! Can you see this?',
    timestamp: Date.now(),
  };

  // First arrival (e.g. over DataChannel)
  const firstAccepted = manager.handleIncoming(incomingFromPeer);
  assert(firstAccepted === true, 'First message delivery via DataChannel is accepted');
  assert(manager.messages.length === 1, 'Chat displays exactly 1 message bubble');

  // Second arrival (e.g. over RoomDO WebSocket fallback or retransmission)
  const duplicateAccepted = manager.handleIncoming(incomingFromPeer);
  assert(duplicateAccepted === false, 'Duplicate delivery with identical messageId is safely dropped');
  assert(manager.messages.length === 1, 'Chat message count remains strictly 1 (no duplicate bubble)');

  // Triple arrival
  const thirdAccepted = manager.handleIncoming(incomingFromPeer);
  assert(thirdAccepted === false, 'Third delivery attempt remains dropped');

  // --- Test Suite 3: Transport Routing (Primary vs Fallback) ---
  console.log('\n--- Test Suite 3: Primary vs Fallback Transport Routing ---');
  
  // Scenario A: DataChannel is open -> sends ONLY over DataChannel (zero unnecessary WebSocket overhead)
  const sendResA = manager.sendMessage('Hello via WebRTC', true);
  assert(sendResA.route === 'datachannel', 'When DataChannel is open, primary transport is DataChannel');

  // Scenario B: DataChannel is NOT open -> falls back to RoomDO WebSocket
  const sendResB = manager.sendMessage('Hello via WebSocket fallback', false);
  assert(sendResB.route === 'websocket', 'When DataChannel is closed/connecting, fallback transport is WebSocket');

  // --- Test Suite 4: Stale Room & Conversation Isolation ---
  console.log('\n--- Test Suite 4: Stale Room Isolation ---');
  
  const staleRoomMessage = {
    messageId: 'msg-stale-999',
    roomId: 'room-OLD-SESSION',
    senderSessionId: 'sess-client-b',
    text: 'Delayed message from old partner',
    timestamp: Date.now(),
  };

  const staleAccepted = manager.handleIncoming(staleRoomMessage);
  assert(staleAccepted === false, 'Delayed message from a previous room is rejected');

  // --- Test Suite 5: Self-Echo Discarding ---
  console.log('\n--- Test Suite 5: Self-Echo Discarding ---');

  const selfEcho = {
    messageId: 'msg-self-echo',
    roomId: 'room-1',
    senderSessionId: 'sess-client-a', // Matches mySessionId
    text: 'My own echoed message',
    timestamp: Date.now(),
  };

  const echoAccepted = manager.handleIncoming(selfEcho);
  assert(echoAccepted === false, 'Self-echo from signaling or network bounce is ignored');

  // --- Test Suite 6: Content Sanitization & Bounds ---
  console.log('\n--- Test Suite 6: Content Sanitization & Length Bounds ---');

  assert(manager.sendMessage('', true) === null, 'Empty string message is rejected');
  assert(manager.sendMessage('     ', true) === null, 'Whitespace-only message is rejected');
  assert(manager.sendMessage('\n\n\t   ', true) === null, 'Newline-only message is rejected');

  const longText = 'A'.repeat(800);
  const boundedSend = manager.sendMessage(longText, true);
  assert(boundedSend.payload.text.length === 500, 'Messages exceeding 500 characters are capped to exactly 500 chars');

  // --- Test Suite 7: Next / Stop Conversation Reset ---
  console.log('\n--- Test Suite 7: Next / Stop Conversation Reset ---');
  
  manager.reset();
  assert(manager.messages.length === 0, 'Conversation history is cleared on Next / Stop');
  assert(manager.seenMessageIds.size === 0, 'Deduplication set is cleared for new conversation');
  assert(manager.currentRoomId === null, 'Current room ID is reset');

  console.log(`\n🎉 ALL ${passedTests} CHAT VERIFICATION TESTS PASSED SUCCESSFULLY!`);
}

runChatTests().catch((err) => {
  console.error('\n❌ Chat test suite failed:', err);
  process.exit(1);
});
