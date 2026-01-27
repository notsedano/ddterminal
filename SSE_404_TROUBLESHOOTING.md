# SSE 404 Error - Troubleshooting

## Problem

The SSE endpoint is returning `404 Not Found`, which means the backend endpoint doesn't exist or the URL is incorrect.

## Current URL Format

The frontend is trying to connect to:
```
GET /api/agents/{agentId}/stream?roomId={roomId}&token={optionalToken}
```

Full URL example:
```
https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents/71196e85-8a16-0910-98e5-e2d2ee3018db/stream?roomId=...
```

## Possible Issues

### 1. Endpoint Doesn't Exist
The backend may not have implemented the SSE streaming endpoint yet.

**Solution:** Verify with backend team that `/api/agents/{agentId}/stream` endpoint exists.

### 2. Wrong Path
The endpoint path might be different.

**Possible alternatives:**
- `/api/agents/{agentId}/messages/stream`
- `/api/stream/agents/{agentId}`
- `/api/messaging/agents/{agentId}/stream`
- `/stream?agentId={agentId}&roomId={roomId}`

**Solution:** Check backend API documentation or ask backend team for correct path.

### 3. CORS Issue
Even if endpoint exists, CORS might block the connection.

**Solution:** Backend needs to allow CORS for EventSource:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### 4. Authentication Required
The endpoint might require authentication that EventSource can't provide via headers.

**Solution:** 
- Use query parameter `token` (already implemented)
- Or use cookies for authentication
- Or backend needs to support token in query param

## Testing the Endpoint

### Test 1: Check if endpoint exists
```bash
curl -v "https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents/71196e85-8a16-0910-98e5-e2d2ee3018db/stream?roomId=test-room"
```

Expected:
- If exists: `200 OK` or `101 Switching Protocols`
- If not: `404 Not Found`

### Test 2: Check in browser
Open browser console and run:
```javascript
const es = new EventSource('https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents/71196e85-8a16-0910-98e5-e2d2ee3018db/stream?roomId=test-room');
es.onerror = (e) => console.error('Error:', e);
es.onopen = () => console.log('Connected!');
```

## Current Behavior

The frontend will:
1. ✅ Try to connect to SSE endpoint
2. ✅ Detect 404 error immediately
3. ✅ Stop retrying (no more spam)
4. ✅ Fall back to REST API polling (already working)
5. ✅ Continue working normally without SSE

## Next Steps

1. **Verify endpoint exists** - Check with backend team
2. **Check correct path** - Confirm the exact endpoint path
3. **Test endpoint** - Use curl or browser to test
4. **Update path if needed** - Modify `src/utils/sse.ts` line 61 if path is different

## Temporary Workaround

If SSE endpoint doesn't exist yet, the app will continue working via REST API polling. SSE is optional and non-blocking.

To disable SSE completely (until endpoint is ready), comment out the SSE effect in `useChat.ts`:

```typescript
// SSE connection for streaming AI responses
useEffect(() => {
  // Temporarily disabled until backend endpoint is ready
  return;
  
  if (!sessionId || !agentId || !roomId) return;
  // ... rest of SSE code
}, [sessionId, agentId, roomId]);
```
