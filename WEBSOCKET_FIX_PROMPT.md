# WebSocket Connection Issue - Backend Fix Required

## Problem Summary

Our frontend application cannot establish WebSocket connections to the elizaOS backend deployed on elizaCloud. The WebSocket handshake is being closed immediately before the connection can be established.

**Backend URL:** `https://3a6615a6-aeris-agent.containers.elizacloud.ai`

## Evidence

### ✅ What Works
- **REST API:** All HTTP endpoints work correctly (`/api/agents`, `/api/messaging/sessions`, etc.)
- **Socket.IO Polling:** HTTP long-polling transport works perfectly
  - Test: `https://3a6615a6-aeris-agent.containers.elizacloud.ai/socket.io/?EIO=4&transport=polling`
  - Returns: Valid Socket.IO handshake with session ID

### ❌ What Fails
- **WebSocket Upgrade:** WebSocket connections fail immediately
  - Error: `WebSocket connection to 'wss://3a6615a6-aeris-agent.containers.elizacloud.ai/socket.io/?EIO=4&transport=websocket' failed: WebSocket is closed before the connection is established`
  - The connection is closed by the reverse proxy before reaching the Socket.IO server

## Root Cause

The elizaCloud reverse proxy (nginx/load balancer) is **not configured to forward WebSocket upgrade headers**. When the browser attempts to upgrade from HTTP polling to WebSocket, the proxy closes the connection instead of forwarding the upgrade request.

## Required Fix

The reverse proxy needs to be configured with WebSocket upgrade support. Here's what needs to be added to the nginx/load balancer configuration:

### Nginx Configuration

```nginx
location /socket.io/ {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    
    # WebSocket upgrade headers (CRITICAL)
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # WebSocket-specific timeouts
    proxy_read_timeout 86400;  # 24 hours for long-lived connections
    proxy_send_timeout 86400;
    
    # Disable buffering for WebSocket
    proxy_buffering off;
}
```

### Key Points

1. **`proxy_set_header Upgrade $http_upgrade;`** - Forwards the WebSocket upgrade request
2. **`proxy_set_header Connection "upgrade";`** - Tells the backend to upgrade the connection
3. **`proxy_http_version 1.1;`** - Required for WebSocket upgrades (HTTP/1.0 doesn't support upgrades)
4. **Long timeouts** - WebSocket connections are persistent, need longer timeouts than HTTP
5. **`proxy_buffering off;`** - Prevents buffering that can break WebSocket frames

## Testing

After the fix is deployed, test with:

```bash
# Test Socket.IO polling (should still work)
curl "https://3a6615a6-aeris-agent.containers.elizacloud.ai/socket.io/?EIO=4&transport=polling"

# Test WebSocket upgrade (should now work)
# Use browser DevTools Network tab to verify WebSocket connection succeeds
```

## Current Workaround

The frontend is currently using HTTP long-polling as a workaround, which works but has:
- Higher latency than WebSocket
- More server overhead (frequent HTTP requests)
- Less efficient for real-time communication

## Impact

- **User Experience:** Messages work but may feel slightly slower
- **Server Load:** Higher due to frequent polling requests
- **Scalability:** Less efficient than WebSocket for high-concurrency scenarios

## Priority

**Medium-High** - The app works via polling, but WebSocket would provide better performance and user experience.

---

## Additional Context

**Frontend Implementation:**
- Using Socket.IO client v4.7.0
- Connecting to: `https://3a6615a6-aeris-agent.containers.elizacloud.ai/socket.io/`
- Path: `/socket.io` (Socket.IO default)
- Transport order: `['polling', 'websocket']` (tries polling first, then upgrades)

**Backend:**
- elizaOS agent: `test-dd-local`
- Agent ID: `71196e85-8a16-0910-98e5-e2d2ee3018db`
- Deployment: elizaCloud containers
