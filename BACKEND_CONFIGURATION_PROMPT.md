# Backend Agent Configuration Prompt

Copy and paste this prompt into your backend IDE editor to configure the agent to work with the frontend:

---

## Configuration Request: Agent "test-dd" SSE Streaming Setup

I need to configure my Eliza agent (ID: `71196e85-8a16-0910-98e5-e2d2ee3018db`) to properly respond to messages via Server-Sent Events (SSE) streaming. The frontend is correctly sending messages, but the agent is not generating responses.

### Current Status
- ✅ Agent receives messages successfully
- ✅ Agent acknowledges with `user_message` event
- ❌ Agent does NOT send `thought`, `chunk`, or `done` events
- ❌ Agent does not generate responses

### API Endpoint Configuration

**Endpoint:** `POST /api/messaging/sessions/:sessionId/messages`

**Request Headers:**
- `Content-Type: application/json`
- `Accept: text/event-stream`
- `Authorization: Bearer {token}` (optional)

**Request Body:**
```json
{
  "content": "User's message text here",
  "transport": "sse"
}
```

**Response:** Must be `text/event-stream` with HTTP 200 status

### Required SSE Event Sequence

The frontend expects the following SSE events in this order:

1. **`user_message`** (already working)
   ```
   event: user_message
   data: {"id":"...","channel_id":"...","author_id":"...","content":"...","created_at":...,"source_type":"user","metadata":{...}}
   ```

2. **`thought`** (optional, for prediction mode)
   ```
   event: thought
   data: {"thought":"Agent's thinking process...","step":"analyzing","progress":50}
   ```

3. **`chunk`** (required for streaming responses)
   ```
   event: chunk
   data: {"chunk":"partial text","messageId":"...","channelId":"...","sessionId":"..."}
   ```

4. **`message`** (required - final complete message)
   ```
   event: message
   data: {"messageId":"...","text":"Complete agent response","userId":"...","agentId":"71196e85-8a16-0910-98e5-e2d2ee3018db","sessionId":"...","channelId":"...","timestamp":"..."}
   ```

5. **`done`** (required - signals completion)
   ```
   event: done
   data: {"text":"Final response text (optional)"}
   ```

### Error Handling

If an error occurs, send:
```
event: error
data: {"error":"Error message here","code":"ERROR_CODE"}
```

### Frontend Expectations

- The frontend uses **regular chat** (REST API) for normal messaging, but can also handle SSE
- The frontend uses **prediction mode** (SSE) for streaming "thought process" responses
- All SSE events must be valid JSON in the `data:` field
- The connection should remain open until `done` event is sent
- If no response is generated, send an error event instead of timing out

### Agent Configuration Requirements

Please ensure:

1. **Agent is active and processing messages**
   - Check if the agent is paused or disabled
   - Verify the agent's message processing pipeline is running

2. **LLM/AI Model is configured**
   - Verify API keys for the LLM provider are set
   - Check if the model is accessible and responding
   - Ensure rate limits or quotas are not exceeded

3. **Character/Prompt Configuration**
   - Verify the agent has a valid character configuration
   - Check if system prompts are properly set
   - Ensure the agent knows how to respond to user messages

4. **SSE Streaming Implementation**
   - Verify the agent's message handler sends SSE events
   - Check that `chunk`, `message`, and `done` events are being emitted
   - Ensure the response stream stays open until completion

5. **Session Management**
   - Verify sessions are being tracked correctly
   - Check that `sessionId` and `channelId` are passed through events
   - Ensure session metadata is included where needed

### Testing

After configuration, test with:
```bash
curl -X POST "https://3a6615a6-aeris-agent.containers.elizacloud.ai/api/messaging/sessions/{sessionId}/messages" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"content":"Hello, can you respond?","transport":"sse"}'
```

Expected output should include:
- `event: user_message` (acknowledgment)
- `event: chunk` (streaming response chunks)
- `event: message` (complete message)
- `event: done` (completion)

### Frontend Connection Details

- **Frontend URL:** `http://localhost:5173` (development)
- **Frontend URL:** `ddterminal.vercel.app` (production)
- **Agent ID:** `71196e85-8a16-0910-98e5-e2d2ee3018db`
- **Backend URL:** `https://3a6615a6-aeris-agent.containers.elizacloud.ai`
- **Proxy:** Frontend uses Vite proxy at `/api/messaging` → backend

### Priority Fixes Needed

1. **CRITICAL:** Agent must generate and stream responses after receiving `user_message`
2. **CRITICAL:** Agent must send `chunk`, `message`, and `done` events
3. **IMPORTANT:** Agent should send `thought` events for prediction mode
4. **IMPORTANT:** Agent should handle errors gracefully with `error` events

Please configure the agent to properly process messages and stream responses via SSE. The frontend is ready and waiting for the agent's responses.

---
