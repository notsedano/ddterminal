# Backend Multi-Part Prediction Configuration

## Critical Issue: Backend Responding After Part 1

The frontend sends prediction requests in 3 parts, but the backend is responding after Part 1 instead of waiting for all 3 parts.

## Frontend Behavior

The frontend sends 3 sequential messages with metadata:

**Part 1:**
```json
{
  "content": "🎯 PREDICTION REQUEST - PART 1/3: SPORTS DATA\n\n⚠️ DO NOT RESPOND YET...",
  "transport": "sse",
  "metadata": {
    "action": "predict",
    "partNumber": 1,
    "totalParts": 3,
    "context": { ... }
  }
}
```

**Part 2:**
```json
{
  "content": "🎯 PREDICTION REQUEST - PART 2/3: MARKET DATA\n\n⚠️ DO NOT RESPOND YET...",
  "transport": "sse",
  "metadata": {
    "action": "predict",
    "partNumber": 2,
    "totalParts": 3,
    "context": { ... }
  }
}
```

**Part 3:**
```json
{
  "content": "🎯 PREDICTION REQUEST - PART 3/3: ANALYSIS INSTRUCTIONS\n\n✅ ALL 3 PARTS RECEIVED - BEGIN YOUR ANALYSIS NOW...",
  "transport": "sse",
  "metadata": {
    "action": "predict",
    "partNumber": 3,
    "totalParts": 3,
    "context": { ... }
  }
}
```

## Required Backend Behavior

### 1. Detect Multi-Part Messages
- Check for `metadata.partNumber` and `metadata.totalParts`
- If `totalParts > 1`, this is a multi-part message

### 2. Accumulate Parts
- Store all parts in session context
- Wait until `partNumber === totalParts` before processing
- Accumulate content from all parts: `part1Content + part2Content + part3Content`

### 3. Only Respond After Part 3
- **DO NOT** send SSE events (thought, chunk, message) until Part 3 is received
- After Part 1: Acknowledge receipt but do NOT generate response
- After Part 2: Acknowledge receipt but do NOT generate response  
- After Part 3: Process all accumulated content and generate full response

### 4. SSE Stream Management
- Keep SSE stream open for all 3 parts (same sessionId)
- Or: Close stream after each part but accumulate context in session
- When Part 3 arrives, open new SSE stream and send complete response

## Implementation Options

### Option A: Single SSE Stream (Recommended)
- Keep stream open across all 3 parts
- Send acknowledgment events for Parts 1 and 2:
  ```
  event: part_received
  data: {"partNumber": 1, "totalParts": 3, "status": "waiting"}
  ```
- Only send `thought`, `chunk`, `message`, `done` events after Part 3

### Option B: Session Context Accumulation
- Close stream after each part
- Store accumulated content in session context
- When Part 3 arrives, process all accumulated content
- Open new SSE stream and send complete response

## Message Content Instructions

The frontend messages explicitly instruct the backend:

**Part 1 & 2:** "⚠️ DO NOT RESPOND YET"
**Part 3:** "✅ ALL 3 PARTS RECEIVED - BEGIN YOUR ANALYSIS NOW"

The backend should respect these instructions and wait for Part 3.

## Testing

1. Send Part 1 → Backend should acknowledge but NOT respond
2. Send Part 2 → Backend should acknowledge but NOT respond
3. Send Part 3 → Backend should process all 3 parts and generate complete response

## Current Problem

The backend is currently responding after Part 1, which results in incomplete predictions. The backend needs to be configured to wait for all 3 parts before generating a response.
