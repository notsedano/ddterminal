# Prediction 3-Part Sending Debug Guide

## How to Verify 3-Part Delivery

### 1. Check Browser Console Logs

When you click "PREDICT NOW", you should see these logs in sequence:

```
[ChatContainer] Sending Part 1/3: { displayText: "Winner winner, chicken dinner!", actualLength: <number>, metadata: {...} }
[ChatContainer] Part 1/3 sent successfully, sending Part 2/3
[ChatContainer] Sending Part 2/3: { actualLength: <number>, metadata: {...} }
[ChatContainer] Part 2/3 sent successfully, sending Part 3/3
[ChatContainer] Sending Part 3/3: { actualLength: <number>, metadata: {...} }
```

### 2. Check Network Tab

In browser DevTools → Network tab, filter by "messages":

1. **Part 1 Request**: 
   - Should have `metadata.partNumber: 1`
   - Should have `metadata.totalParts: 3`
   - Request body `content` should contain "PART 1/3: SPORTS DATA"

2. **Part 2 Request**:
   - Should have `metadata.partNumber: 2`
   - Should have `metadata.totalParts: 3`
   - Request body `content` should contain "PART 2/3: MARKET DATA"

3. **Part 3 Request**:
   - Should have `metadata.partNumber: 3`
   - Should have `metadata.totalParts: 3`
   - Request body `content` should contain "PART 3/3: ANALYSIS INSTRUCTIONS"

### 3. Verify Message Display

- **Part 1**: Should show "Winner winner, chicken dinner!" in chat
- **Part 2**: Should NOT show any message in chat (silent)
- **Part 3**: Should NOT show any message in chat (silent)

### 4. Check Backend Logs

Backend should receive 3 separate POST requests with:
- `metadata.partNumber` = 1, 2, 3
- `metadata.totalParts` = 3
- `metadata.action` = 'predict'

## Troubleshooting

### If Part 1 shows actual prompt content:

1. Check if message metadata has `isPredictionMessage: true`
2. Check if message metadata has `displayText: "Winner winner, chicken dinner!"`
3. Check browser console for `[useChat] Updated prediction message` log
4. Verify MessageBubble is checking `metadata.displayText`

### If messages appear after a few seconds:

This might be due to:
1. Messages being reloaded from Supabase/API
2. Backend returning user_message event with actual content
3. Message ID update overwriting displayText

**Solution**: All message loading paths now preserve displayText from metadata.

### If 3 parts aren't being sent:

1. Check console for errors in the promise chain
2. Check if `cancelledRef.current` is being set to true
3. Check if `sendingPart` state is being updated correctly
4. Verify all 3 parts are under 4000 characters

## Expected Behavior

✅ **Correct**:
- User sees: "Winner winner, chicken dinner!"
- Backend receives: 3 separate messages with partNumber 1, 2, 3
- No actual prompt content visible in UI

❌ **Incorrect**:
- User sees actual prompt content
- Only 1 message sent instead of 3
- Parts 2 or 3 showing in chat
