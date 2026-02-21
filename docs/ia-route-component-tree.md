# Executive Inbox IA, Route Map, and Component Tree

## Product IA

### Global entities
- Account
- Thread
- Message
- PriorityScore
- Draft
- DelegatedTask
- AgentAction
- ApprovalRequest
- AuditEvent

### Primary nav
- Inbox
- Priority
- Needs Reply
- Waiting
- Snoozed
- Delegated
- Done
- Settings

### Views
- Unified list + reading pane
- Thread focus view
- Draft review modal
- Delegated task board
- Global command palette
- Persistent agent sidebar

## Route Map

### Web routes
- `/` -> redirects to `/inbox`
- `/inbox` -> default triage list
- `/inbox/priority` -> P1/P2 sorted feed
- `/inbox/needs-reply` -> threads requiring response
- `/inbox/waiting` -> awaiting external response
- `/inbox/snoozed` -> deferred threads
- `/inbox/delegated` -> delegated task-linked threads
- `/inbox/done` -> completed/archived flow
- `/thread/:threadId` -> focused thread view
- `/tasks` -> delegated tasks board
- `/settings` -> account and policy settings

### API routes (summary)
- `GET /v1/inbox`
- `GET /v1/threads/:threadId`
- `POST /v1/threads/:threadId/triage`
- `POST /v1/threads/:threadId/agent/actions`
- `POST /v1/drafts`
- `POST /v1/drafts/:draftId/approve-send`
- `POST /v1/tasks`
- `POST /v1/approvals`
- `GET /v1/audit/events`

## Component Tree

### App shell
- `RootLayout`
- `CommandPalette`
- `KeyboardShortcutsProvider`
- `ToastLayer`

### Inbox page
- `InboxShell`
- `SidebarNav`
- `TopBar`
- `ThreadList`
- `ThreadListItem`
- `ReadingPane`
- `ThreadHeader`
- `MessageTimeline`
- `ThreadQuickActions`
- `AgentDock`
- `AgentComposer`
- `AgentSuggestionChips`

### Thread page
- `ThreadFocusLayout`
- `ThreadSummaryCard`
- `SourceCitations`
- `ContextCards` (connector-derived)

### Draft flow
- `DraftModal`
- `DraftEditor`
- `DraftDiffView`
- `DraftControls`
- `DraftApprovalBar`

### Tasks
- `TaskBoard`
- `TaskColumn`
- `TaskCard`
- `TaskDetailsPanel`

### Shared states
- `EmptyState`
- `LoadingSkeleton`
- `ErrorPanel`

## Keyboard Map
- `j/k` next/previous thread
- `o` or `Enter` open thread
- `u` back to list
- `e` archive
- `h` snooze
- `x` mark done
- `a` focus agent panel
- `Shift+D` draft with agent
- `Shift+S` summarize thread
- `Shift+P` explain priority
- `Shift+T` delegate task
- `Cmd/Ctrl+K` command palette

## MVP behavior contracts
- Outbound send/share/delete actions never auto-run.
- All high-risk actions require approval token.
- Agent output must cite sources and confidence.
- Thread content is always treated as untrusted input.
