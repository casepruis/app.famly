# AI Insight Tracking & Scheduling Solution

## Problems Solved

### 1. Action Dates in the Past
**Problem**: Insights had action dates in the past (e.g., 18th) making them seem irrelevant.

**Solution**: 
- Enhanced filtering logic to be more flexible with past action dates
- Allow suggestions if action date is within ±1 day of event date OR if action was in the past but event is within 7 days
- Added "Plan alsnog" (Schedule anyway) buttons for past actions
- Smart detection of weekend periods vs action dates

### 2. Suggestion Tracking
**Problem**: No way to track acted-upon suggestions, leading to repeated suggestions.

**Solution**:
- Created `src/utils/insightTracking.js` utility for localStorage-based tracking
- Track dismissed insights (user chose not to act)
- Track acted insights (user created events/tasks from suggestions)
- Filter out dismissed insights from future displays
- Added "Niet meer tonen" (Don't show again) buttons

## Implementation Details

### Frontend Changes
1. **AIReviewDialog.jsx**: 
   - Added tracking state and utilities
   - Enhanced action date filtering logic
   - Added schedule and dismiss buttons
   - Visual indicators for past action dates

2. **insightTracking.js**:
   - localStorage-based persistence
   - Family-specific tracking
   - Debug utilities for development

3. **InsightDebugPanel.jsx**:
   - Development tool to view/clear tracking data
   - Can be removed in production

### New User Experience
1. **Flexible Scheduling**: Past action dates no longer block relevant suggestions
2. **Direct Scheduling**: "Plan nu" or "Plan alsnog" buttons create events immediately
3. **Persistent Dismissal**: Dismissed insights won't show again
4. **Action Tracking**: Converting insights to tasks/events prevents re-showing

### Data Storage
- **Dismissed insights**: `localStorage['dismissed-insights-{familyId}']`
- **Acted insights**: `localStorage['acted-insights-{familyId}']` 

### Testing
1. Create a Friday event (day off)
2. Should see weekend suggestions even if action date was in past
3. Use "Plan alsnog" to schedule suggested events
4. Use "Niet meer tonen" to dismiss irrelevant suggestions
5. Use debug panel to view tracking status

## Code Locations
- Main logic: `src/components/schedule/AIReviewDialog.jsx`
- Utilities: `src/utils/insightTracking.js`
- Debug tool: `src/components/InsightDebugPanel.jsx` (temporary)
- Dashboard integration: `src/pages/Dashboard.jsx`