# Prediction Prompt Splitting & Multi-Part Response Implementation Plan

## Executive Summary

This plan addresses the issue where long prediction prompts (4141+ characters) exceed backend limits and create a poor UX. The solution splits prompts into 3 parts, hides technical details from users, and structures backend responses into 3 distinct phases for enhanced thought streaming visualization.

---

## 1. Goal & Requirements

### Primary Goals
1. **Fix Character Limit Errors**: Split long prompts into 3 manageable parts that stay under backend limits
2. **Improve UX**: Hide technical prompts from users, show friendly message like "Winner winner, chicken dinner!"
3. **Enhance Thought Streaming**: Structure backend responses into 3 phases to maximize visualization impact
4. **Maintain Functionality**: Ensure all prediction data is still sent and processed correctly

### Requirements
- **Frontend**: Split `buildComprehensivePredictionMessage()` into 3 separate functions
- **Frontend**: Use `sendMessageWithDisplayText()` to show friendly message while sending actual prompts
- **Frontend**: Send 3 sequential messages with metadata indicating part number (1, 2, 3)
- **Backend**: Process 3-part requests and respond in 3 phases
- **Backend**: Structure responses to align with thought streaming UI phases
- **UI**: Display thought stream phases that correspond to the 3 response parts

---

## 2. Architecture & Data Flow

### Current Flow (Problematic)
```
User clicks "PREDICT NOW"
  → buildComprehensivePredictionMessage() [4141+ chars - TOO LONG]
  → sendMessageWithDisplayText("Let's calculate!", longPrompt)
  → Backend rejects: "Content exceeds maximum length"
  → Error shown to user
```

### New Flow (Proposed)
```
User clicks "PREDICT NOW"
  → Shows friendly message: "Winner winner, chicken dinner!" in chat
  → Split prompt into 3 parts:
    1. Sports Data Info (injuries, stats, history, standings)
    2. Market Info (betting markets, odds, volume, signals)
    3. Other Info (matchup basics, live scores, final analysis request)
  → Send 3 sequential messages with metadata.partNumber = 1, 2, 3
  → Backend processes each part sequentially
  → Backend responds in 3 phases:
    1. Sportdata & Market Analysis
    2. Intelligent Reasoning & Winner Prediction
    3. Bet Recommendation (Moneyline/Spread/OU/etc)
  → ThoughtStream UI visualizes each phase distinctly
```

---

## 3. Implementation Details

### 3.1 Frontend Changes

#### A. Split `buildComprehensivePredictionMessage()` into 3 functions

**File**: `src/hooks/usePredictionData.ts`

Create three new functions:
1. `buildSportsDataMessage(data: PredictionData): string`
   - Injuries (home/away)
   - Player stats (top scorers, hot hands)
   - Match history (recent form, standings)
   - Betting indicators (rest days, streaks, H2H)
   - Live scores (if applicable)

2. `buildMarketDataMessage(data: PredictionData): string`
   - Betting markets (Moneyline, Spread, O/U, Props)
   - Market volume and efficiency
   - Betting signals
   - Odds and probabilities

3. `buildOtherInfoMessage(data: PredictionData): string`
   - Basic matchup info (teams, scheduled time)
   - Team records
   - Final analysis request with instructions for 3-part response

#### B. Update `ChatContainer.tsx` to send 3-part messages

**File**: `src/components/chat/ChatContainer.tsx`

Modify `handleConfirmPrediction()`:
- Show friendly display message: "Winner winner, chicken dinner!"
- Send 3 sequential messages using `sendMessageWithDisplayText()`
- Add metadata to each message:
  ```typescript
  {
    action: 'predict',
    partNumber: 1 | 2 | 3,
    totalParts: 3,
    context: { ...existing context }
  }
  ```
- Track sending state for all 3 parts
- Handle errors for any part

#### C. Update `useChat.ts` to support multi-part predictions

**File**: `src/hooks/useChat.ts`

- Modify `sendMessageWithDisplayText()` to accept `partNumber` in metadata
- Ensure sequential sending (wait for part 1 to complete before sending part 2)
- Track multi-part prediction state

#### D. Enhance ThoughtStream to show phases

**File**: `src/components/chat/ThoughtStream.tsx`

- Add phase indicators for 3-part responses:
  - Phase 1: "Analyzing Sports Data & Markets"
  - Phase 2: "Reasoning & Winner Prediction"
  - Phase 3: "Bet Recommendations"
- Update progress calculation to account for 3 phases (0-33%, 33-66%, 66-100%)

### 3.2 Backend Requirements (Documentation)

**Note**: Backend changes are out of scope for this frontend implementation, but we need to document requirements.

#### A. Accept 3-part requests
- Detect `metadata.partNumber` and `metadata.totalParts`
- Accumulate context from all 3 parts
- Process sequentially (part 1 → part 2 → part 3)

#### B. Respond in 3 phases
- **Phase 1 Response**: Sportdata & Market Analysis
  - Analyze injuries, stats, history
  - Analyze betting markets and odds
  - Send thought events with `phase: 1`
  
- **Phase 2 Response**: Intelligent Reasoning & Winner Prediction
  - Synthesize data from Phase 1
  - Make winner prediction
  - Provide reasoning
  - Send thought events with `phase: 2`
  
- **Phase 3 Response**: Bet Recommendation
  - Recommend specific bet types (Moneyline/Spread/OU)
  - Provide value analysis
  - Risk assessment
  - Send thought events with `phase: 3`

#### C. SSE Event Structure
```typescript
// Phase 1 thoughts
event: thought
data: { thought: "...", phase: 1, step: "analyzing_sports_data" }

// Phase 2 thoughts
event: thought
data: { thought: "...", phase: 2, step: "reasoning" }

// Phase 3 thoughts
event: thought
data: { thought: "...", phase: 3, step: "recommending_bets" }
```

---

## 4. Data Structures

### 4.1 Split Message Parts

```typescript
interface PredictionMessagePart {
  partNumber: 1 | 2 | 3;
  totalParts: 3;
  content: string;
  displayText: string; // "Winner winner, chicken dinner!" (only shown for part 1)
}

interface PredictionMetadata {
  action: 'predict';
  partNumber?: 1 | 2 | 3;
  totalParts?: 3;
  context: {
    matchup: {...};
    dataAvailable: {...};
  };
}
```

### 4.2 Enhanced Thought Events

```typescript
interface SSEThoughtEvent {
  thought: string;
  step?: string;
  progress?: number;
  phase?: 1 | 2 | 3; // NEW: indicates which response phase
}
```

---

## 5. Constraints & Dependencies

### Constraints
1. **Backend Character Limit**: Each part must stay under ~6000-7000 characters (assuming 20000 total limit)
2. **Sequential Processing**: Parts must be sent and processed in order (1 → 2 → 3)
3. **State Management**: Need to track which part is currently being sent/processed
4. **Error Handling**: If any part fails, need to handle gracefully
5. **Backend Compatibility**: Backend must support `partNumber` metadata (may need backend changes)

### Dependencies
- Existing `useChat` hook and `sendMessageWithDisplayText` function
- Existing `usePrediction` hook for thought streaming
- Existing `ThoughtStream` component
- Backend SSE streaming infrastructure

### Edge Cases
1. **Part 1 succeeds, Part 2 fails**: Should show error, allow retry
2. **User cancels during multi-part send**: Should cancel remaining parts
3. **Backend doesn't support partNumber**: Fallback to single message (if under limit)
4. **Network interruption mid-send**: Retry mechanism needed
5. **Backend responds out of order**: Handle gracefully (unlikely with sequential sends)

---

## 6. Risks & Unknowns

### Risks
1. **Backend Changes Required**: Backend may need modifications to support `partNumber` metadata
   - **Mitigation**: Document requirements clearly, coordinate with backend team
   
2. **State Complexity**: Managing 3-part send state adds complexity
   - **Mitigation**: Use clear state machine, add comprehensive error handling
   
3. **User Experience**: Sequential sends may feel slower
   - **Mitigation**: Show progress indicators, use friendly display message
   
4. **Backend Response Format**: Backend may not structure responses in 3 phases
   - **Mitigation**: Frontend can still visualize phases based on thought events, even if backend doesn't structure it

### Unknowns
1. **Backend Implementation**: Don't know if backend can/will support `partNumber` metadata
   - **Action**: Need to verify with backend team or test with mock backend
   
2. **Optimal Part Sizes**: Need to test actual character counts for each part
   - **Action**: Implement splitting logic, test with real data, adjust if needed
   
3. **Thought Event Phases**: Backend may not send `phase` field in thought events
   - **Action**: Frontend can infer phases from step names or content analysis

---

## 7. Testing Strategy

### Unit Tests
- Test `buildSportsDataMessage()` with various data combinations
- Test `buildMarketDataMessage()` with full/partial market data
- Test `buildOtherInfoMessage()` with different matchup states
- Test character limits for each part
- Test sequential sending logic in `useChat`

### Integration Tests
- Test full 3-part prediction flow
- Test error handling (part 1 succeeds, part 2 fails)
- Test cancellation during multi-part send
- Test thought streaming with phase indicators

### Manual Testing
- Test with real prediction data
- Verify character counts stay under limits
- Verify UX shows friendly message correctly
- Verify thought streaming shows phases

---

## 8. Implementation Steps

### Phase 1: Split Message Building (Frontend Only)
1. Create `buildSportsDataMessage()` function
2. Create `buildMarketDataMessage()` function
3. Create `buildOtherInfoMessage()` function
4. Add unit tests for each function
5. Verify character counts

### Phase 2: Multi-Part Sending (Frontend)
1. Update `ChatContainer.tsx` to send 3 parts sequentially
2. Add `partNumber` to metadata
3. Update state management for multi-part sends
4. Add error handling for partial failures
5. Test sequential sending

### Phase 3: Thought Streaming Enhancement (Frontend)
1. Update `ThoughtStream` to show phase indicators
2. Update `usePrediction` to track phases
3. Parse thought events for phase information
4. Update progress calculation for 3 phases
5. Test phase visualization

### Phase 4: Backend Coordination (Documentation)
1. Document backend requirements
2. Create backend configuration prompt
3. Test with backend (if available)
4. Adjust frontend based on backend capabilities

---

## 9. Success Criteria

✅ **Character Limit Fixed**: No more "Content exceeds maximum length" errors
✅ **UX Improved**: Users see "Winner winner, chicken dinner!" instead of long prompts
✅ **3-Part Prompts**: Prompts successfully split and sent in 3 parts
✅ **3-Phase Responses**: Backend responds in 3 distinct phases (or frontend visualizes as such)
✅ **Thought Streaming Enhanced**: ThoughtStream UI shows clear phase progression
✅ **Error Handling**: Graceful handling of partial failures
✅ **Backward Compatibility**: Falls back gracefully if backend doesn't support partNumber

---

## 10. Questions for Clarification

1. **Backend Support**: Does the backend currently support `partNumber` metadata, or do we need to coordinate backend changes?
2. **Response Phases**: Should backend responses be structured in 3 phases, or can frontend infer phases from thought events?
3. **Display Message**: Should "Winner winner, chicken dinner!" be shown for all 3 parts, or just part 1?
4. **Error Recovery**: If part 2 fails, should we allow retry of just part 2, or restart from part 1?
5. **Character Limits**: What are the exact backend limits per message? (Currently assuming 20000 total, ~6000-7000 per part)

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Clarify unknowns** (especially backend support)
3. **Begin Phase 1 implementation** (split message building)
4. **Coordinate with backend team** on requirements
5. **Iterate based on feedback**
