import { AgentActionDecision, AgentActionRequest } from "../types/domain.js";

export function proposeAction(request: AgentActionRequest): AgentActionRequest {
  // Placeholder for OpenClaw runtime integration.
  // In production this would include prompt assembly, tool plans, citations, and confidence.
  return request;
}

export function runApprovedAction(decision: AgentActionDecision): Record<string, unknown> {
  return {
    actionId: decision.actionId,
    executed: decision.status === "approved",
    toolCalls: decision.proposedToolCalls ?? []
  };
}
