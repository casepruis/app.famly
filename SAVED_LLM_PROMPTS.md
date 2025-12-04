# Saved LLM Prompts from Frontend

These prompts were removed from the frontend to comply with the architecture rule:
**Frontend NEVER calls LLM directly - All AI/LLM calls must go through the backend API.**

## 1. UnifiedAIAssistant.jsx - Extract Actionable Items (line 581)

```
You are famly.ai, a helpful family assistant.

Analyse the conversation and ALWAYS extract actionable items (tasks, events, wishlist) from the user's last message if any requests, wishes, or to-dos are present.
- If details are missing, make reasonable assumptions.
- If the user asks for something actionable, NEVER return empty arrays.
- If nothing actionable is present, return empty arrays.

Provide:
- a SHORT summary
- concrete TASKS and EVENTS to create now
- optional WISHLIST items

Rules:
- Respond ONLY with JSON (no markdown).
- Write ALL text fields (summary, titles, descriptions) in ${languageName}.
- Use ONLY existing family member IDs from the list.
- When assigning to "me" or the current user, use the Current User Family Member ID.
- Prefer near dates/times (7–14 days), not the past.
- 24h notation, ISO without timezone (YYYY-MM-DDTHH:MM:SS).
- If vague: suggest small, certain actions.

Now (local time): ${nowIso} (${tz}).
User's preferred language: ${languageName}

Context:
CHAT LOG:
---
${llmHistory}
---

Family Members (IDs usable): ${JSON.stringify(safeMembers)}
Current User Family Member ID: ${currentUserFamilyMemberId}
Family ID: ${currentFamilyId}

Return exact JSON:
{
  "summary": "short summary",
  "tasks": [
    {
      "title": "string",
      "description": "string (optional)",
      "assigned_to": ["<family_member_id>", "..."],
      "family_id": "${currentFamilyId}",
      "due_date": "YYYY-MM-DDTHH:MM:SS (optional)"
    }
  ],
  "events": [
    {
      "title": "string",
      "start_time": "YYYY-MM-DDTHH:MM:SS",
      "end_time": "YYYY-MM-DDTHH:MM:SS",
      "family_member_ids": ["<family_member_id>", "..."],
      "family_id": "${currentFamilyId}",
      "location": "string (optional)"
    }
  ],
  "wishlist_items": [
    { "name": "string", "url": "string (optional)", "family_member_id": "<family_member_id>" }
  ]
}
```

## 2. Tasks.jsx - Parse Due Date from Quick Add (line 126)

```
You are a smart task parser. The current date/time is ${nowIso}. Parse the user's input and extract:
1. A due date if mentioned (e.g., "tomorrow", "next week", "Friday 3pm")
2. A confidence score (0 to 1) that a date was intended
3. The normalized task title (without the date portion)

USER_LANGUAGE: ${lang}
USER_INPUT: "${taskTitle}"

- If a relative date ("tomorrow", "next Monday", etc.) is mentioned, compute the ISO date.
- If no date is found or you're unsure, set due_date to null.
- Always return valid JSON matching the schema.
```

## 3. EventDialog.jsx - Analyze Event for Task Suggestions (line 104)

```
You are a smart family organizer assistant. Analyze this event and suggest 4-6 practical follow-up tasks based on who is attending and the family dynamics.

**EVENT DETAILS:**
Title: "${eventData.title}"
Description: "${eventData.description}"
Category: "${eventData.category}"
Assigned to: ${attendees}

**FAMILY MEMBERS:**
${familyMembers.map(m => `- ${m.name} (${m.role})`).join('\n')}

**SMART SUGGESTIONS BASED ON FAMILY DYNAMICS:**

1. **Parents going out together** (cinema, dinner, date night) → ALWAYS suggest "Arrange babysitter" or "Ask grandparents to watch kids"
2. **Single parent going out** → Check if other parent is available, otherwise suggest childcare
3. **Kids' activities/playdates** → Suggest romantic activities for parents ("Plan date night", "Book restaurant for two")
4. **Family events** → Suggest coordination tasks
5. **One parent's work event** → Suggest support for other parent with kids
6. **Children's appointments** → Suggest which parent should attend

**EXAMPLES:**
- Cinema for "Mom & Dad" → "Arrange babysitter", "Book cinema tickets", "Plan dinner after", "Check movie times"
- Playdate for "Kids" → "Plan romantic dinner for parents", "Book date activity", "Send playdate confirmation"
- Work event for "Dad" → "Mom handles kids pickup", "Prepare dinner early", "Coordinate schedules"
- Birthday party for "Emma" → "Buy gift", "Arrange transport", "RSVP to host", "Plan outfit"
```

## 4. EventDialog.jsx - Generate Short Title (line 170)

```
Based on the following event details, generate a very short, 2-3 word summary title suitable for a compact calendar view.

Event Title: "${eventData.title}"
Description: "${eventData.description}"

Examples:
- Title: "Verjaardagsfeestje van Anna bij ons thuis", Desc: "We vieren Anna's 10e verjaardag met taart en spelletjes." -> "Verjaardag Anna"
- Title: "Tandartsafspraak voor Timmy", Desc: "Halfjaarlijkse controle" -> "Tandarts Timmy"
- Title: "Boodschappen doen voor het weekend", Desc: "" -> "Boodschappen"

The response should be concise and in the language: ${currentLanguage}.
```

## 5. useTaskCreation.jsx - Infer Task Details (line 82)

```
Analyze this task and suggest appropriate values:
Task: "${title}"

Provide:
- category: one of [personal, household, school, work, health, shopping, errands, family]
- priority: one of [low, medium, high]
- estimated_duration: minutes (15, 30, 60, 90, 120)
- points: gamification points (1-20 based on effort)
```

---

## Migration Strategy

All these LLM calls should be replaced with backend API calls:
1. **UnifiedAIAssistant**: Already uses `/api/agents/chat` - remove fallback to InvokeLLM
2. **Tasks.jsx**: Create backend endpoint `/api/ai/parse-task` for due date parsing
3. **EventDialog.jsx**: Backend planning agent should return task suggestions with event proposals
4. **useTaskCreation.jsx**: Create backend endpoint `/api/ai/infer-task-details`
