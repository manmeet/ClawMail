export type ViewName = "inbox" | "priority" | "needs-reply" | "waiting" | "snoozed" | "delegated" | "done";

export type PriorityScore = {
  score: number;
  level: "P1" | "P2" | "P3";
  reasons: string[];
};

export type Thread = {
  id: string;
  subject: string;
  participants: string[];
  snippet?: string;
  lastMessageAt: string;
  state: "inbox" | "priority" | "needs_reply" | "waiting" | "snoozed" | "delegated" | "done";
  priority: PriorityScore;
};

export type Message = {
  id: string;
  sender: string;
  body: string;
  timestamp: string;
};

export type ThreadDetail = Thread & {
  messages: Message[];
};

export type AgentActionIntent = "summarize" | "draft" | "explain_priority" | "delegate" | "fetch_context" | "send";

export type AgentActionDecision = {
  actionId: string;
  status: "approved" | "denied" | "approval_required";
  reason: string;
  proposedToolCalls?: Array<{ tool: string; args: Record<string, unknown> }>;
  approval?: {
    id: string;
    actionType: "email.send" | "file.share" | "permission.change";
    status: "pending" | "approved" | "expired" | "rejected";
    token: string;
    expiresAt: string;
  };
};
