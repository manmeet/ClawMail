import { randomUUID } from "node:crypto";

const now = Date.now();
const threads = [
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

const tasks: Array<Record<string, unknown>> = [];
const drafts: Array<Record<string, unknown>> = [];

export function listThreads(view?: string) {
  if (!view || view === "inbox") return threads;
  return threads.filter((t) => t.state === view || (view === "priority" && (t.priority.level === "P1" || t.priority.level === "P2")));
}

export function getThread(threadId: string) {
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return undefined;

  return {
    ...thread,
    messages: [
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
