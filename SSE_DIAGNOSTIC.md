# SSE Connection Diagnostic Guide

## Quick Test

After refreshing your browser, open the console and run:

```javascript
// Get your agentId and roomId from the console logs, then:
window.testSSEEndpoint('71196e85-8a16-0910-98e5-e2d2ee3018db', 'YOUR_ROOM_ID')
```

This will test the endpoint and show you exactly what's happening.

## Check Network Tab

1. Open DevTools → **Network** tab
2. Filter by **"stream"** or look for requests to `/api/agents/.../stream`
3. Click on the request
4. Check:
   - **Status Code** (should be 200 or 101, not 404)
   - **Response Headers** (should include `Content-Type: text/event-stream`)
   - **Response** tab (should show SSE events if working)

## Common Issues

### 1. 404 Not Found
**Symptom:** Status code 404 in Network tab

**Possible causes:**
- Endpoint path is wrong
- Backend endpoint not deployed yet
- Different path structure

**Check:** Verify with backend team the exact endpoint path

### 2. CORS Error
**Symptom:** CORS error in console, blocked request

**Solution:** Backend needs to allow CORS:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

### 3. Authentication Required
**Symptom:** 401 Unauthorized

**Solution:** 
- Check if `VITE_AUTH_TOKEN` is set in `.env`
- Verify token is being passed in query string
- Check if backend accepts token in query param

### 4. Wrong Endpoint Path
**Symptom:** 404 but you know endpoint exists

**Possible alternative paths:**
- `/api/messaging/agents/{agentId}/stream`
- `/api/agents/{agentId}/messages/stream`
- `/api/stream?agentId={agentId}&roomId={roomId}`

**Solution:** Update line 69 in `src/utils/sse.ts` with correct path

## Current URL Format

The frontend is trying:
```
GET /api/agents/{agentId}/stream?roomId={roomId}&token={optionalToken}
```

Full URL example:
```
https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents/71196e85-8a16-0910-98e5-e2d2ee3018db/stream?roomId=...
```

## What to Check

1. ✅ **Console logs** - Look for `[SSE] Full URL:` to see exact URL
2. ✅ **Network tab** - Check the actual HTTP status code
3. ✅ **Backend logs** - See if request is reaching the backend
4. ✅ **Endpoint path** - Verify with backend team

## Next Steps

1. Run the test function in console
2. Check Network tab for exact error
3. Share the results with backend team
4. Update endpoint path if different
