# Prediction Prompt Hiding - Comprehensive Fix

## Problem
The actual prediction prompt content was appearing in the UI after a few seconds, even though we were setting displayText.

## Root Cause Analysis

The issue was that prediction messages were being overwritten in multiple places:
1. **Backend API responses** - When messages were loaded from the API, they had the actual prompt content
2. **Supabase storage** - Messages saved with actual content were being loaded back
3. **Local storage** - Same issue with local storage
4. **Message ID updates** - When message IDs were updated, the actual content could overwrite displayText
5. **Message merging** - When merging messages from different sources, actual content could replace displayText

## Solution: Centralized Sanitization

Created a `sanitizePredictionMessage()` function that:
- Detects prediction messages by content pattern (`PREDICTION REQUEST - PART 1/3`, etc.)
- Replaces Part 1 with "Winner winner, chicken dinner!"
- Hides Parts 2/3 completely (empty text)
- Preserves displayText from metadata if present

### Applied to ALL Message Set Points

The sanitization function is now applied at **every single place** where messages are set:

1. ✅ When adding user messages (`setMessages` with userMessage)
2. ✅ When adding display messages (`setMessages` with displayMessage)
3. ✅ When loading from Supabase (`setMessages` with supabaseMessages)
4. ✅ When loading from local storage (`setMessages` with stored messages)
5. ✅ When loading from API (`setMessages` with apiMessages)
6. ✅ When merging messages (`setMessages` with merged messages)
7. ✅ When updating message IDs (`setMessages` when updating ID)
8. ✅ When adding agent messages (`setMessages` with agentMessage)
9. ✅ When saving messages (`saveMessage` function)
10. ✅ In MessageBubble component (detection by content)
11. ✅ In MessageList component (filtering out Parts 2/3)

## Implementation Details

### 1. Centralized Sanitization Function

```typescript
function sanitizePredictionMessage(message: Message): Message {
  // If already has displayText in metadata, use it
  if (message.metadata?.isPredictionMessage && message.metadata?.displayText) {
    return { ...message, text: message.metadata.displayText as string };
  }
  
  // Detect prediction messages by content pattern
  if (message.role === 'user' && message.text.includes('PREDICTION REQUEST - PART')) {
    if (message.text.includes('PART 1/3')) {
      return {
        ...message,
        text: "Winner winner, chicken dinner!",
        metadata: { ...message.metadata, isPredictionMessage: true, displayText: "Winner winner, chicken dinner!" },
      };
    } else {
      // Parts 2 and 3 should be hidden
      return {
        ...message,
        text: "",
        metadata: { ...message.metadata, isPredictionMessage: true, displayText: "" },
      };
    }
  }
  
  return message;
}
```

### 2. MessageList Filtering

Parts 2/3 are filtered out completely so they never render:
- Messages with `isPredictionMessage: true` and empty `displayText` are filtered
- Messages containing "PART 2/3" or "PART 3/3" are filtered

### 3. MessageBubble Fallback

Even if a prediction message slips through, MessageBubble:
- Detects by content pattern
- Shows "Winner winner, chicken dinner!" for Part 1
- Returns `null` (doesn't render) for Parts 2/3

## Verification: 3-Part Delivery

### Check Browser Console

You should see sequential logs:
```
[ChatContainer] Sending Part 1/3: { displayText: "Winner winner, chicken dinner!", ... }
[ChatContainer] Part 1/3 sent successfully, waiting before Part 2/3
[ChatContainer] Sending Part 2/3: { actualLength: <number>, ... }
[ChatContainer] Part 2/3 sent successfully, waiting before Part 3/3
[ChatContainer] Sending Part 3/3: { actualLength: <number>, ... }
```

### Check Network Tab

Filter by "messages" - should see 3 POST requests:
1. **Request 1**: `metadata.partNumber: 1`, content contains "PART 1/3: SPORTS DATA"
2. **Request 2**: `metadata.partNumber: 2`, content contains "PART 2/3: MARKET DATA"
3. **Request 3**: `metadata.partNumber: 3`, content contains "PART 3/3: ANALYSIS INSTRUCTIONS"

### Check UI

- ✅ Only "Winner winner, chicken dinner!" visible (Part 1)
- ✅ No Parts 2/3 visible
- ✅ No actual prompt content visible

## Defense in Depth

This fix uses **multiple layers of protection**:

1. **Prevention**: Store displayText in metadata when creating messages
2. **Sanitization**: Sanitize at every setMessages call
3. **Filtering**: Filter out Parts 2/3 in MessageList
4. **Detection**: Detect by content pattern in MessageBubble
5. **Fallback**: Return null for Parts 2/3 in MessageBubble

Even if one layer fails, others will catch it.

## Testing Checklist

- [ ] Click "PREDICT NOW"
- [ ] Verify only "Winner winner, chicken dinner!" appears
- [ ] Check console for 3-part sending logs
- [ ] Check network tab for 3 POST requests
- [ ] Verify no actual prompt content appears
- [ ] Reload page - verify displayText persists
- [ ] Check that Parts 2/3 are completely hidden

## Files Modified

1. `src/hooks/useChat.ts` - Added `sanitizePredictionMessage()` and applied everywhere
2. `src/components/chat/MessageBubble.tsx` - Added content detection and hiding
3. `src/components/chat/MessageList.tsx` - Added filtering for Parts 2/3
4. `src/utils/messageUtils.ts` - Already had displayText preservation
