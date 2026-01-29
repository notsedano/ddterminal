# Prediction Feature Analysis & Implementation Plan

## 1. Goal Clarification

### What Needs to Be Built
Fix the "PREDICT NOW" button feature that currently does not work when clicked. The feature should:

1. **Trigger Prediction Flow**: When the button is clicked, it should initiate a prediction request
2. **Send Sports Data**: Package and send comprehensive sports data (matchup, stats, markets, injuries, etc.) to the backend
3. **Display Thought Streaming**: Show real-time "thought process" visualization as the agent analyzes the data
4. **Display Prediction Output**: Show the final prediction result from the agent

### Why It's Needed
The prediction feature is a core functionality that allows users to get AI-powered sports predictions based on comprehensive data analysis. Currently, clicking the button does nothing due to a critical syntax error preventing the prediction handler from executing.

---

## 2. Current State Analysis

### Identified Issues

#### **CRITICAL: Syntax Error (Line 141-142 in ChatContainer.tsx)**
```typescript
} catch (error) {
} catch (error) {  // ❌ DUPLICATE CATCH BLOCK - INVALID SYNTAX
  console.error('[ChatContainer] Failed to send prediction:', error);
  // ... error handling
}
```
**Impact**: This prevents the entire `handleConfirmPrediction` function from being valid JavaScript, causing the prediction flow to fail silently.

#### **Potential Issues**
1. **Session Validation**: The button may be disabled if `sessionId` is null, but there's no user-facing error message
2. **Missing Error Feedback**: If prediction fails, users may not see clear error messages
3. **Data Availability**: No validation that prediction data is available before allowing prediction

### Current Architecture

#### **Data Flow**
```
User clicks "PREDICT NOW" 
  → handlePredictClick() 
    → Shows ConfirmDialog
      → User confirms
        → handleConfirmPrediction()
          → buildComprehensivePredictionMessage() [builds text prompt]
          → sendMessageWithStreaming() [sends to backend with metadata.action='predict']
            → Backend processes with sports data
              → SSE stream returns:
                - thought events (for ThoughtStream UI)
                - chunk events (for streaming message)
                - message event (final prediction)
                - done event (completion)
```

#### **Key Components**

1. **MarketButton** (`src/components/match-panel/MarketButton.tsx`)
   - Renders the "PREDICT NOW" button
   - Receives `onClick` handler from `MessageList`
   - Disabled when `isPredicting || !onPredictClick`

2. **MessageList** (`src/components/chat/MessageList.tsx`)
   - Displays the button and passes `onPredictClick` prop
   - Shows `ThoughtStream` component when `predictionThoughts.length > 0`
   - Button disabled: `disabled={isPredicting || !onPredictClick}`

3. **ChatContainer** (`src/components/chat/ChatContainer.tsx`)
   - Main orchestrator
   - `handlePredictClick()`: Opens confirmation dialog
   - `handleConfirmPrediction()`: **BROKEN** - has duplicate catch block
   - Manages prediction state via `usePrediction()` hook
   - Passes prediction data to `sendMessageWithStreaming()`

4. **usePredictionData** (`src/hooks/usePredictionData.ts`)
   - Aggregates all sports data from multiple sources:
     - Match context (teams, game info)
     - Market data (Polymarket odds, volume, lines)
     - Injuries (from NBA API)
     - Betting indicators (rest days, streaks, H2H)
     - Player stats (top scorers, hot hands)
     - Match history (recent form, standings)
   - `buildComprehensivePredictionMessage()`: Formats all data into a text prompt

5. **usePrediction** (`src/hooks/usePrediction.ts`)
   - Manages thought streaming state
   - `startThoughts()`: Starts UI animation (fake thoughts for visual feedback)
   - `addRealThought()`: Adds real thoughts from backend SSE stream
   - `reset()`: Cleans up state

6. **sendMessageWithStreaming** (`src/services/api/messages.ts`)
   - Sends POST request with `transport: 'sse'`
   - For predictions: includes `metadata.action: 'predict'` and `metadata.context`
   - Handles SSE stream parsing:
     - `event: thought` → calls `onThought` handler
     - `event: chunk` → calls `onChunk` handler
     - `event: message` → calls `onMessage` handler
     - `event: done` → calls `onDone` handler
     - `event: error` → calls `onError` handler

7. **ThoughtStream** (`src/components/chat/ThoughtStream.tsx`)
   - Visualizes thought process with animated bubbles
   - Shows progress bar
   - Collapsible/expandable

---

## 3. Constraints, Dependencies & Edge Cases

### Constraints

1. **Backend Requirements**
   - Must send `metadata.action: 'predict'` to trigger prediction mode
   - Must send `metadata.context` with structured data (matchup, stats, market)
   - Backend must support SSE streaming with `thought` events
   - Backend must process comprehensive sports data

2. **Session Requirements**
   - `sessionId` must be valid (not null)
   - Session must be active/valid on backend
   - If session invalid, must handle gracefully

3. **Data Requirements**
   - `predictionData` can be `null` if no match is selected
   - Some data sources may be loading (`isLoading` states)
   - Some data may be partial (e.g., no injuries, no market data)

4. **UI/UX Constraints**
   - Button should be disabled during prediction (`isPredicting`)
   - Button should be disabled if no `onPredictClick` handler
   - Confirmation dialog must be shown before prediction
   - Thought streaming should start immediately for visual feedback

### Dependencies

1. **External APIs**
   - NBA API (for injuries, stats, match history)
   - Polymarket API (for betting markets)
   - Backend Eliza API (for predictions)

2. **React Hooks**
   - `usePredictionData()` - must return valid data
   - `usePrediction()` - manages thought state
   - `useChat()` - manages message state
   - `useMatchContext()` - provides current match

3. **State Management**
   - Match context must have `currentMatch` set
   - Session must be initialized
   - User must be authenticated (optional, but may affect data)

### Edge Cases

1. **No Match Selected**
   - `predictionData` is `null`
   - `buildComprehensivePredictionMessage()` returns fallback message
   - Should still work, but with limited data

2. **Partial Data Loading**
   - Some hooks may still be loading (`isLoading: true`)
   - `hasFullData: false` in prediction data
   - Should still allow prediction, but with available data

3. **Backend Errors**
   - Network errors (CORS, timeout)
   - Session not found (404)
   - Backend processing errors
   - Must show user-friendly error messages

4. **SSE Stream Issues**
   - Stream disconnects mid-prediction
   - No `thought` events received (only UI animation)
   - No `message` event received (incomplete response)
   - Must handle gracefully and show error

5. **Concurrent Predictions**
   - User clicks button multiple times
   - Must prevent duplicate predictions
   - Button disabled during `isPredicting`

6. **Session Expires During Prediction**
   - Session becomes invalid mid-stream
   - Must detect and handle `SESSION_NOT_FOUND` errors
   - Call `onSessionInvalid` callback

7. **Missing Prediction Data**
   - No injuries data available
   - No market data available
   - No player stats available
   - Should still send prediction with available data

---

## 4. Existing Patterns & APIs

### Patterns Used

1. **SSE Streaming Pattern**
   - `sendMessageWithStreaming()` uses `fetch()` with `ReadableStream`
   - Parses SSE events line-by-line
   - Handles `event:` and `data:` fields
   - Similar pattern used in `sendMessage()` for regular messages

2. **State Management Pattern**
   - React hooks for state (`useState`, `useCallback`)
   - Custom hooks for complex logic (`usePrediction`, `usePredictionData`)
   - Ref-based flags for preventing duplicate operations

3. **Error Handling Pattern**
   - Try-catch blocks with specific error types
   - `SessionNotFoundError` for session issues
   - Error handlers in SSE callbacks
   - User-facing error messages

4. **UI Feedback Pattern**
   - Loading states (`isPredicting`, `isSending`)
   - Progress indicators (`predictionProgress`)
   - Disabled states for buttons
   - Confirmation dialogs for important actions

### APIs & Libraries

1. **Backend API**
   - Endpoint: `POST /api/messaging/sessions/:sessionId/messages`
   - Request: `{ content: string, transport: 'sse', metadata?: {...} }`
   - Response: `text/event-stream` with SSE events

2. **React Query**
   - Used in `useChat` for data fetching
   - Not directly used in prediction flow

3. **Custom Hooks**
   - `usePredictionData()` - aggregates sports data
   - `usePrediction()` - manages thought streaming
   - `useChat()` - manages chat messages

---

## 5. Architecture & Data Flow

### Fixed Architecture (After Fix)

```
┌─────────────────────────────────────────────────────────────┐
│                    User Interaction                          │
│  Clicks "PREDICT NOW" button                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ChatContainer.handlePredictClick()             │
│  - Validates: !isPredicting && !isSending                   │
│  - Opens ConfirmDialog                                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (User confirms)
┌─────────────────────────────────────────────────────────────┐
│         ChatContainer.handleConfirmPrediction()              │
│  1. Validates: !isPredicting && !isSending && sessionId     │
│  2. Closes dialog                                            │
│  3. Resets prediction state                                  │
│  4. Builds prediction message                                 │
│  5. Starts UI thought animation                              │
│  6. Builds metadata with sports data                         │
│  7. Sends to backend via SSE                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         usePredictionData.buildComprehensivePredictionMessage│
│  - Formats all sports data into text prompt                  │
│  - Includes: matchup, markets, injuries, stats, history     │
│  - Returns formatted string                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         sendMessageWithStreaming()                           │
│  - POST /api/messaging/sessions/:sessionId/messages           │
│  - Body: { content, transport: 'sse', metadata: {...} }      │
│  - Headers: { Accept: 'text/event-stream' }                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (SSE Stream)
┌─────────────────────────────────────────────────────────────┐
│                    Backend Processing                        │
│  - Receives prediction request with metadata                 │
│  - Processes sports data                                     │
│  - Generates prediction                                      │
│  - Streams events: thought, chunk, message, done            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼ (SSE Events)
┌─────────────────────────────────────────────────────────────┐
│              SSE Event Handlers (Frontend)                  │
│  - onThought: addRealThought() → ThoughtStream UI            │
│  - onChunk: Accumulates text → Message bubble (streaming)    │
│  - onMessage: Final message → Complete message bubble        │
│  - onDone: resetPrediction() → Cleanup                      │
│  - onError: Show error → resetPrediction()                   │
└─────────────────────────────────────────────────────────────┘
```

### Data Structures

#### **Prediction Metadata** (sent to backend)
```typescript
{
  action: 'predict',
  context: {
    matchup: {
      homeTeam: { name, abbreviation, record, teamId },
      awayTeam: { name, abbreviation, record, teamId },
      scheduledTime: string,
      gameId: string,
    },
    stats: {
      playerStats: { homeTopScorer, awayTopScorer, homeHotHand, awayHotHand },
      bettingIndicators: { restDays, streaks, last10, h2hRecord, signals },
      matchHistory: { homeHistory, awayHistory, homeStanding, awayStanding },
    },
    market: {
      markets: { moneyline, spreads, totals, props },
      market: { line, homeOdds, awayOdds, volume, marketType },
    },
  },
}
```

#### **SSE Thought Event** (from backend)
```typescript
{
  thought: string,
  step?: string,
  progress?: number, // 0-100
}
```

#### **Prediction State** (frontend)
```typescript
{
  thoughts: PredictionThought[],
  isStreaming: boolean,
  progress: number, // 0-100
}
```

---

## 6. Unknowns & Risks

### Unknowns

1. **Backend Behavior**
   - Does backend actually process `metadata.action: 'predict'`?
   - Does backend send `thought` events for predictions?
   - What happens if backend doesn't support prediction mode?
   - How long does prediction processing take?

2. **Data Completeness**
   - What happens if all data sources fail to load?
   - Is there a minimum data requirement for prediction?
   - Can prediction work with partial data?

3. **Error Scenarios**
   - What specific error codes does backend return?
   - How does backend handle invalid session during prediction?
   - What happens if SSE stream disconnects?

4. **Performance**
   - How long should prediction take?
   - What's the timeout for SSE stream?
   - How much data is sent in metadata (size limits)?

### Risks

1. **High Risk: Backend Compatibility**
   - **Risk**: Backend may not support `metadata.action: 'predict'`
   - **Impact**: Prediction requests may be treated as regular messages
   - **Mitigation**: Test with backend team, add fallback handling

2. **High Risk: SSE Stream Reliability**
   - **Risk**: Network issues may disconnect stream mid-prediction
   - **Impact**: Incomplete predictions, poor UX
   - **Mitigation**: Add timeout handling, retry logic, error messages

3. **Medium Risk: Data Availability**
   - **Risk**: Prediction data may not be available when button clicked
   - **Impact**: Prediction sent with incomplete data
   - **Mitigation**: Validate data availability, show warnings, allow prediction with available data

4. **Medium Risk: Session Expiration**
   - **Risk**: Session may expire during long prediction
   - **Impact**: Prediction fails, user sees error
   - **Mitigation**: Handle `SESSION_NOT_FOUND` errors gracefully, refresh session if possible

5. **Low Risk: UI State Management**
   - **Risk**: Multiple rapid clicks may cause state issues
   - **Impact**: Duplicate predictions, UI glitches
   - **Mitigation**: Button disabled during prediction, state guards

6. **Low Risk: Memory Leaks**
   - **Risk**: SSE streams may not be cleaned up properly
   - **Impact**: Memory leaks, performance degradation
   - **Mitigation**: Proper cleanup in useEffect, abort controllers

---

## 7. Implementation Plan

### Phase 1: Critical Fixes (Immediate)

1. **Fix Duplicate Catch Block**
   - Remove empty `catch` block on line 141
   - Keep error handling in second `catch` block
   - Test that function executes properly

2. **Add Session Validation**
   - Check `sessionId` is not null before showing dialog
   - Show user-friendly error if session invalid
   - Disable button if no session

3. **Add Error Handling**
   - Ensure all error paths show user feedback
   - Log errors for debugging
   - Reset prediction state on error

### Phase 2: Validation & Edge Cases

1. **Data Validation**
   - Check if `predictionData` is available
   - Warn user if data is incomplete
   - Allow prediction with available data

2. **Button State Management**
   - Disable button when `sessionId` is null
   - Disable button when `isPredicting` is true
   - Show loading state during prediction

3. **Error Messages**
   - Network errors: "Connection failed. Please try again."
   - Session errors: "Session expired. Please create a new session."
   - Backend errors: "Prediction failed. Please try again."

### Phase 3: Testing & Refinement

1. **Test Scenarios**
   - Happy path: Full data, successful prediction
   - Partial data: Some data missing
   - No data: Only basic matchup info
   - Network errors: Simulate failures
   - Session errors: Expired session

2. **UI/UX Improvements**
   - Loading indicators
   - Progress feedback
   - Error recovery options

---

## 8. Clarifying Questions

1. **Backend Support**
   - Does the backend currently support `metadata.action: 'predict'`?
   - Does the backend send `thought` events for predictions?
   - What is the expected response time for predictions?

2. **Data Requirements**
   - Is there a minimum data requirement for predictions?
   - Can predictions work with partial data (e.g., no market data)?
   - Should we show a warning if data is incomplete?

3. **Error Handling**
   - What specific error codes should we handle?
   - Should we retry failed predictions automatically?
   - How should we handle timeouts?

4. **User Experience**
   - Should the button be hidden if no match is selected?
   - Should we show a loading state while data is being fetched?
   - How should we display prediction confidence/uncertainty?

5. **Performance**
   - What is the expected prediction processing time?
   - Should we set a timeout for predictions?
   - How much data can we send in metadata (size limits)?

---

## 9. Success Criteria

### Functional Requirements
- ✅ Button click opens confirmation dialog
- ✅ Confirmation triggers prediction request
- ✅ Sports data is sent to backend correctly
- ✅ Thought streaming visualization appears
- ✅ Final prediction is displayed
- ✅ Errors are handled gracefully

### Non-Functional Requirements
- ✅ No JavaScript errors in console
- ✅ Button state reflects prediction status
- ✅ User sees clear feedback at all stages
- ✅ Errors are user-friendly and actionable
- ✅ Performance is acceptable (< 5s for prediction)

---

## 10. Next Steps

1. **Review this plan** with stakeholders
2. **Answer clarifying questions** about backend and requirements
3. **Implement Phase 1 fixes** (critical syntax error)
4. **Test with backend** to verify compatibility
5. **Implement Phase 2** (validation and edge cases)
6. **Test all scenarios** thoroughly
7. **Deploy and monitor** for issues

---

**Document Version**: 1.0  
**Date**: 2024-12-19  
**Status**: Ready for Review
