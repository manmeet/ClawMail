import type {
  AgentChatRequest,
  AgentChatResponse,
  AgentActionDecision,
  AgentActionIntent,
  MailComposePayload,
  MailFolder,
  MailThread,
  MailThreadDetail,
  Thread,
  ThreadDetail,
  ViewName
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

const viewMap: Record<ViewName, string> = {
  inbox: "inbox",
  priority: "priority",
  "needs-reply": "needs_reply",
  waiting: "waiting",
  snoozed: "snoozed",
  delegated: "delegated",
  done: "done"
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchInbox(view: ViewName): Promise<Thread[]> {
  const query = new URLSearchParams({ view: viewMap[view] });
  const response = await fetch(`${API_BASE_URL}/v1/inbox?${query.toString()}`);
  const data = await parseResponse<{ items: Thread[] }>(response);
  return data.items;
}

export async function fetchThread(threadId: string): Promise<ThreadDetail> {
  const response = await fetch(`${API_BASE_URL}/v1/threads/${threadId}`);
  return parseResponse<ThreadDetail>(response);
}

export async function runAgentAction(
  threadId: string,
  intent: AgentActionIntent,
  input: Record<string, unknown>
): Promise<AgentActionDecision> {
  const response = await fetch(`${API_BASE_URL}/v1/threads/${threadId}/agent/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent, input })
  });

  return parseResponse<AgentActionDecision>(response);
}

export async function createDraft(threadId: string, tone: "concise" | "friendly" | "firm", constraints: string) {
  const response = await fetch(`${API_BASE_URL}/v1/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, tone, constraints })
  });

  return parseResponse<{ id: string; content: string; status: string }>(response);
}

export async function getConnectors() {
  const response = await fetch(`${API_BASE_URL}/v1/connectors`);
  return parseResponse<{
    items: Array<{
      id: string;
      name: string;
      connected: boolean;
      account: string | null;
      connectedAt: string | null;
    }>;
  }>(response);
}

export async function getServerVersion() {
  const response = await fetch(`${API_BASE_URL}/v1/version`);
  return parseResponse<{ serverVersion: string; startedAt: string }>(response);
}

export async function startGoogleAuth() {
  const response = await fetch(`${API_BASE_URL}/v1/auth/google/start`);
  return parseResponse<{ authUrl: string }>(response);
}

export async function syncGmail(maxResults = 25) {
  const response = await fetch(`${API_BASE_URL}/v1/sync/gmail?maxResults=${maxResults}`, {
    method: "POST"
  });
  return parseResponse<{ synced: boolean; connectedEmail?: string; importedThreads: number }>(response);
}

export async function listMailThreads(folder: MailFolder, q?: string) {
  const query = new URLSearchParams({ folder });
  if (q?.trim()) query.set("q", q.trim());
  const response = await fetch(`${API_BASE_URL}/v1/mail/threads?${query.toString()}`);
  return parseResponse<{ source: "gmail" | "mock"; items: MailThread[] }>(response);
}

export async function getMailThread(threadId: string) {
  const response = await fetch(`${API_BASE_URL}/v1/mail/threads/${threadId}`);
  return parseResponse<{ source: "gmail" | "mock"; item: MailThreadDetail }>(response);
}

export async function createMailDraft(payload: MailComposePayload) {
  const response = await fetch(`${API_BASE_URL}/v1/mail/drafts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<{ source: "gmail" | "mock"; item: { id: string; status: string; threadId?: string } }>(response);
}

export async function sendMailDraft(draftId: string) {
  const response = await fetch(`${API_BASE_URL}/v1/mail/drafts/${draftId}/send`, {
    method: "POST"
  });
  return parseResponse<{ source: "gmail" | "mock"; item: { id?: string; status: string; threadId?: string } }>(response);
}

export async function sendMail(payload: MailComposePayload) {
  const response = await fetch(`${API_BASE_URL}/v1/mail/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseResponse<{ source: "gmail" | "mock"; item: { id?: string; threadId?: string } }>(response);
}

export async function applyMailThreadAction(
  threadId: string,
  action: "archive" | "unarchive" | "mark_read" | "mark_unread" | "snooze" | "unsnooze" | "trash"
) {
  const response = await fetch(`${API_BASE_URL}/v1/mail/threads/${threadId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  });
  return parseResponse<{ source: "gmail" | "mock"; item: unknown }>(response);
}

export async function chatWithAgent(payload: AgentChatRequest) {
  const response = await fetch(`${API_BASE_URL}/v1/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseResponse<AgentChatResponse>(response);
}
