# ElizaOS Agent Daredevil Frontend

Frontend webapp for elizaOS Agent Daredevil - a custom React client for the test-dd-local agent.

## Features

- Real-time chat interface with SSE (Server-Sent Events) streaming
- REST API fallback when SSE is unavailable
- Session management with IndexedDB persistence
- Supabase integration for authenticated users
- Plugin system with Knowledge plugin UI
- Dark mode default theme
- Mobile-responsive design
- WCAG 2.1 AA accessibility

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables (see `.env.example`):
```bash
VITE_API_BASE_URL=https://3a6615a6-aeris-agent.containers.elizacloud.ai
VITE_AGENT_ID=test-dd-local
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS 4.x
- React Query (@tanstack/react-query)
- SSE (Server-Sent Events) for real-time streaming
- IndexedDB (idb) for local storage
- Supabase for authenticated user data

## Architecture

### Chat Communication

The chat system uses a hybrid approach:

1. **Message Sending**: REST API (`POST /api/messaging/sessions/:sessionId/messages`)
2. **Response Streaming**: SSE connection (`GET /agents/:agentId/stream?roomId=:roomId`)
3. **Fallback**: REST API polling when SSE is unavailable

### SSE Events

The frontend handles these SSE event types:
- `chunk` - Streaming text chunks (displayed in real-time)
- `message` - Complete message
- `done` - Stream completion
- `error` - Error events

See `src/utils/sse.ts` for the SSE implementation.

## Project Structure

```
src/
├── components/     # React components
│   ├── chat/       # Chat UI components
│   ├── auth/       # Authentication components
│   └── ...
├── hooks/          # Custom React hooks
│   ├── useChat.ts  # Main chat hook (SSE + REST)
│   └── ...
├── services/       # API and storage services
│   ├── api/        # REST API clients
│   ├── storage/    # IndexedDB storage
│   └── supabase/   # Supabase integration
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
    └── sse.ts      # SSE streaming utility
```

## Deployment

Deploy to Vercel with:
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`

## Configuration

### Runtime Configuration

You can override environment variables at runtime by setting `window.ELIZA_CONFIG`:

```html
<script>
  window.ELIZA_CONFIG = {
    apiBase: 'https://your-api.example.com',
    agentId: 'your-agent-id',
  };
</script>
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API URL | - |
| `VITE_AGENT_ID` | Agent ID | - |
| `VITE_AUTH_TOKEN` | Optional auth token | - |
