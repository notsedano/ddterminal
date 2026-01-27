# SSE (Server-Sent Events) Implementation

## Overview

Replaced Socket.IO WebSocket streaming with native SSE (Server-Sent Events) for faster AI response streaming. This eliminates WebSocket proxy issues and provides better performance.

## Changes Made

### 1. Created SSE Utility (`src/utils/sse.ts`)

- Uses native `EventSource` API (works over standard HTTP)
- Connects to `/api/agents/{agentId}/stream?roomId={roomId}`
- Handles event types:
  - `chunk` - Streaming text chunks
  - `message` - Complete messages
  - `error` - Error events
  - `done` - Stream completion
- Automatic reconnection with exponential backoff
- Returns cleanup function for proper connection management

### 2. Updated `useChat.ts`

- **Replaced Socket.IO streaming** with SSE connection
- **Socket.IO is now optional** (disabled by default) - can be re-enabled for bidirectional features
- **REST API still used** for sending messages (simpler, more reliable)
- **Streaming chunks** are accumulated and displayed in real-time
- **Message finalization** happens on `done` event or complete `message` event

### 3. Benefits

✅ **No WebSocket upgrade issues** - Works over standard HTTP  
✅ **Faster initial response** - No handshake overhead  
✅ **Simpler implementation** - Native browser API  
✅ **Better for one-way streaming** - Server → Client  
✅ **Automatic reconnection** - Built into EventSource  
✅ **Works through all proxies** - No special configuration needed

## API Endpoint Expected

The frontend expects the backend to provide:

```
GET /api/agents/{agentId}/stream?roomId={roomId}&token={authToken}
```

### Event Format

The backend should send Server-Sent Events in this format:

```
event: chunk
data: {"messageId": "...", "chunk": "Hello", "channelId": "...", "sessionId": "..."}

event: chunk
data: {"messageId": "...", "chunk": " world", "channelId": "...", "sessionId": "..."}

event: message
data: {"messageId": "...", "text": "Hello world", "userId": "...", "agentId": "...", "sessionId": "...", "timestamp": "..."}

event: done
data: 

event: error
data: {"message": "Error description", "code": "ERROR_CODE"}
```

### Response Headers

The backend must include:
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## Testing

### 1. Verify SSE Connection

Open browser DevTools → Network tab → Filter by "stream" or "eventsource"

You should see:
- Connection to `/api/agents/{agentId}/stream?roomId={roomId}`
- Status: 200 (or 101 if using HTTP/2)
- Type: `eventsource`

### 2. Check Console Logs

Look for:
```
[useChat] Setting up SSE stream for streaming responses
[SSE] Connecting to: https://...
[SSE] ✅ Connection opened
[useChat] SSE stream opened
```

### 3. Test Streaming

Send a message and verify:
- Chunks appear in real-time as they're received
- Message is finalized when stream completes
- No WebSocket errors in console

## Fallback Behavior

If SSE connection fails:
- **No error shown to user** (non-critical)
- **REST API polling** continues to work (already implemented)
- **Messages still work** via REST API fallback

## Socket.IO Status

Socket.IO is **disabled by default** but can be re-enabled by changing:

```typescript
const socket = useSocket({
  agentId,
  roomId,
  enabled: true, // Change to true to enable
});
```

This allows for future bidirectional features if needed.

## Backend Requirements

The backend must implement the SSE endpoint:

1. **Endpoint**: `GET /api/agents/{agentId}/stream`
2. **Query Parameters**:
   - `roomId` (required) - Session/room ID
   - `token` (optional) - Auth token if needed
3. **Response**: Server-Sent Events stream
4. **Events**: `chunk`, `message`, `error`, `done`

## Migration Notes

- **No breaking changes** - Existing message structure preserved
- **UI updates unchanged** - Same message display logic
- **Storage unchanged** - Messages still saved to Supabase/IndexedDB
- **Only transport changed** - From Socket.IO events to SSE events
