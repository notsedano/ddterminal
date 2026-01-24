# Backend WebSocket 502 Error - Troubleshooting Guide

## Problem
Frontend is receiving `502 Bad Gateway` errors when attempting to connect to the WebSocket endpoint:
```
WebSocket connection to 'wss://3a6615a6-aeris-agent.containers.elizacloud.ai/ws/?EIO=4&transport=websocket' failed: 
Error during WebSocket handshake: Unexpected response code: 502
```

## Troubleshooting Prompt for Backend Team

**Use this prompt when asking for help or investigating the issue:**

---

### WebSocket 502 Error Investigation

**Context:**
- Frontend application is successfully connecting to REST API endpoints at `https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/*`
- All REST API calls (sessions, messages, agents) are working correctly
- WebSocket connection to `wss://3a6615a6-aeris-agent.containers.elizacloud.ai/ws/` is failing with 502 Bad Gateway

**Error Details:**
- **Endpoint:** `wss://3a6615a6-aeris-agent.containers.elizacloud.ai/ws/`
- **Error Code:** 502 Bad Gateway
- **Transport:** WebSocket (Socket.IO v4)
- **Client Library:** `socket.io-client@4.7.0`

**Connection Attempt:**
```javascript
const socket = io('https://3a6615a6-aeris-agent.containers.elizacloud.ai', {
  path: '/ws',
  transports: ['websocket'],
  reconnection: true,
});
```

**Questions to Investigate:**

1. **Is the WebSocket server running?**
   - Check if Socket.IO server is listening on the `/ws` path
   - Verify the server process is active and healthy
   - Check server logs for WebSocket connection attempts

2. **Is the reverse proxy configured correctly?**
   - Verify nginx/load balancer has WebSocket upgrade headers configured:
     ```nginx
     proxy_http_version 1.1;
     proxy_set_header Upgrade $http_upgrade;
     proxy_set_header Connection "upgrade";
     proxy_set_header Host $host;
     proxy_set_header X-Real-IP $remote_addr;
     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     proxy_set_header X-Forwarded-Proto $scheme;
     ```
   - Check if the proxy timeout is sufficient for WebSocket connections
   - Verify the `/ws` path is properly routed to the Socket.IO server

3. **Is the path correct?**
   - Confirm the Socket.IO server is mounted at `/ws` (not `/socket.io` or another path)
   - Check if there's a path mismatch between server configuration and client connection

4. **Are there CORS or security issues?**
   - Verify CORS allows WebSocket connections from the frontend origin
   - Check if there are firewall rules blocking WebSocket upgrade requests
   - Verify SSL/TLS certificates are valid for WebSocket connections

5. **Container/Infrastructure Issues:**
   - Check if the container has proper port mappings for WebSocket
   - Verify network policies allow WebSocket traffic
   - Check if there are resource limits causing connection failures
   - Review container logs for WebSocket-related errors

**Expected Behavior:**
- Client connects to `wss://3a6615a6-aeris-agent.containers.elizacloud.ai/ws/`
- Server responds with `101 Switching Protocols`
- Connection established, client can emit `join` events and receive `message` events

**Current Behavior:**
- Client attempts connection
- Server/proxy responds with `502 Bad Gateway`
- Connection never establishes

**Additional Context:**
- REST API endpoints work perfectly (sessions, messages, agents)
- Only WebSocket connections are failing
- Frontend falls back to REST API for messaging, but real-time features are unavailable

**Logs to Check:**
- Backend server logs (look for WebSocket connection attempts)
- Reverse proxy/load balancer logs (nginx, etc.)
- Container orchestration logs (if using Kubernetes/Docker)
- Network/firewall logs

**Quick Test:**
Try connecting with a simple test script:
```javascript
const io = require('socket.io-client');
const socket = io('https://3a6615a6-aeris-agent.containers.elizacloud.ai', {
  path: '/ws',
  transports: ['websocket']
});

socket.on('connect', () => {
  console.log('Connected!');
  socket.emit('join', {
    agentId: '71196e85-8a16-0910-98e5-e2d2ee3018db',
    roomId: 'test-room'
  });
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

---

## Quick Diagnostic Commands

**Test WebSocket endpoint directly:**
```bash
# Using wscat (install: npm install -g wscat)
wscat -c wss://3a6615a6-aeris-agent.containers.elizacloud.ai/ws/

# Using curl to test upgrade
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  https://3a6615a6-aeris-agent.containers.elizacloud.ai/ws/
```

**Check if endpoint is accessible:**
```bash
# Test if the path exists
curl -I https://3a6615a6-aeris-agent.containers.elizacloud.ai/ws/
```

## Common Solutions

1. **If using nginx reverse proxy:**
   - Add WebSocket upgrade configuration (see above)
   - Increase `proxy_read_timeout` for long-lived connections
   - Ensure `proxy_buffering` is off for WebSocket

2. **If using elizaOS Cloud:**
   - Check elizaOS Cloud dashboard for WebSocket configuration
   - Verify the deployment has WebSocket support enabled
   - Check if there are any service limits on WebSocket connections

3. **If using Docker/Kubernetes:**
   - Verify port mappings include WebSocket port
   - Check service mesh configuration (Istio, Linkerd, etc.)
   - Review ingress controller WebSocket settings

4. **If Socket.IO path is different:**
   - Check elizaOS server configuration for the actual Socket.IO path
   - Update frontend to match: `path: '/actual-path'`

## Next Steps

1. Share this troubleshooting guide with the backend/infrastructure team
2. Request access to backend logs to see what's happening on connection attempts
3. Verify the WebSocket endpoint configuration matches the frontend expectations
4. Test WebSocket connection from a simple Node.js script to isolate frontend vs backend issues
