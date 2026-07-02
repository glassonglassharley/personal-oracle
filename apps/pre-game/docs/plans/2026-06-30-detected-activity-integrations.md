# Detected Activity Integrations Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn Pre-Game into an income momentum system that detects likely real-world income-growth signals from Gmail, Google Calendar, and Indeed while keeping the user in control before anything becomes a permanent record.

**Architecture:** Add a local-first Detected Activity Inbox now, backed by `localStorage` mock/example events and explicit confirmation actions. Later, add the smallest safe Next.js API route backend for OAuth token exchange/storage and read-only Gmail/Calendar polling. Treat every external signal as evidence, not truth.

**Tech Stack:** Next.js 16 App Router, React 19 client component, TypeScript, localStorage for prototype state, future Next.js route handlers for OAuth/API polling.

---

## Current Repo Context

Pre-Game is currently a single client-side app at `app/components/PreGameApp.tsx` with:

- `Task` and `Activity` stored in `localStorage` keys `pg_tasks` and `pg_activities`.
- `ConnectionDetails`/`Connections` stored in `ig_connections`.
- Manual platform connection rows that only open external accounts and let the user enter counts.
- No backend, database, auth, OAuth, or route handlers yet.

Important existing types:

- `ActivityCategory = "selling" | "delivery" | "application" | "skill_asset" | "admin" | "uncategorized"`
- `MomentumClass = "direct_money" | "advanced_opportunity" | "built_skill_or_asset" | "important_not_income_linked" | "not_sure"`
- `Activity` currently includes `id`, `taskId`, `title`, `dateCompleted`, `timestamp`, `category`, `momentum`.

---

## Product Architecture

### Principle

External systems produce evidence streams. Pre-Game never assumes an email, calendar event, or job-board status is final truth. It creates `DetectedActivity` suggestions, then the user chooses what to do.

### Data Flow

1. Source adapter reads from one external source, or from mock data in the prototype.
2. Detector classifies source item into a possible income-growth signal.
3. Normalizer converts it into a privacy-conscious `DetectedActivity`.
4. Deduper checks `source + sourceId` and avoids duplicate pending cards.
5. Detected Activity Inbox shows pending items.
6. User action converts or links the suggestion:
   - Log it -> creates permanent `Activity`.
   - Ignore -> marks suggestion `ignored`.
   - Link to opportunity -> attaches to an `Opportunity`.
   - Mark as income event -> creates `IncomeEvent`.
   - Remind me to follow up -> creates `FollowUp`.
7. Original `DetectedActivity` remains as audit trail with status `logged`, `ignored`, or `linked`.

### Prototype Boundary

For the current static/localStorage prototype:

- Implement real UI and data model.
- Seed realistic mock detected events.
- Do not pretend Gmail/Calendar/Indeed are connected.
- Connection rows should clearly say "mock inbox now; real read-only OAuth later".
- Store only minimal mock metadata.

For real Gmail/Calendar:

- OAuth requires secure token handling. Do not put refresh tokens in localStorage.
- Add minimal backend route handlers when ready.
- Keep API access read-only.

For Indeed:

- Direct consumer Indeed APIs are not reliable/obvious for this use case.
- MVP should treat Indeed as Gmail-derived unless/until an official API or user-approved export/source exists.

---

## Data Model

### IntegrationSource

```ts
type IntegrationSource = "gmail" | "google_calendar" | "indeed";
```

### DetectedActivityStatus

```ts
type DetectedActivityStatus = "pending" | "logged" | "ignored" | "linked";
```

### DetectedActivityType

```ts
type DetectedActivityType =
  | "job_application"
  | "recruiter_reply"
  | "interview_request"
  | "client_lead"
  | "invoice"
  | "payment_notice"
  | "follow_up"
  | "unanswered_opportunity"
  | "calendar_interview"
  | "calendar_client_call"
  | "calendar_networking"
  | "work_block"
  | "deadline"
  | "weekly_review"
  | "application_status_change"
  | "saved_job";
```

### SuggestedClassification

Reuse existing `MomentumClass` and `ActivityCategory` where possible:

```ts
interface SuggestedClassification {
  category: ActivityCategory;
  momentum: MomentumClass;
  creates?: "activity" | "income_event" | "follow_up" | "opportunity";
}
```

### DetectedActivity

```ts
interface DetectedActivity {
  id: string;
  source: IntegrationSource;
  sourceId: string;
  detectedAt: number;
  eventDate?: string;
  title: string;
  summary: string;
  suggestedType: DetectedActivityType;
  suggestedClassification: SuggestedClassification;
  confidence: number; // 0-1
  status: DetectedActivityStatus;
  linkedActivityId?: string;
  linkedOpportunityId?: string;
  rawMetadata: {
    fromDomain?: string;
    senderLabel?: string;
    subjectHash?: string;
    calendarId?: string;
    calendarEventLink?: string;
    provider?: string;
    threadId?: string;
    messageId?: string;
    eventId?: string;
  };
}
```

Privacy rules:

- Store `fromDomain`, not full sender, unless the user explicitly confirms an opportunity contact.
- Store short summary/snippet generated from metadata, not full email body.
- Store source IDs so the app can dedupe and deep-link later.
- Do not store attachments or full message bodies in the prototype.

### Opportunity

```ts
interface Opportunity {
  id: string;
  title: string;
  companyOrClient?: string;
  source?: IntegrationSource | "manual";
  stage: "lead" | "applied" | "replied" | "interview" | "offer" | "won" | "lost";
  createdAt: number;
  updatedAt: number;
  detectedActivityIds: string[];
}
```

### IncomeEvent

```ts
interface IncomeEvent {
  id: string;
  title: string;
  amount?: number;
  eventDate: string;
  source?: IntegrationSource | "manual";
  detectedActivityId?: string;
  opportunityId?: string;
  notes?: string;
}
```

### FollowUp

```ts
interface FollowUp {
  id: string;
  title: string;
  dueDate?: string;
  source?: IntegrationSource | "manual";
  detectedActivityId?: string;
  opportunityId?: string;
  status: "open" | "done" | "dismissed";
  createdAt: number;
}
```

### IntegrationConnection

Replace or extend current `ConnectionDetails` over time:

```ts
interface IntegrationConnection {
  id: IntegrationSource;
  label: string;
  status: "mock" | "connected" | "error" | "disconnected";
  connectedAt?: number;
  lastSyncAt?: number;
  scopes: string[];
  readOnly: boolean;
  canDisconnect: boolean;
  privacySummary: string;
  errorMessage?: string;
}
```

Prototype storage keys:

- `pg_detected_activities`
- `pg_opportunities`
- `pg_income_events`
- `pg_followups`
- `pg_integration_connections`

---

## Detection Rules

### Gmail Signals

Read-only Gmail search should initially use metadata-first queries:

- Applications: `("application" OR "applied" OR "we received") ("job" OR "position" OR "role") newer_than:30d`
- Recruiter replies: `(recruiter OR talent OR hiring) (reply OR interested OR interview) newer_than:30d`
- Interview requests: `(interview OR "schedule a time" OR calendly OR "availability") newer_than:30d`
- Client leads: `("project" OR "proposal" OR "quote" OR "estimate") newer_than:30d`
- Invoices/payment: `(invoice OR paid OR payment OR payout OR receipt) newer_than:30d`
- Follow-ups/unanswered: sent threads with opportunity terms and no newer response after N days.
- Indeed fallback: `from:(indeed.com) OR subject:(Indeed)` plus application/status/interview terms.

Gmail normalized examples:

- Indeed application confirmation -> `job_application`, category `application`, momentum `advanced_opportunity`, confidence 0.85.
- Recruiter asks availability -> `interview_request`, category `application`, momentum `advanced_opportunity`, confidence 0.9.
- Payment received -> `payment_notice`, category `selling`, momentum `direct_money`, confidence 0.95.
- Proposal inquiry -> `client_lead`, category `selling`, momentum `advanced_opportunity`, confidence 0.75.

### Google Calendar Signals

Read-only Calendar list over next/past 14-30 days:

- Interview: title/description/attendees contain `interview`, `recruiter`, `hiring`, `talent`, `screen`.
- Client call: `client`, `proposal`, `project`, `invoice`, `contract`, customer domain attendees.
- Networking: `coffee`, `network`, `intro`, `mentor`, `referral`.
- Work block: `work block`, `apply`, `portfolio`, `deliver`, `shift`.
- Follow-up reminders/deadlines: `follow up`, `deadline`, `due`, `send`, `reply`.
- Weekly review: `weekly review`, `review income`, `pipeline review`.

Calendar mapping:

- Past interview/client/networking calls -> suggested Activity.
- Future interview/client/deadline/follow-up -> suggested FollowUp/reminder.
- Weekly review -> suggested Activity if completed/past; FollowUp if future.

### Indeed Signals

Direct Indeed should be assessed as follows:

1. Check official public APIs and partner requirements before implementation.
2. If no user-accessible read-only API exists, do not scrape or automate job applications.
3. Use Gmail-derived Indeed notifications as MVP source:
   - Application submitted confirmations.
   - Employer viewed application.
   - Employer message/recruiter reply.
   - Interview/scheduling emails.
   - Application status updates.
4. Later possible user-controlled paths:
   - Email parsing.
   - User-uploaded export/screenshot/manual import.
   - Browser extension only if user explicitly wants it and privacy review is done.

---

## UI Plan

### Navigation

Add a new top header button:

- `DETECTED` with a badge count of pending detected activities.

Screen enum should become:

```ts
type Screen = "list" | "detected" | "projection" | "countdown" | "classify" | "history" | "settings";
```

### Detected Activity Inbox Screen

Purpose text:

> Possible income-growth signals from connected tools. Nothing here is logged until you confirm it.

Sections:

- Pending count and source filters.
- Connection status card: Gmail, Calendar, Indeed.
- Pending detected cards.
- Ignored/logged optional collapsed history later.

Detected card content:

- Source badge: Gmail / Calendar / Indeed email.
- Confidence badge: High / Medium / Low.
- Event date.
- Title.
- Privacy-safe summary.
- Suggested type and classification.
- Action buttons:
  - `LOG IT`
  - `IGNORE`
  - `LINK`
  - `INCOME`
  - `FOLLOW UP`

MVP link behavior:

- `LOG IT` creates `Activity` using suggested category/momentum and marks DetectedActivity `logged`.
- `IGNORE` marks `ignored`.
- `LINK` creates or selects an `Opportunity`. For first MVP, can create a new `Opportunity` from the detected title and mark `linked`.
- `INCOME` creates `IncomeEvent` with optional amount blank and marks `linked`.
- `FOLLOW UP` creates `FollowUp` with title and optional due date/event date and marks `linked`.

### Settings Screen

Add integration privacy copy:

- Gmail: read-only email metadata/snippets for income-related searches. No sending. No full body storage by default.
- Calendar: read-only event metadata for income-related events. No event creation/editing/deletion.
- Indeed: direct connection not enabled in MVP; detected via Indeed notification emails when Gmail is connected.

Add disconnect behavior:

- Prototype: clear local `IntegrationConnection` status and pending source suggestions if user confirms.
- Real backend later: revoke/delete stored token, then mark disconnected.

---

## Real Integration Architecture

### Why a Backend Becomes Necessary

The static/localStorage app can show a mock inbox, but real OAuth integrations need backend handling because:

- Refresh tokens must not live in localStorage.
- Gmail/Calendar API calls need secure token refresh.
- Sync jobs need controlled rate limiting/deduping.
- A backend lets us store only normalized minimal metadata in the client.

### Smallest Safe Backend/API Route Approach

Add these Next.js route handlers when ready:

- `GET /api/integrations/google/start?services=gmail,calendar`
  - Builds OAuth URL with read-only scopes.
- `GET /api/integrations/google/callback`
  - Exchanges code server-side.
  - Stores encrypted token server-side.
  - Redirects back to app.
- `POST /api/integrations/google/sync`
  - Requires current user/session once auth exists.
  - Reads Gmail/Calendar with read-only scopes.
  - Returns normalized `DetectedActivity[]`.
- `DELETE /api/integrations/google`
  - Deletes token and connection metadata.

Minimum Google scopes:

- Gmail: `https://www.googleapis.com/auth/gmail.readonly`
- Calendar: `https://www.googleapis.com/auth/calendar.readonly`

Storage options in order:

1. If the app remains single-user/self-hosted: encrypted JSON token file or Vercel KV/Postgres with one user ID.
2. If multi-user: real database table keyed by user with encrypted refresh tokens.
3. Never: refresh tokens in browser localStorage.

### Sync Strategy

- Manual `Scan now` first.
- Later scheduled sync every 6-12 hours.
- Use `source + sourceId` dedupe.
- Track `lastSyncAt` and query windows.
- Never mutate source systems.

---

## MVP Implementation Tasks

### Task 1: Add Detected Activity types and storage keys

**Objective:** Add local data types for detected activity, opportunities, income events, follow-ups, and integration connections.

**Files:**
- Modify: `app/components/PreGameApp.tsx`

**Steps:**
1. Add `IntegrationSource`, `DetectedActivityStatus`, `DetectedActivityType`, `SuggestedClassification`, `DetectedActivity`, `Opportunity`, `IncomeEvent`, `FollowUp`, and `IntegrationConnection` near existing types.
2. Add state:
   - `detectedActivities`
   - `opportunities`
   - `incomeEvents`
   - `followUps`
   - `integrationConnections`
3. Hydrate from new `pg_*` storage keys.
4. Save through helper functions.
5. Run `npm run lint`.

### Task 2: Seed mock detected events honestly

**Objective:** Provide example detected events when the user has no detected activity yet.

**Files:**
- Modify: `app/components/PreGameApp.tsx`

**Steps:**
1. Add `MOCK_DETECTED_ACTIVITIES` with 5-7 realistic examples:
   - Gmail Indeed application confirmation.
   - Gmail recruiter reply.
   - Gmail payment notice.
   - Calendar interview.
   - Calendar follow-up reminder.
   - Calendar weekly review.
2. Mark them as mock/source evidence in summaries.
3. Add `Load examples` button or auto-seed only once with clear label.
4. Ensure no UI claims real Google/Indeed connection.
5. Run `npm run lint`.

### Task 3: Add Detected screen navigation

**Objective:** Add a header button and pending count badge.

**Files:**
- Modify: `app/components/PreGameApp.tsx`

**Steps:**
1. Extend `Screen` with `detected`.
2. Add `pendingDetectedCount` derived value.
3. Add `DETECTED` button in the header.
4. Keep mobile width usable by using shorter labels if needed.
5. Run `npm run lint`.

### Task 4: Build Detected Activity Inbox UI

**Objective:** Render pending suggestions with privacy-safe details and action buttons.

**Files:**
- Modify: `app/components/PreGameApp.tsx`

**Steps:**
1. Add `screen === "detected"` render branch.
2. Add source/status cards for Gmail, Calendar, Indeed.
3. Render pending cards sorted by eventDate/detectedAt descending.
4. Show confidence label and source badge.
5. Add empty state: "No pending signals. Real scans will appear here after integrations are connected."
6. Run `npm run lint`.

### Task 5: Implement confirmation actions

**Objective:** Make user actions convert suggestions into permanent records or mark them ignored/linked.

**Files:**
- Modify: `app/components/PreGameApp.tsx`

**Steps:**
1. `logDetectedActivity(id)` creates `Activity` and marks suggestion `logged` with `linkedActivityId`.
2. `ignoreDetectedActivity(id)` marks `ignored`.
3. `linkDetectedOpportunity(id)` creates a minimal `Opportunity` and marks `linked`.
4. `markDetectedIncomeEvent(id)` creates `IncomeEvent` and marks `linked`.
5. `createDetectedFollowUp(id)` creates `FollowUp` and marks `linked`.
6. Save all affected localStorage keys.
7. Run `npm run lint`.

### Task 6: Show resulting records in existing momentum/history surfaces

**Objective:** Make confirmed detected activities visible in the current app without adding excessive new screens.

**Files:**
- Modify: `app/components/PreGameApp.tsx`

**Steps:**
1. Confirm `LOG IT` records appear in Activity History.
2. Add small sections to Detected screen for newly created opportunities, income events, and follow-ups, or add compact counts.
3. Avoid overbuilding full CRM UI in MVP.
4. Run `npm run lint`.

### Task 7: Add settings privacy copy and disconnect behavior

**Objective:** Make integration permissions transparent and reversible.

**Files:**
- Modify: `app/components/PreGameApp.tsx`

**Steps:**
1. Add Integration Privacy section in Settings.
2. Explain read-only Gmail/Calendar and Gmail-derived Indeed fallback.
3. Add prototype disconnect buttons that clear connection status or source pending suggestions after confirmation.
4. Run `npm run lint`.

### Task 8: Browser QA

**Objective:** Verify the product flow end-to-end.

**Files:**
- No source edits unless bugs are found.

**Steps:**
1. Run `npm run build`.
2. Run `npm run dev`.
3. Open the app.
4. Verify Detected button and pending count.
5. Load examples if needed.
6. Click each action:
   - Log it creates Activity History entry.
   - Ignore removes from pending.
   - Link creates opportunity count/record.
   - Income creates income event count/record.
   - Follow up creates follow-up count/record.
7. Verify reset clears new storage keys too.

---

## Later Real Gmail/Calendar Tasks

### Phase 2: Google OAuth Planning

1. Decide deployment target and token store.
2. Create Google Cloud OAuth client.
3. Enable Gmail API and Google Calendar API.
4. Configure read-only scopes only.
5. Add route handlers for start/callback/disconnect.
6. Add server-side token encryption.
7. Add manual `Scan now` action.
8. Return normalized `DetectedActivity[]` to browser.
9. Keep raw emails/calendar events out of localStorage.

### Phase 3: Gmail Detector

1. Implement query batches by signal family.
2. Fetch metadata/snippets only first.
3. Fetch message body only for low-confidence cases if absolutely necessary and never persist full body.
4. Normalize to `DetectedActivity`.
5. Dedupe by Gmail message/thread ID.
6. Unit-test detector fixtures.

### Phase 4: Calendar Detector

1. Fetch events in configurable lookback/lookahead windows.
2. Classify by title/description/attendees.
3. Past events suggest Activities.
4. Future events suggest FollowUps.
5. Dedupe by calendar event ID.
6. Unit-test detector fixtures.

### Phase 5: Indeed Assessment

1. Research official Indeed API availability and terms.
2. If no appropriate read-only API exists, document direct integration as unsupported.
3. Implement Gmail-derived Indeed detector.
4. Add UI copy: "Indeed signals are detected from Indeed emails through Gmail."
5. Revisit direct integration only with an official API, export, or explicit user-approved workflow.

---

## Acceptance Criteria

- The app has a Detected Activity Inbox.
- Mock Gmail/Calendar/Indeed-derived suggestions appear without pretending they are real integrations.
- Suggestions are pending by default.
- User can log, ignore, link, mark income, or create follow-up from a suggestion.
- Permanent Activity/IncomeEvent/FollowUp records are created only after confirmation.
- Privacy copy clearly explains what real integrations would read.
- Real OAuth tokens are not stored in browser localStorage.
- Indeed direct access is treated honestly; Gmail-derived fallback is the MVP path.
- The system helps answer: "What happened in my real world that might move income forward?"
