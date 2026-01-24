# ElizaOS Agent Daredevil Frontend

Frontend webapp for elizaOS Agent Daredevil - a custom React client for the test-dd-local agent.

## Features

- Real-time chat interface with Socket.IO
- Session management with IndexedDB persistence
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
VITE_WS_URL=wss://3a6615a6-aeris-agent.containers.elizacloud.ai/ws
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
- Socket.IO Client
- IndexedDB (idb)

## Project Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── services/       # API and storage services
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Deployment

Deploy to Vercel with:
- Framework Preset: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
