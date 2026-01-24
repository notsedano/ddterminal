# Message Sending Fix

## Issue
Messages were not being sent when clicking the send button or pressing Enter.

## Root Cause
When selecting a session from the sidebar, the `roomId` (channelId) wasn't being set immediately, causing the ChatContainer to not render properly or the sessionId to be null when trying to send messages.

## Fixes Applied

### 1. Enhanced Error Logging
Added comprehensive logging to track message sending:
- **File:** `src/hooks/useChat.ts`
- **Changes:**
  - Added console.log when sending message with sessionId, userId, and text
  - Enhanced error logging with detailed error information
  - Added success callback logging

### 2. API Request Logging
Added logging to track API requests:
- **File:** `src/services/api/messages.ts`
- **Changes:**
  - Log request URL and body before sending
  - Log API response on success
  - Enhanced error logging with try-catch

### 3. Session Loading Fix
Fixed session selection to immediately load roomId:
- **File:** `src/components/layout/MainLayout.tsx`
- **Changes:**
  - Updated `handleSessionSelect` to be async
  - Immediately try to load session from storage to get channelId
  - Set roomId as soon as session is loaded

## Testing Steps

1. **Select a session** from the sidebar
2. **Type a message** in the input field
3. **Press Enter** or click the send button
4. **Check browser console** for:
   - "Sending message:" log with sessionId, userId, text
   - "Sending message to API:" log with URL and body
   - "Message API response:" log on success
   - Any error messages if sending fails

## Expected Console Output

When sending a message successfully:
```
Sending message: { text: "Test message", sessionId: "...", userId: "..." }
Sending message to API: { url: "/messaging/sessions/.../messages", body: { content: "Test message", userId: "..." } }
Message API response: { success: true, userMessage: {...}, sessionStatus: {...} }
Message sent successfully: { messageId: "...", sessionId: "..." }
```

If there's an error:
```
Failed to send message: Error: ...
Error details: { message: "...", sessionId: "...", userId: "..." }
Message API error: ...
```

## Next Steps

1. Test message sending in the browser
2. Check console logs to identify any remaining issues
3. Verify messages appear in the chat after sending
4. Check network tab for API request/response details
