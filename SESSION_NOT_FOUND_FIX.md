# SESSION_NOT_FOUND Error Fix

## Problem
The backend was returning a 400 error with `SESSION_NOT_FOUND` code when trying to access a session that doesn't exist:
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session with ID 'b708e29a-7c17-4261-83c8-d48af6a45014' not found"
  }
}
```

The frontend wasn't properly detecting and handling this error, causing it to appear in the console without proper recovery.

## Root Cause
1. The API client interceptor wasn't specifically handling 400 errors with `SESSION_NOT_FOUND` code
2. Error handlers were checking for "not found" in the message string, but weren't checking for the error code
3. No custom error class to make it easier to detect session not found errors

## Solution

### 1. Created Custom Error Class
Added `SessionNotFoundError` class in `src/services/api/client.ts` to make it easier to detect session not found errors:
```typescript
export class SessionNotFoundError extends Error {
  constructor(message: string, public readonly code: string = 'SESSION_NOT_FOUND') {
    super(message);
    this.name = 'SessionNotFoundError';
  }
}
```

### 2. Updated API Client Interceptor
Modified the error interceptor to:
- Detect `SESSION_NOT_FOUND` errors (both 400 and 404 status codes)
- Throw `SessionNotFoundError` for easier detection
- Skip verbose logging for expected session expiration errors

### 3. Updated Error Handlers
Updated error handling in:
- `useChat.ts`: Detects `SessionNotFoundError` and calls `onSessionInvalid` callback
- `useSession.ts`: Returns `null` when session not found instead of throwing
- `MainLayout.tsx`: Properly handles session not found when selecting sessions

## Changes Made

### Files Modified:
1. `src/services/api/client.ts`
   - Added `SessionNotFoundError` class
   - Updated interceptor to handle 400 errors with `SESSION_NOT_FOUND` code
   - Treats `SESSION_NOT_FOUND` the same as 404 for sessions endpoint

2. `src/hooks/useChat.ts`
   - Import `SessionNotFoundError`
   - Check for `SessionNotFoundError` instance in error handlers
   - Also check for `SESSION_NOT_FOUND` in error message

3. `src/hooks/useSession.ts`
   - Import `SessionNotFoundError`
   - Wrap `getSession` call in try-catch
   - Return `null` when session not found instead of throwing

4. `src/components/layout/MainLayout.tsx`
   - Import `SessionNotFoundError` dynamically
   - Call `handleSessionInvalid` when session not found during selection

## Behavior After Fix

1. **When a session doesn't exist on backend:**
   - Error is caught and handled gracefully
   - Session is removed from local storage
   - React Query cache is cleared
   - User is prompted to create a new session
   - No error appears in console (only warnings for debugging)

2. **Error Detection:**
   - Detects by error code: `SESSION_NOT_FOUND`
   - Detects by error class: `SessionNotFoundError`
   - Detects by message: "not found", "Session", "SESSION_NOT_FOUND"
   - Works for both 400 and 404 status codes

3. **User Experience:**
   - Seamless recovery from expired/deleted sessions
   - Automatic cleanup of invalid sessions
   - Clear indication when session needs to be recreated

## Testing

To test the fix:
1. Create a session and note its ID
2. Delete the session from the backend (or wait for expiration)
3. Try to access the session in the frontend
4. Verify:
   - No 400 error appears in console
   - Session is automatically removed from UI
   - User can create a new session
   - No error state is shown to user

## Related Issues
- Sessions can expire on the backend
- Backend may restart and lose session state
- Sessions may be deleted manually
- Network issues can cause stale session references

All of these scenarios are now handled gracefully.
