# Plan Review & Implementation Analysis
## Frontend Webapp Integration for elizaOS Agent Daredevil

**Date**: 2024  
**Reviewer**: AI Assistant  
**Status**: Pre-Implementation Analysis

---

## 1. Goal Clarification

### What Needs to Be Built

A **standalone React web application** that serves as a custom client interface for the elizaOS "test-dd-local" agent (Agent Daredevil). This is **not** using the official `@elizaos/client` package, requiring a custom implementation of all client-side functionality.

### Why It's Needed

1. **Custom Client Requirements**: Need full control over UI/UX without constraints of official client
2. **Vercel Deployment**: Separate frontend deployment from backend (elizaOS Cloud)
3. **Plugin-Specific UIs**: Custom interfaces for Knowledge plugin (file uploads) and Sportradar plugin (NBA data)
4. **Mobile-First Design**: Optimized experience for iOS/Android browsers
5. **Production Environment**: Live backend at `https://3a6615a6-aeris-agent.containers.elizacloud.ai/`

### Core Deliverables

- ✅ Chat interface with real-time message streaming
- ✅ Plugin-specific UI panels (Knowledge, Sportradar)
- ✅ Conversation management and persistence
- ✅ Mobile-responsive design (iOS/Android)
- ✅ Dark mode default theme
- ✅ WCAG 2.1 AA accessibility compliance
- ✅ Vercel deployment with dev/prod environment separation

---

## 2. Constraints, Dependencies, and Edge Cases

### Technical Constraints

#### Backend Constraints
- **Backend URL**: Fixed production URL `https://3a6615a6-aeris-agent.containers.elizacloud.ai/`
- **Agent ID**: `test-dd-local` (may need dynamic resolution - see Unknowns)
- **API Base Path**: `/api` prefix required
- **CORS**: Must be configured on backend for Vercel domain
- **Authentication**: Unknown if required (see Unknowns)

#### Frontend Constraints
- **No Official Client**: Cannot use `@elizaos/client` - must build custom API client
- **Vite Build**: Must output to `dist/frontend` for Vercel
- **Environment Variables**: Must use `VITE_*` prefix (Vite requirement)
- **React 18+**: Modern React features required (hooks, concurrent features)
- **TypeScript**: Full type safety required

#### Deployment Constraints
- **Vercel Framework Preset**: Must use Vite preset
- **Build Command**: `npm run build` or `bun run build`
- **Output Directory**: `dist/frontend` (non-standard - verify)
- **Environment Variables**: Must be set in Vercel dashboard

### Dependencies

#### Core Dependencies (Required)
```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "typescript": "^5.0.0",
  "vite": "^5.0.0",
  "@tanstack/react-query": "^5.0.0",
  "tailwindcss": "^4.0.0"
}
```

#### Additional Dependencies (Likely Needed)
- **Socket.IO Client**: `socket.io-client` ⚠️ **REQUIRED** (elizaOS uses Socket.IO, not native WebSocket)
- **Markdown Rendering**: `react-markdown` or `marked` + `DOMPurify`
- **Date Formatting**: `date-fns` or `dayjs`
- **Storage**: Native `localStorage`/`IndexedDB` or `idb` library
- **PDF Export**: `jspdf` or `pdfkit`
- **Form Handling**: Native or `react-hook-form`
- **Icons**: `lucide-react` or `heroicons`
- **HTTP Client**: `axios` or native `fetch` (recommend axios for interceptors)

#### Backend Dependencies (External)
- elizaOS server running on elizaOS Cloud
- Agent "test-dd-local" configured and deployed
- Plugins installed: `@elizaos/plugin-knowledge`, `@elizaos/plugin-sportradar`

### Edge Cases

#### Network & Connectivity
1. **Offline State**: User loses connection mid-conversation
   - **Solution**: Queue messages locally, sync on reconnect
   - **Storage**: Use IndexedDB for offline queue

2. **Partial Message Streaming**: WebSocket disconnects during stream
   - **Solution**: Store partial message, resume on reconnect or fetch full message via REST

3. **Slow Network**: Large message payloads timeout
   - **Solution**: Implement request timeout (30s), show retry UI

4. **CORS Errors**: Backend not configured for Vercel domain
   - **Solution**: Verify CORS headers, may need proxy in development

#### Data Synchronization
5. **Client/Server State Mismatch**: Local storage out of sync with server
   - **Solution**: Last-write-wins or merge strategy, conflict resolution UI

6. **Concurrent Conversations**: Multiple tabs open
   - **Solution**: BroadcastChannel API or localStorage events for sync

7. **Message Ordering**: Messages arrive out of order
   - **Solution**: Timestamp-based sorting, sequence numbers if available

#### Plugin-Specific Edge Cases
8. **Knowledge Plugin**: Large file uploads (>10MB)
   - **Solution**: Chunked upload, progress tracking, file size limits

9. **Knowledge Plugin**: Upload fails mid-transfer
   - **Solution**: Resume capability or clear error, allow retry

10. **Sportradar Plugin**: No live games available
    - **Solution**: Graceful empty state, show historical data or schedule

11. **Plugin Panel**: Plugin not loaded/available
    - **Solution**: Dynamic plugin detection, hide unavailable panels

#### UI/UX Edge Cases
12. **Mobile Keyboard**: Input field hidden by virtual keyboard
   - **Solution**: Scroll to input on focus, use `visualViewport` API

13. **Long Messages**: Agent response exceeds viewport
   - **Solution**: Expandable/collapsible messages, max-height with scroll

14. **Rapid Message Sending**: User sends multiple messages quickly
   - **Solution**: Debounce or disable input during processing

15. **Dark/Light Mode Toggle**: Flash of wrong theme on load
   - **Solution**: Load theme preference before render, use CSS variables

#### Error States
16. **Agent Unavailable**: Backend returns 503/504
   - **Solution**: Retry with exponential backoff, show status indicator

17. **Rate Limiting**: 429 Too Many Requests
   - **Solution**: Show rate limit message, disable input, countdown timer

18. **Invalid Agent ID**: 404 Not Found
   - **Solution**: Agent ID resolution fallback, error message with agent list

19. **WebSocket Connection Failure**: Cannot establish WS connection
   - **Solution**: Fallback to polling, show connection status

---

## 3. Research: Existing Patterns, APIs, and Libraries

### elizaOS API Research

#### ✅ **VERIFIED**: Actual API Documentation Provided

The actual elizaOS API structure has been verified. The plan's assumed endpoints were **incorrect**. Actual API structure:

**Base URLs:**
- Production API: `https://3a6615a6-aeris-agent.containers.elizacloud.ai/api`
- WebSocket: `wss://3a6615a6-aeris-agent.containers.elizacloud.ai/ws` (Socket.IO)

**Key Differences from Plan:**
1. ❌ Plan assumed: `/api/agent/{agentId}/messages`
   ✅ Actual: `/api/messaging/sessions/{sessionId}/messages`

2. ❌ Plan assumed: `/api/agent/{agentId}/conversations`
   ✅ Actual: `/api/messaging/sessions` (sessions, not conversations)

3. ❌ Plan assumed: Native WebSocket
   ✅ Actual: Socket.IO (requires `socket.io-client` library)

4. ✅ Plan assumed: `/api/agent/{agentId}` 
   ✅ Actual: `/api/agents/:agentId` (correct path, different structure)

**Verified Endpoints:**
```
GET  /api/agents                    - List all agents
GET  /api/agents/:agentId           - Get agent details
GET  /api/agents/:agentId/panels    - Get plugin UI panels
POST /api/messaging/sessions        - Create session
GET  /api/messaging/sessions/:sessionId/messages - Get messages
POST /api/messaging/sessions/:sessionId/messages - Send message
```

#### Recommended API Client Pattern

Based on React Query best practices and **actual elizaOS API**:

```typescript
// services/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL + '/api',
  headers: { 
    'Content-Type': 'application/json',
    // Add auth if required:
    // 'Authorization': `Bearer ${getAuthToken()}`
  }
});

// React Query hooks - CORRECTED for actual API
const useSendMessage = () => {
  return useMutation({
    mutationFn: (data: { sessionId: string; text: string; userId: string }) => 
      apiClient.post(`/messaging/sessions/${data.sessionId}/messages`, {
        text: data.text,
        userId: data.userId
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages']);
    }
  });
};

const useCreateSession = () => {
  return useMutation({
    mutationFn: (data: { agentId: string; userId: string; channelId: string }) =>
      apiClient.post('/messaging/sessions', data),
  });
};
```

#### WebSocket Pattern (Socket.IO - VERIFIED)

**elizaOS uses Socket.IO, not native WebSocket**

```typescript
// services/websocket/socketClient.ts
import { io, Socket } from 'socket.io-client';

class ElizaSocketClient {
  private socket: Socket | null = null;
  private url: string;
  
  constructor(url: string) {
    this.url = url;
  }
  
  connect(agentId: string, roomId: string) {
    this.socket = io(this.url, {
      path: '/ws',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });
    
    // Join agent room
    this.socket.emit('join', {
      agentId,
      roomId
    });
    
    return this.socket;
  }
  
  sendMessage(agentId: string, text: string, userId: string, roomId: string) {
    if (!this.socket) throw new Error('Socket not connected');
    
    this.socket.emit('message', {
      agentId,
      text,
      userId,
      roomId
    });
  }
  
  onMessage(callback: (data: any) => void) {
    this.socket?.on('message', callback);
  }
  
  onTyping(callback: (data: any) => void) {
    this.socket?.on('typing', callback);
  }
  
  onError(callback: (error: any) => void) {
    this.socket?.on('error', callback);
  }
  
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
```

**Required Dependency:**
```json
{
  "socket.io-client": "^4.7.0"
}
```

#### Storage Pattern

**Hybrid Storage Strategy**:
```typescript
// IndexedDB for large data, localStorage for preferences
class ConversationStorage {
  private db: IDBDatabase;
  
  async saveConversation(conversation: Conversation) {
    // Use IndexedDB for conversations (can be large)
    const tx = this.db.transaction('conversations', 'readwrite');
    await tx.objectStore('conversations').put(conversation);
  }
  
  getThemePreference(): 'dark' | 'light' {
    // Use localStorage for simple preferences
    return localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
  }
}
```

#### Plugin UI Pattern

**Dynamic Plugin Registration**:
```typescript
interface PluginUI {
  id: string;
  name: string;
  component: React.ComponentType;
  icon: React.ReactNode;
}

const pluginRegistry = new Map<string, PluginUI>();

function registerPlugin(plugin: PluginUI) {
  pluginRegistry.set(plugin.id, plugin);
}

// Usage in UI
function PluginPanel() {
  const plugins = Array.from(pluginRegistry.values());
  return (
    <Tabs>
      {plugins.map(plugin => (
        <Tab key={plugin.id} label={plugin.name}>
          <plugin.component />
        </Tab>
      ))}
    </Tabs>
  );
}
```

### React Patterns

#### Message Streaming with React Query
```typescript
function useStreamingMessage(messageId: string) {
  const [streamedText, setStreamedText] = useState('');
  
  useEffect(() => {
    const ws = new WebSocket(`${wsUrl}/message/${messageId}`);
    ws.onmessage = (event) => {
      const chunk = JSON.parse(event.data);
      if (chunk.type === 'token') {
        setStreamedText(prev => prev + chunk.text);
      }
    };
    return () => ws.close();
  }, [messageId]);
  
  return streamedText;
}
```

#### Optimistic Updates
```typescript
const useSendMessage = () => {
  return useMutation({
    mutationFn: sendMessage,
    onMutate: async (newMessage) => {
      // Optimistically add message to UI
      await queryClient.cancelQueries(['messages']);
      const previous = queryClient.getQueryData(['messages']);
      queryClient.setQueryData(['messages'], (old) => [...old, newMessage]);
      return { previous };
    },
    onError: (err, newMessage, context) => {
      // Rollback on error
      queryClient.setQueryData(['messages'], context.previous);
    }
  });
};
```

### Mobile Patterns

#### Viewport Handling
```typescript
// Handle mobile keyboard
useEffect(() => {
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      // Scroll input into view
      inputRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }
}, []);
```

#### Touch Gestures
```typescript
// Swipe to delete message
import { useSwipeable } from 'react-swipeable';

const handlers = useSwipeable({
  onSwipedLeft: () => deleteMessage(messageId),
  trackMouse: true
});
```

---

## 4. Architecture and Data Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel Frontend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   React App  │  │  React Query │  │   WebSocket  │  │
│  │   (UI Layer) │  │  (State Mgmt)│  │   (Streaming)│  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│  ┌──────▼──────────────────▼──────────────────▼──────┐  │
│  │           Custom API Client Layer                 │  │
│  │  (services/api/* - REST + WebSocket wrappers)     │  │
│  └───────────────────────┬───────────────────────────┘  │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │ HTTPS/WSS
                           ▼
┌─────────────────────────────────────────────────────────┐
│              elizaOS Cloud Backend                        │
│  https://3a6615a6-aeris-agent.containers.elizacloud.ai  │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  REST API    │  │  WebSocket   │  │   Plugins    │  │
│  │  /api/*      │  │  /ws         │  │  Knowledge   │  │
│  └──────────────┘  └──────────────┘  │  Sportradar  │  │
│                                       └──────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
App.tsx
├── MainLayout.tsx
│   ├── Header.tsx (theme toggle, agent info)
│   ├── Sidebar.tsx (conversation list, plugin panels)
│   └── ChatContainer.tsx
│       ├── MessageList.tsx
│       │   └── MessageBubble.tsx (x N messages)
│       ├── MessageInput.tsx
│       └── TypingIndicator.tsx
└── PluginPanel.tsx
    ├── KnowledgePluginUI.tsx
    └── SportradarPluginUI.tsx
```

### Data Flow: Sending a Message (CORRECTED)

```
1. User types message → MessageInput.tsx
   │
2. User presses Enter → handleSubmit()
   │
3. Check if session exists → useConversation hook
   │   If no session → POST /api/messaging/sessions
   │   Create: { agentId, userId, channelId }
   │
4. useChat hook → sendMessage()
   │
5. React Query mutation → POST /api/messaging/sessions/{sessionId}/messages
   │   Body: { text, userId }
   │
6. Socket.IO connection → Listen for 'message' events
   │
7. Backend processes → Emits 'message' event via Socket.IO
   │
8. useSocket hook → Updates message state with streaming data
   │
9. MessageList re-renders → Shows streaming text
   │
10. Stream completes → Final message saved
   │
11. LocalStorage/IndexedDB → Persist message
   │
12. React Query cache → Update messages query
```

### Data Flow: Loading Session History (CORRECTED)

```
1. App mounts → useConversation hook
   │
2. Check localStorage → Load cached sessions
   │
3. React Query → GET /api/messaging/sessions?userId={userId}
   │   (Note: Endpoint may need verification - sessions might be stored client-side)
   │
4. Backend returns → { sessions: Session[] } (if endpoint exists)
   │   OR: Load from localStorage only
   │
5. Merge strategy → Server data takes precedence (if available)
   │
6. Update React Query cache → Available to all components
   │
7. Sidebar renders → Shows session list
   │
8. User selects session → GET /api/messaging/sessions/{sessionId}/messages
   │
9. Messages loaded → Display in MessageList
   │
10. Connect Socket.IO → Join room for real-time updates
```

### Data Flow: Knowledge Plugin File Upload

```
1. User drags file → KnowledgePluginUI.tsx
   │
2. File validation → Check type, size
   │
3. Query plugin panels → GET /api/agents/{agentId}/panels
   │   Returns: Available plugin UI components and endpoints
   │
4. Create FormData → Append file
   │
5. POST to plugin-specific endpoint (from panels response)
   │   OR: Plugin may handle via agent message with file attachment
   │
6. Backend processes → Returns upload status
   │
7. Progress tracking → Update UI with percentage
   │
8. Upload complete → Refresh document list
   │
9. Query plugin for documents → Use plugin-specific endpoint
   │   OR: Query agent memory → GET /api/agents/{agentId}/memory
   │
10. Display documents → Show metadata, delete options
```

### State Management Architecture

#### React Query (Server State)
- **Messages**: `['messages', agentId, conversationId]`
- **Conversations**: `['conversations', agentId]`
- **Agent Info**: `['agent', agentId]`
- **Knowledge Documents**: `['knowledge', agentId]`
- **Sportradar Data**: `['sportradar', agentId, type]`

#### Local State (Client State)
- **Current Conversation ID**: `useState<string | null>`
- **Input Text**: `useState<string>`
- **Theme Preference**: `localStorage` + `useState`
- **UI State**: Modal open/close, sidebar collapsed, etc.

#### Persistent Storage (Hybrid)
- **Conversations**: IndexedDB (large data)
- **Messages**: IndexedDB (can be many)
- **Preferences**: localStorage (small, fast)
- **Cache**: React Query with persistence plugin

### Socket.IO Event Flow (VERIFIED)

```
Socket.IO Connection Established
│
├─→ Client emits: 'join'
│   Body: { agentId, roomId }
│   └─→ Server confirms room join
│
├─→ Server emits: 'connected'
│   └─→ Update connection status indicator
│
├─→ Client emits: 'message'
│   Body: { agentId, text, userId, roomId }
│   └─→ Server processes message
│
├─→ Server emits: 'typing'
│   └─→ Show typing indicator
│
├─→ Server emits: 'message' (response)
│   Body: { text, userId, agentId, ... }
│   └─→ Update message in UI (may be streaming)
│
├─→ Server emits: 'status'
│   └─→ Update agent status (processing, idle, etc.)
│
└─→ Server emits: 'error'
    └─→ Show error message, handle gracefully
    └─→ Socket.IO auto-reconnects (configured)
```

---

## 5. Unknowns and Risks

### Critical Unknowns (Block Implementation)

#### 1. **elizaOS API Structure** ✅ RESOLVED
- **Status**: API documentation provided and verified
- **Actual Endpoints**: 
  - Sessions API: `/api/messaging/sessions`
  - Agents API: `/api/agents/:agentId`
  - WebSocket: Socket.IO at `/ws`
- **Action**: Update implementation to use correct endpoints

#### 2. **WebSocket Protocol** ✅ RESOLVED
- **Status**: Socket.IO protocol documented
- **Events**: `join`, `message`, `typing`, `status`, `error`, `connected`
- **Required Library**: `socket.io-client`
- **Action**: Implement Socket.IO client with proper event handling

#### 3. **Agent ID Resolution** ✅ RESOLVED
- **Status**: Agent ID format confirmed
- **Target Agent**: `"test-dd-local"` (string format)
- **Verification**: Query `GET /api/agents` to list all agents
- **Action**: Implement agent listing and selection if needed

#### 4. **Authentication Requirements** ⚠️ CONDITIONAL RISK
- **Status**: Conditional authentication
- **Requirement**: Only if `ENABLE_DATA_ISOLATION=true` on backend
- **Method**: JWT Bearer token in Authorization header
- **Action**: 
  - Test without auth first
  - Implement auth if backend requires it
  - Check `/api/system/config` for isolation settings

#### 5. **Knowledge Plugin API** ⚠️ PARTIALLY RESOLVED
- **Status**: Plugin panels endpoint available
- **Endpoint**: `GET /api/agents/:agentId/panels` returns plugin UI info
- **Unknown**: Specific file upload endpoint format
- **Action**: 
  - Query panels endpoint to discover plugin routes
  - Plugins may mount at root (e.g., `/helloworld`)
  - May need to test or inspect plugin source code

#### 6. **CORS Configuration** ⚠️ MEDIUM RISK
- **Unknown**: Is backend configured for Vercel domain CORS?
- **Risk**: Browser blocks all API requests
- **Impact**: App unusable in production
- **Mitigation**:
  - Test CORS headers from backend
  - May need backend configuration change
  - Consider proxy in development

#### 7. **Message Format** ⚠️ PARTIALLY RESOLVED
- **Status**: API structure known, exact types need verification
- **Known**: Uses Sessions instead of Conversations
- **Action**: 
  - Test actual API responses to define TypeScript types
  - Create type definitions from real data
  - Use type guards for runtime validation

#### 8. **Streaming Format** ✅ RESOLVED
- **Status**: Socket.IO confirmed for real-time updates
- **Method**: Socket.IO events, not SSE
- **Events**: `message` event contains response data
- **Action**: Implement Socket.IO message handling for streaming

### Technical Risks

#### 9. **Vercel Build Output** ⚠️ LOW RISK
- **Unknown**: Why output directory is `dist/frontend` (non-standard)
- **Risk**: Build may fail or deploy incorrectly
- **Mitigation**: Verify Vite config, test build locally

#### 10. **IndexedDB Browser Support** ⚠️ LOW RISK
- **Risk**: Older browsers may not support IndexedDB
- **Mitigation**: Use polyfill or fallback to localStorage

#### 11. **WebSocket Reconnection** ⚠️ MEDIUM RISK
- **Risk**: Complex reconnection logic may have bugs
- **Mitigation**: Use library like `reconnecting-websocket`, extensive testing

#### 12. **Mobile Performance** ⚠️ MEDIUM RISK
- **Risk**: Large message history may cause performance issues on mobile
- **Mitigation**: Virtual scrolling, pagination, lazy loading

### Business/Product Risks

#### 13. **Backend Availability** ⚠️ HIGH RISK
- **Risk**: Backend URL may change, service may go down
- **Impact**: App becomes unusable
- **Mitigation**: 
  - Environment variable configuration
  - Health check endpoint
  - Error handling with retry logic

#### 14. **Plugin Compatibility** ⚠️ MEDIUM RISK
- **Risk**: Plugins may not be installed or configured correctly
- **Impact**: Plugin UIs show errors or don't work
- **Mitigation**: 
  - Graceful degradation
  - Plugin availability detection
  - Error boundaries

#### 15. **Rate Limiting** ⚠️ MEDIUM RISK
- **Risk**: Backend may rate limit, breaking user experience
- **Impact**: Users cannot send messages
- **Mitigation**: 
  - Client-side rate limiting
  - Clear error messages
  - Retry with backoff

---

## 6. Clarifying Questions

### Resolved Questions ✅

1. ✅ **API Verification**: API documentation provided and verified
2. ✅ **Authentication**: Conditional - JWT Bearer token if `ENABLE_DATA_ISOLATION=true`
3. ✅ **Agent ID**: `"test-dd-local"` confirmed, can verify via `/api/agents`
4. ✅ **WebSocket URL**: Socket.IO at `/ws` path, requires `socket.io-client`
5. ⚠️ **Knowledge Plugin**: Query `/api/agents/:agentId/panels` for plugin routes
6. ⚠️ **Message Format**: Need to test actual responses to define types
7. ⚠️ **CORS**: Must be configured on backend for Vercel domain
8. ✅ **Streaming**: Socket.IO confirmed (not SSE)
9. ⚠️ **Error Responses**: Standard HTTP codes documented, format needs testing
10. ⚠️ **Vercel Output**: `dist/frontend` needs verification - may be `dist`

### Remaining Questions

1. **Session Management**: How are sessions stored/retrieved? Is there a `GET /api/messaging/sessions` endpoint or only client-side storage?

2. **Message Streaming**: Does the Socket.IO `message` event stream tokens incrementally, or send complete messages?

3. **Plugin Panels Response**: What is the exact structure of `/api/agents/:agentId/panels` response?

4. **File Upload**: What is the exact endpoint and format for Knowledge plugin file uploads?

5. **CORS Configuration**: Is the backend already configured for CORS, or does it need to be set up?

### Nice to Have

11. **Plugin API**: Do plugins expose their own API endpoints, or are they accessed through the main agent API?

12. **Conversation Limits**: Are there limits on conversation length, message count, or storage?

13. **File Upload Limits**: What are the size and type restrictions for knowledge plugin uploads?

14. **Real-time Updates**: How frequently should Sportradar data be refreshed?

15. **Offline Mode**: Should the app support offline message queuing, or fail gracefully when offline?

---

## 7. Recommended Implementation Approach

### Phase 0: API Verification (UPDATED - Do First)

**API documentation provided, now verify implementation details:**

1. **Backend Connectivity Testing**
   ```bash
   # Health check
   curl https://3a6615a6-aeris-agent.containers.elizacloud.ai/healthz
   
   # System config
   curl https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/system/config
   
   # List agents (may need auth)
   curl https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/agents
   ```

2. **Test Actual API Responses**
   - Create test session: `POST /api/messaging/sessions`
   - Send test message: `POST /api/messaging/sessions/{id}/messages`
   - Get messages: `GET /api/messaging/sessions/{id}/messages`
   - Document actual response structures

3. **Test Socket.IO Connection**
   - Connect to WebSocket endpoint
   - Test `join`, `message` events
   - Verify message streaming format

4. **Verify Plugin Endpoints**
   - Query: `GET /api/agents/test-dd-local/panels`
   - Document plugin routes and capabilities

5. **Check Authentication**
   - Test without auth headers
   - If 401, implement JWT token handling

6. **Verify CORS**
   - Test from browser console
   - Confirm backend allows Vercel domain

### Phase 1: Foundation (Week 1) - UPDATED

1. **Project Setup**
   - Initialize Vite + React + TypeScript
   - Configure Tailwind CSS 4.x
   - Set up React Query
   - Install `socket.io-client` (required for WebSocket)
   - Create folder structure

2. **API Client (Corrected)**
   - Implement base API client with `/api` prefix
   - Create type definitions from actual API responses
   - Implement Sessions API client (`/api/messaging/sessions`)
   - Implement Agents API client (`/api/agents`)
   - Add conditional JWT auth support
   - Implement error handling
   - Add request/response interceptors

3. **Socket.IO Client**
   - Implement Socket.IO connection manager
   - Handle `join`, `message`, `typing`, `status`, `error` events
   - Implement auto-reconnection logic
   - Create React hook: `useSocket`

4. **Basic Chat UI**
   - Message input component
   - Message list component
   - Basic styling (dark mode)

### Phase 2: Core Features (Week 2) - UPDATED

1. **Session Management**
   - Implement session creation: `POST /api/messaging/sessions`
   - Store session ID in state/localStorage
   - Handle session lifecycle

2. **Message Sending/Receiving**
   - Implement send message: `POST /api/messaging/sessions/{id}/messages`
   - Integrate Socket.IO for real-time responses
   - Basic message display
   - Error handling

3. **Storage Layer**
   - Implement IndexedDB for sessions (not conversations)
   - Implement localStorage for preferences
   - Store session metadata and message history
   - Create storage utilities

4. **Session Management UI**
   - Load sessions on mount (from storage or API if available)
   - Switch between sessions
   - Create new session
   - Session list in sidebar

### Phase 3: Real-Time (Week 3) - UPDATED

1. **Socket.IO Integration**
   - Complete Socket.IO client implementation
   - Handle `join` event on session creation
   - Handle `message` events for agent responses
   - Handle `typing` events for typing indicators
   - Handle `status` events for agent state
   - Handle `error` events gracefully
   - Auto-reconnection (Socket.IO built-in)

2. **Streaming UI**
   - Update message as data arrives via Socket.IO
   - Typing indicators from `typing` events
   - Connection status indicator
   - Handle reconnection states

### Phase 4: Plugins (Week 4) - UPDATED

1. **Plugin System**
   - Query plugin panels: `GET /api/agents/:agentId/panels`
   - Create plugin registry from panels response
   - Implement plugin panel UI
   - Dynamic plugin loading based on available plugins

2. **Knowledge Plugin UI**
   - Query plugin-specific endpoints (from panels)
   - File upload interface (endpoint TBD)
   - Document list (query agent memory or plugin endpoint)
   - Upload progress tracking

3. **Sportradar Plugin UI**
   - Query plugin for NBA data endpoints
   - NBA data display
   - Real-time updates via Socket.IO or polling
   - Interactive elements (click to query agent)

### Phase 5: Polish (Week 5)

1. **Mobile Optimization**
   - Responsive design
   - Touch interactions
   - Viewport handling

2. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - ARIA labels

3. **Performance**
   - Virtual scrolling
   - Code splitting
   - Lazy loading

### Phase 6: Deployment (Week 6)

1. **Vercel Setup**
   - Configure build settings
   - Set environment variables
   - Test deployment

2. **Testing**
   - Unit tests
   - Integration tests
   - E2E tests
   - Mobile device testing

---

## 8. Success Metrics

### Functional Requirements
- ✅ User can send message and receive response
- ✅ Messages stream in real-time
- ✅ Conversation history persists
- ✅ Knowledge plugin file upload works
- ✅ Sportradar plugin displays NBA data
- ✅ App works on iOS and Android

### Non-Functional Requirements
- ✅ Dark mode is default
- ✅ WCAG 2.1 AA compliant
- ✅ Page load < 3 seconds
- ✅ Message send latency < 500ms
- ✅ WebSocket reconnects within 5 seconds
- ✅ Works offline (queues messages)

---

## 9. Conclusion

The plan is **comprehensive but has critical gaps** in API knowledge. The architecture and data flow are well thought out, but **implementation cannot begin until API endpoints are verified**.

### Immediate Next Steps

1. **API Discovery**: Test live backend, document actual endpoints
2. **Answer Clarifying Questions**: Resolve all "Must Answer" questions
3. **Create API Contract**: Document verified API structure
4. **Update Plan**: Revise plan with actual API details
5. **Begin Phase 0**: Start implementation only after API is verified

### Risk Assessment

- **High Risk**: API unknowns could block entire project
- **Medium Risk**: Plugin integration, mobile performance
- **Low Risk**: UI implementation, styling, basic features

**Recommendation**: **API documentation provided - proceed with Phase 0 verification, then begin implementation. Most critical unknowns are resolved.**

---

**End of Review**
