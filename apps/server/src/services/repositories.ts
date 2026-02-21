import { randomUUID } from "node:crypto";

const now = Date.now();
const defaultThreads = [
  {
    id: "t1",
    subject: "Need decision on Q2 hiring plan by 4PM",
    participants: ["alex@board.com", "you@company.com"],
    snippet: "Can you confirm headcount and budget by this afternoon?",
    lastMessageAt: new Date(now - 1000 * 60).toISOString(),
    state: "priority",
    priority: { score: 0.92, level: "P1", reasons: ["VIP sender", "Deadline mention"] }
  },
  {
    id: "t2",
    subject: "Your Certificate Has Been Revoked",
    participants: ["apple-developer@notices.com", "you@company.com"],
    snippet: "Dear Manmeet, your developer certificate was revoked. Review details attached.",
    lastMessageAt: new Date(now - 1000 * 60 * 19).toISOString(),
    state: "priority",
    priority: { score: 0.87, level: "P1", reasons: ["Account security signal"] }
  },
  {
    id: "t3",
    subject: "myGS1 Multi-Factor Authentication",
    participants: ["support@gs1.org", "you@company.com"],
    snippet: "This is a friendly reminder to update your MFA policy for enterprise accounts.",
    lastMessageAt: new Date(now - 1000 * 60 * 33).toISOString(),
    state: "priority",
    priority: { score: 0.81, level: "P2", reasons: ["Access control update"] }
  },
  {
    id: "t4",
    subject: "Friendly Reminder - Mobility Unlimited Survey",
    participants: ["carly@trexo.com", "you@company.com"],
    snippet: "Quick reminder to complete the annual survey before end of week.",
    lastMessageAt: new Date(now - 1000 * 60 * 54).toISOString(),
    state: "inbox",
    priority: { score: 0.75, level: "P2", reasons: ["Stakeholder follow-up"] }
  },
  {
    id: "t5",
    subject: "Trexo Holdings, Inc Sales Tax Returns",
    participants: ["payroll@trexo.com", "you@company.com"],
    snippet: "Hi Jazmine, appreciate it, we have enough funds. Have a good weekend.",
    lastMessageAt: new Date(now - 1000 * 60 * 70).toISOString(),
    state: "inbox",
    priority: { score: 0.73, level: "P2", reasons: ["Finance workflow"] }
  },
  {
    id: "t6",
    subject: "Thank You for the Opportunity to Meet the Trexo Team",
    participants: ["greg@investor.com", "you@company.com"],
    snippet: "Good streak Manmeet. Best regards, Greg.",
    lastMessageAt: new Date(now - 1000 * 60 * 93).toISOString(),
    state: "priority",
    priority: { score: 0.84, level: "P1", reasons: ["Investor sender"] }
  },
  {
    id: "t7",
    subject: "Poland - WHX talks",
    participants: ["bizdev@partner.co", "you@company.com"],
    snippet: "Hope you are safe back home and ready to do business in Poland.",
    lastMessageAt: new Date(now - 1000 * 60 * 126).toISOString(),
    state: "waiting",
    priority: { score: 0.62, level: "P2", reasons: ["Follow-up due"] }
  },
  {
    id: "t8",
    subject: "T4 Summary and T4 Slips - 2023, 2024, and 2025",
    participants: ["finance@ecisoftware.com", "you@company.com"],
    snippet: "Please find attached the T4 summary and T4 slips for the years requested.",
    lastMessageAt: new Date(now - 1000 * 60 * 60 * 5).toISOString(),
    state: "inbox",
    priority: { score: 0.58, level: "P3", reasons: ["Informational"] }
  },
  {
    id: "t9",
    subject: "Fwd: DEMAND LETTER - 260174",
    participants: ["legal@ecisoftware.com", "you@company.com"],
    snippet: "777.68 USD please wire as soon as possible.",
    lastMessageAt: new Date(now - 1000 * 60 * 60 * 8).toISOString(),
    state: "priority",
    priority: { score: 0.86, level: "P1", reasons: ["Legal/financial risk"] }
  },
  {
    id: "t10",
    subject: "Fwd: Review Engagement - Trexo Robotics",
    participants: ["firdaus@trexo.com", "you@company.com"],
    snippet: "Please find attached general ledger reports for US and Canada.",
    lastMessageAt: new Date(now - 1000 * 60 * 60 * 11).toISOString(),
    state: "inbox",
    priority: { score: 0.67, level: "P2", reasons: ["Operational workload"] }
  }
];
let threads = [...defaultThreads];
const threadMessages = new Map<string, { sender: string; body: string; timestamp: string }[]>();
const mailDrafts: Array<{
  id: string;
  threadId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  status: "drafted" | "sent";
  createdAt: string;
}> = [];

const tasks: Array<Record<string, unknown>> = [];
const drafts: Array<Record<string, unknown>> = [];

export function listThreads(view?: string) {
  if (!view || view === "inbox") return threads;
  return threads.filter((t) => t.state === view || (view === "priority" && (t.priority.level === "P1" || t.priority.level === "P2")));
}

export function listMailThreads(folder: string, query?: string) {
  let filtered = [...threads];
  if (folder === "priority" || folder === "important") {
    filtered = filtered.filter((t) => t.priority.level === "P1" || t.priority.level === "P2");
  } else if (folder === "snoozed") {
    filtered = filtered.filter((t) => t.state === "snoozed");
  } else if (folder === "waiting") {
    filtered = filtered.filter((t) => t.state === "waiting");
  } else if (folder === "done") {
    filtered = filtered.filter((t) => t.state === "done");
  } else if (folder === "inbox") {
    filtered = filtered.filter((t) => t.state !== "done");
  }

  if (query?.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (thread) =>
        thread.subject.toLowerCase().includes(q) ||
        (thread.snippet ?? "").toLowerCase().includes(q) ||
        thread.participants.some((participant) => participant.toLowerCase().includes(q))
    );
  }

  return filtered;
}

export function getThread(threadId: string) {
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return undefined;
  const messages = threadMessages.get(thread.id);

  return {
    ...thread,
    messages:
      messages?.map((message, index) => ({
        id: `m-${thread.id}-${index + 1}`,
        sender: message.sender,
        body: message.body,
        timestamp: message.timestamp
      })) ?? [
        {
          id: `m-${thread.id}`,
          sender: thread.participants[0],
          body: thread.snippet ?? "No message preview available.",
          timestamp: thread.lastMessageAt
        }
      ]
  };
}

export function createDraft(threadId: string, tone: string, constraints?: string) {
  const draft = {
    id: randomUUID(),
    threadId,
    content: `Hi Alex,\\n\\nConfirmed. We can support this plan. ${constraints ?? ""}\\n\\nBest,`,
    status: "drafted",
    tone
  };
  drafts.push(draft);
  return draft;
}

export function createMailDraft(payload: {
  threadId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}) {
  const draft = {
    id: randomUUID(),
    threadId: payload.threadId,
    to: payload.to,
    cc: payload.cc ?? [],
    bcc: payload.bcc ?? [],
    subject: payload.subject,
    body: payload.body,
    status: "drafted" as const,
    createdAt: new Date().toISOString()
  };

  mailDrafts.push(draft);
  return draft;
}

export function sendMailDraft(draftId: string) {
  const draft = mailDrafts.find((item) => item.id === draftId);
  if (!draft) return null;
  draft.status = "sent";

  if (draft.threadId) {
    const existing = threads.find((thread) => thread.id === draft.threadId);
    if (existing) {
      existing.lastMessageAt = new Date().toISOString();
      existing.snippet = draft.body.slice(0, 180);
    }
    const next = threadMessages.get(draft.threadId) ?? [];
    next.push({
      sender: "you@gmail.com",
      body: draft.body,
      timestamp: new Date().toISOString()
    });
    threadMessages.set(draft.threadId, next);
  }

  return draft;
}

export function sendMailMessage(payload: {
  threadId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
}) {
  if (payload.threadId) {
    const nowIso = new Date().toISOString();
    const existing = threads.find((thread) => thread.id === payload.threadId);
    if (existing) {
      existing.lastMessageAt = nowIso;
      existing.snippet = payload.body.slice(0, 180);
    }

    const next = threadMessages.get(payload.threadId) ?? [];
    next.push({
      sender: "you@gmail.com",
      body: payload.body,
      timestamp: nowIso
    });
    threadMessages.set(payload.threadId, next);

    return {
      id: `msg_${randomUUID().slice(0, 10)}`,
      threadId: payload.threadId
    };
  }

  const threadId = `local_${randomUUID().slice(0, 8)}`;
  const nowIso = new Date().toISOString();

  threads.unshift({
    id: threadId,
    subject: payload.subject || "(No subject)",
    participants: [payload.to[0] ?? "unknown@recipient", "you@gmail.com"],
    snippet: payload.body.slice(0, 180),
    lastMessageAt: nowIso,
    state: "inbox",
    priority: { score: 0.52, level: "P3", reasons: ["Outgoing message"] }
  });

  threadMessages.set(threadId, [
    {
      sender: "you@gmail.com",
      body: payload.body,
      timestamp: nowIso
    }
  ]);

  return {
    id: `msg_${randomUUID().slice(0, 10)}`,
    threadId
  };
}

export function applyThreadAction(threadId: string, action: string) {
  const thread = threads.find((item) => item.id === threadId);
  if (!thread) return null;

  if (action === "archive") thread.state = "done";
  if (action === "unarchive") thread.state = "inbox";
  if (action === "snooze") thread.state = "snoozed";
  if (action === "unsnooze") thread.state = "inbox";
  if (action === "trash") thread.state = "done";
  if (action === "mark_read") (thread as Record<string, unknown>).unread = false;
  if (action === "mark_unread") (thread as Record<string, unknown>).unread = true;

  return thread;
}

export function approveAndSendDraft(draftId: string) {
  const draft = drafts.find((d) => d.id === draftId);
  if (!draft) return { sent: false };
  draft.status = "sent";
  return { sent: true };
}

export function listTasks() {
  return tasks;
}

export function createTask(payload: { threadId: string; title: string; dueAt?: string }) {
  const task = {
    id: randomUUID(),
    sourceThreadId: payload.threadId,
    title: payload.title,
    status: "queued",
    dueAt: payload.dueAt
  };
  tasks.push(task);
  return task;
}

export function replaceThreadsWithGmail(
  gmailThreads: Array<{
    id: string;
    subject: string;
    from: string;
    snippet: string;
    timestamp: string;
    body: string;
    state: "inbox" | "priority" | "needs_reply" | "waiting" | "snoozed" | "delegated" | "done";
    priority: { score: number; level: "P1" | "P2" | "P3"; reasons: string[] };
  }>
) {
  if (gmailThreads.length === 0) return;

  threads = gmailThreads.map((thread) => ({
    id: thread.id,
    subject: thread.subject,
    participants: [thread.from, "you@gmail.com"],
    snippet: thread.snippet,
    lastMessageAt: thread.timestamp,
    state: thread.state,
    priority: thread.priority
  }));

  threadMessages.clear();
  for (const thread of gmailThreads) {
    threadMessages.set(thread.id, [
      {
        sender: thread.from,
        body: thread.body || thread.snippet,
        timestamp: thread.timestamp
      }
    ]);
  }
}

export function resetThreadsToMockData() {
  threads = [...defaultThreads];
  threadMessages.clear();
}
