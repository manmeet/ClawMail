export type ActionIntent = "summarize" | "draft" | "explain_priority" | "delegate" | "fetch_context" | "send";

export type PolicyDecisionStatus = "approved" | "denied" | "approval_required";

export type AgentActionRequest = {
  threadId: string;
  intent: ActionIntent;
  input: Record<string, unknown>;
};

export type AgentActionDecision = {
  actionId: string;
  status: PolicyDecisionStatus;
  reason: string;
  proposedToolCalls?: Array<{ tool: string; args: Record<string, unknown> }>;
  approval?: {
    id: string;
    token: string;
    status: "pending" | "approved" | "expired" | "rejected";
    actionType: "email.send" | "file.share" | "permission.change";
    expiresAt: string;
  };
};

export type AuditEvent = {
  id: string;
  type: "agent.action.proposed" | "policy.decision" | "approval.created" | "draft.sent" | "tool.executed";
  threadId?: string;
  actor: "user" | "agent" | "policy" | "system";
  payload: Record<string, unknown>;
  timestamp: string;
};
