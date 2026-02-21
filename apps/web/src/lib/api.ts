import type { AgentActionDecision, AgentActionIntent, Thread, ThreadDetail, ViewName } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

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
