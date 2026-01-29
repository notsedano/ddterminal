# Frontend Configuration Guide

This guide explains how to configure the frontend to connect to your elizaOS backend.

## Configuration Methods

The frontend supports **three ways** to configure the connection, in order of priority:

1. **Runtime Configuration** (highest priority) - via `window.ELIZA_CONFIG` in HTML
2. **Environment Variables** - via `.env` file
3. **Default Values** (lowest priority) - hardcoded fallbacks

## Required Settings

### 1. Backend API URL

**Production Backend:**
```
https://3a6615a6-aeris-agent.containers.elizacloud.ai
```

**Development Backend (if running locally):**
```
http://localhost:3000
```

### 2. Agent ID

**test-dd Agent ID:**
```
71196e85-8a16-0910-98e5-e2d2ee3018db
```

## Configuration Options

### Option 1: Environment Variables (Recommended for Development)

Create a `.env` file in the project root:

```env
# Backend API Base URL
VITE_API_BASE=https://3a6615a6-aeris-agent.containers.elizacloud.ai

# Agent ID to chat with (test-dd)
VITE_AGENT_ID=71196e85-8a16-0910-98e5-e2d2ee3018db

# WebSocket URL (optional, defaults to API base URL)
VITE_WS_URL=https://3a6615a6-aeris-agent.containers.elizacloud.ai

# Optional: API Auth Token (if backend has ELIZA_SERVER_AUTH_TOKEN set)
# VITE_AUTH_TOKEN=your-auth-token-here
```

**Note:** The code supports both `VITE_API_BASE` and `VITE_API_BASE_URL` for backward compatibility.

### Option 2: Runtime Configuration (Recommended for Production)

Add configuration directly in `index.html` before the app script:

```html
<script>
  window.ELIZA_CONFIG = {
    apiBase: 'https://3a6615a6-aeris-agent.containers.elizacloud.ai',
    agentId: '71196e85-8a16-0910-98e5-e2d2ee3018db',
  };
  
  // Optional: Auth token (alternative to window.ELIZA_AUTH_TOKEN)
  window.ELIZA_CONFIG.authToken = 'your-token-here';
  
  // Or use separate variable:
  // window.ELIZA_AUTH_TOKEN = 'your-token-here';
</script>
<script type="module" src="/src/main.tsx"></script>
```

**Benefits:**
- No need to rebuild when changing configuration
- Can be injected by deployment scripts
- Works with static hosting (Vercel, Netlify, etc.)

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_BASE` | Backend API base URL | Yes | - |
| `VITE_API_BASE_URL` | Alternative name for API base (backward compat) | No | - |
| `VITE_AGENT_ID` | UUID of the agent to chat with | Yes | - |
| `VITE_WS_URL` | WebSocket URL (usually same as API base) | No | Uses API base |
| `VITE_AUTH_TOKEN` | Bearer token for authenticated requests | No | - |

## API Endpoints Used

The frontend uses these elizaOS API endpoints:

- `GET /api/agents` - List all agents
- `GET /api/agents/{agentId}` - Get agent details
- `GET /api/agents/{agentId}/panels` - Get plugin UI panels
- `POST /api/messaging/sessions` - Create conversation session
- `GET /api/messaging/sessions/{sessionId}` - Get session details
- `GET /api/messaging/sessions/{sessionId}/messages` - Get message history
- `POST /api/messaging/sessions/{sessionId}/messages` - Send message to agent
- `DELETE /api/messaging/sessions/{sessionId}` - End session
- `WebSocket /ws` - Real-time message updates (Socket.IO)

## Finding Your Agent ID

To find the correct agent ID for your backend:

```bash
curl https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents
```

Look for the agent with `name: "test-dd"` and use its `id` field.

## Authentication

If your backend has `ELIZA_SERVER_AUTH_TOKEN` set, include the token:

**Via .env:**
```env
VITE_AUTH_TOKEN=your-token-here
```

**Via Runtime Config:**
```javascript
window.ELIZA_AUTH_TOKEN = 'your-token-here';
// or
window.ELIZA_CONFIG = {
  authToken: 'your-token-here',
  // ... other config
};
```

The token will be automatically included in API requests as:
```
Authorization: Bearer your-token-here
```

## Verification

After configuration, verify the connection:

1. Start the dev server: `npm run dev`
2. Open browser console
3. Check for any connection errors
4. Try creating a session - it should appear in the sidebar

## Troubleshooting

**Issue: API calls return 404**
- Check that `VITE_API_BASE` includes the full URL (with `https://`)
- Verify the backend is accessible: `curl https://your-backend/healthz`

**Issue: Agent ID not found**
- Verify the agent ID is a valid UUID
- Check `/api/agents` to confirm the agent exists
- Ensure the agent ID matches exactly (case-sensitive)

**Issue: WebSocket 502 errors**
- This is a backend/infrastructure issue
- See `BACKEND_WEBSOCKET_TROUBLESHOOTING.md` for details
- Frontend will fall back to REST API automatically

**Issue: CORS errors**
- Backend must allow CORS from your frontend domain
- Check backend `CORS_ORIGIN` configuration
