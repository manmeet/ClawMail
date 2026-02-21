import { randomUUID } from "node:crypto";
import { AgentActionDecision, AgentActionRequest } from "../types/domain.js";

const HIGH_RISK_INTENTS = new Set(["send"]);

export function decideAction(request: AgentActionRequest): AgentActionDecision {
  if (HIGH_RISK_INTENTS.has(request.intent)) {
    return {
      actionId: randomUUID(),
      status: "approval_required",
      reason: "Outbound action requires explicit approval token.",
      approval: {
        id: randomUUID(),
        token: randomUUID(),
        status: "pending",
        actionType: "email.send",
        expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString()
      }
    };
  }

  if (request.intent === "fetch_context" && request.input.scope === "all") {
    return {
      actionId: randomUUID(),
      status: "denied",
      reason: "Broad connector fetch is not allowed; scope must be narrowed."
    };
  }

  return {
    actionId: randomUUID(),
    status: "approved",
    reason: "Action allowed by default policy.",
    proposedToolCalls: [
      {
        tool: `agent.${request.intent}`,
        args: request.input
      }
    ]
  };
}
