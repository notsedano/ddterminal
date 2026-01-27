# SSE Implementation - Testing Guide

## ✅ Implementation Complete

The SSE streaming implementation is ready to test. Here's what was implemented:

### Files Modified/Created

1. **`src/utils/sse.ts`** - SSE utility with EventSource API
2. **`src/hooks/useChat.ts`** - Updated to use SSE instead of Socket.IO for streaming
3. **Socket.IO** - Disabled by default (can be re-enabled if needed)

### Endpoint Format

The implementation connects to:
```
GET /api/agents/{agentId}/stream?roomId={roomId}&token={optionalToken}
```

This matches your backend endpoint format exactly.

## 🧪 Testing Steps

### 1. Open Browser DevTools

1. Open your app in the browser
2. Open DevTools (F12)
3. Go to **Console** tab
4. Go to **Network** tab

### 2. Check Console Logs

When you load a chat session, you should see:

```
[useChat] Setting up SSE stream for streaming responses
[SSE] Connecting to: https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents/71196e85-8a16-0910-98e5-e2d2ee3018db/stream?roomId=...
[SSE] ✅ Connection opened
[useChat] SSE stream opened
```

### 3. Check Network Tab

1. Filter by "stream" or "eventsource"
2. You should see a request to `/api/agents/{agentId}/stream`
3. Status should be **200** (or **101** if using HTTP/2)
4. Type should be **`eventsource`**
5. The connection should stay open (pending state)

### 4. Send a Message

1. Type a message and send it
2. Watch the console for streaming chunks:

```
[SSE] Received chunk: Hello...
[SSE] Received chunk:  world...
[SSE] Received chunk: ! How...
[SSE] ✅ Stream complete
```

3. Watch the UI - text should appear character-by-character in real-time

### 5. Verify Message Finalization

After streaming completes:
- The streaming message should be finalized
- It should be saved to storage (Supabase/IndexedDB)
- The message ID should be consistent (not change)

## 🔍 Expected Behavior

### ✅ Success Indicators

- ✅ SSE connection opens immediately
- ✅ Chunks stream in real-time as they arrive
- ✅ Text appears character-by-character in the UI
- ✅ Message is finalized when stream completes
- ✅ No WebSocket errors in console
- ✅ Connection stays open for subsequent messages

### ⚠️ Potential Issues

#### Issue: Connection fails immediately
**Symptoms:** `[SSE] Connection error` right after opening
**Possible causes:**
- Backend endpoint doesn't exist (404)
- CORS issue
- Authentication required but token missing

**Check:**
- Network tab shows 404 or CORS error
- Verify endpoint URL is correct
- Check if auth token is needed

#### Issue: No chunks received
**Symptoms:** Connection opens but no chunks appear
**Possible causes:**
- Backend not sending events
- Event type mismatch (backend using different event names)

**Check:**
- Network tab → Click on stream request → Response tab
- Should see `event: chunk` and `data: {...}` lines
- Verify event types match: `chunk`, `message`, `done`, `error`

#### Issue: Chunks received but not displayed
**Symptoms:** Console shows chunks but UI doesn't update
**Possible causes:**
- React state update issue
- Message ID mismatch

**Check:**
- Console should show `[SSE] Received chunk: ...`
- Check React DevTools for state updates
- Verify `streamingMessage` state is updating

## 📊 Debugging

### Enable Verbose Logging

The implementation already includes console logging. To see more details:

1. Check browser console for all `[SSE]` and `[useChat]` logs
2. Check Network tab → Stream request → Response tab to see raw SSE events
3. Use React DevTools to monitor state changes

### Test SSE Endpoint Directly

You can test the endpoint directly in the browser console:

```javascript
const eventSource = new EventSource('https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents/71196e85-8a16-0910-98e5-e2d2ee3018db/stream?roomId=YOUR_ROOM_ID');

eventSource.addEventListener('chunk', (e) => {
  console.log('Chunk:', JSON.parse(e.data));
});

eventSource.addEventListener('message', (e) => {
  console.log('Message:', JSON.parse(e.data));
});

eventSource.addEventListener('done', () => {
  console.log('Done!');
});

eventSource.onerror = (e) => {
  console.error('Error:', e);
};
```

## 🎯 Success Criteria

The implementation is working correctly if:

1. ✅ SSE connection opens when chat session loads
2. ✅ Sending a message triggers streaming response
3. ✅ Text appears in real-time (character-by-character)
4. ✅ Message is finalized when stream completes
5. ✅ No errors in console
6. ✅ Connection stays open for multiple messages

## 📝 Next Steps

Once testing confirms it works:

1. **Remove Socket.IO dependency** (optional - can keep for future bidirectional features)
2. **Remove polling fallback** (optional - SSE should be more reliable)
3. **Optimize chunk handling** if needed (debouncing, batching, etc.)

## 🔄 Fallback Behavior

If SSE fails:
- **No error shown to user** (non-critical)
- **REST API polling** continues to work (already implemented in `useChat.ts`)
- **Messages still work** via REST API fallback

The app will gracefully degrade to REST API polling if SSE is unavailable.
