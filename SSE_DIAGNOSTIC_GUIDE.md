# SSE Implementation Diagnostic Guide

## ✅ Implementation Status

**SSE is fully implemented and configured:**
- ✅ SSE utility created (`src/utils/sse.ts`)
- ✅ `useChat` hook uses SSE for streaming (`src/hooks/useChat.ts`)
- ✅ Socket.IO disabled (line 143: `enabled: false`)
- ✅ Connection state tracking added
- ✅ Event handlers configured (onChunk, onMessage, onDone, onError, onOpen, onClose)

## 🔍 How to Verify SSE is Active

### Method 1: Check Console Logs

**When SSE connects successfully, you should see:**
```
[useChat] Setting up SSE stream for streaming responses
[SSE] Full URL: https://...
[SSE] Creating EventSource connection to: ...
[SSE] ✅ Connection opened
[useChat] ✅ SSE stream opened - using SSE for real-time streaming
```

**If SSE fails, you'll see:**
```
[SSE] ❌ Connection failed immediately - endpoint may not exist (404)
[useChat] SSE endpoint not available - falling back to REST API polling
```

### Method 2: Check Network Tab

1. Open **DevTools** → **Network** tab
2. Filter by **"stream"** or **"eventsource"**
3. Look for a request to `/agents/{agentId}/stream`
4. **Verify:**
   - ✅ **Status:** `200 OK` (or `101 Switching Protocols`)
   - ✅ **Type:** `eventsource`
   - ✅ **Status in timeline:** Shows as **"Pending"** (connection stays open)
   - ✅ **Response tab:** Shows SSE events if streaming

### Method 3: Test Streaming Behavior

**Send a message and observe:**

**SSE Working (Real-time streaming):**
- Text appears **character-by-character** in real-time
- Console shows: `[SSE] Received chunk: ...`
- Console shows: `[SSE] ✅ Stream complete`
- UI shows typing indicator while streaming

**REST Fallback (No SSE):**
- Text appears **all at once** after a delay
- Console shows: `[useChat] SSE endpoint not available - falling back to REST API polling`
- Yellow warning banner: "Real-time updates unavailable. Messages sent via REST API."

### Method 4: Browser Console Test

Run this in the browser console to test the SSE endpoint directly:

```javascript
// Get current session info from React DevTools or app state
// Then run:
window.testSSEEndpoint(agentId, roomId)
```

This will:
- Test both `/agents/` and `/api/agents/` paths
- Show fetch status codes
- Create a test EventSource connection
- Log all events received

### Method 5: Check Connection State in UI

The chat component shows connection status:
- **Connected:** No warning banner (SSE is working)
- **Disconnected:** Yellow banner: "Real-time updates unavailable. Messages sent via REST API."

## 🔧 Current Configuration

### SSE Endpoint
- **URL Pattern:** `${API_BASE}/agents/${agentId}/stream?roomId=${roomId}&token=${token}`
- **Method:** GET
- **Headers:** `Accept: text/event-stream`
- **Auth:** Token passed via query parameter (EventSource limitation)

### Event Types Handled
1. **`chunk`** - Streaming text chunks
2. **`message`** - Complete message (alternative format)
3. **`error`** - Error events
4. **`done`** - Stream completion
5. **Default `message`** - Fallback for non-typed events

### Connection Behavior
- **Auto-reconnect:** Yes (up to 5 attempts with exponential backoff)
- **Reconnect delay:** Starts at 1s, doubles each attempt
- **404 handling:** Stops retrying immediately (endpoint doesn't exist)
- **Cleanup:** Properly closes on component unmount

## 🐛 Troubleshooting

### Issue: SSE Not Connecting

**Symptoms:**
- Console shows `[SSE] ❌ Connection failed immediately`
- Network tab shows 404 or connection refused
- Yellow warning banner appears

**Possible Causes:**
1. **Backend endpoint doesn't exist** - Check if `/agents/{agentId}/stream` is implemented
2. **Wrong URL path** - Check if it should be `/api/agents/` instead of `/agents/`
3. **CORS issue** - Check Network tab for CORS errors
4. **Auth token missing/invalid** - Check if token is being passed correctly
5. **Backend not deployed** - Verify backend is running and accessible

**Solutions:**
- Check backend logs for incoming requests
- Verify endpoint path matches backend route
- Test endpoint directly with `window.testSSEEndpoint()`
- Check Network tab for exact error status code

### Issue: SSE Connects But No Data

**Symptoms:**
- Console shows `[SSE] ✅ Connection opened`
- But no chunks are received when sending messages

**Possible Causes:**
1. **Backend not sending events** - Backend may not be streaming responses
2. **Wrong event type** - Backend may be using different event names
3. **Data format mismatch** - Backend may be sending data in different format

**Solutions:**
- Check Network tab → Response tab to see if events are being sent
- Verify backend is using correct event types (`chunk`, `message`, `done`)
- Check backend logs to see if it's processing messages
- Test with `window.testSSEEndpoint()` to see raw events

### Issue: SSE Works But Falls Back to REST

**Symptoms:**
- SSE connects successfully
- But messages still come via REST polling

**Possible Causes:**
1. **Backend not sending SSE events** - Connection exists but no data flows
2. **Event format mismatch** - Events not matching expected format
3. **Timing issue** - REST polling happens before SSE receives data

**Solutions:**
- Check if backend is actually streaming responses via SSE
- Verify event format matches expected structure
- Check console for `[SSE] Received chunk:` messages
- Disable REST polling temporarily to test SSE-only flow

## 📊 Expected Console Output (SSE Working)

```
[useChat] Setting up SSE stream for streaming responses {agentId: "...", roomId: "...", sessionId: "..."}
[SSE] Full URL: https://elizacloud.ai/agents/.../stream?roomId=...&token=...
[SSE] Parameters: {agentId: "...", roomId: "...", hasToken: true, apiBase: "https://elizacloud.ai"}
[SSE] Pre-flight check - Status: 200 OK for https://...
[SSE] ✅ Found working endpoint at: https://...
[SSE] Creating EventSource connection to: https://...
[SSE] ✅ Connection opened
[useChat] ✅ SSE stream opened - using SSE for real-time streaming
[SSE] Received chunk: Hello...
[SSE] Received chunk:  world...
[SSE] ✅ Stream complete
```

## 📊 Expected Console Output (SSE Failed)

```
[useChat] Setting up SSE stream for streaming responses
[SSE] Full URL: https://...
[SSE] Creating EventSource connection to: https://...
[SSE] ❌ Connection failed immediately - endpoint may not exist (404)
[SSE] URL attempted: https://...
[useChat] SSE endpoint not available - falling back to REST API polling
```

## ✅ Verification Checklist

- [ ] Console shows `[SSE] ✅ Connection opened`
- [ ] Console shows `[useChat] ✅ SSE stream opened - using SSE for real-time streaming`
- [ ] Network tab shows EventSource request with status 200
- [ ] Network tab shows request stays in "Pending" state (connection open)
- [ ] Sending a message shows `[SSE] Received chunk:` logs
- [ ] Text streams character-by-character (not all at once)
- [ ] No yellow warning banner in UI
- [ ] `isConnected` returns `true` in `useChat` hook

## 🎯 Quick Test

1. **Open DevTools Console**
2. **Open Network Tab** → Filter by "stream"
3. **Send a message in chat**
4. **Check:**
   - Console: Should see `[SSE] ✅ Connection opened`
   - Network: Should see EventSource request (status 200, type: eventsource)
   - UI: Text should stream in character-by-character
   - UI: No yellow warning banner

If all checks pass, **SSE is working!** ✅
