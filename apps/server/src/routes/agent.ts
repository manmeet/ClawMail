import { Router } from "express";
import { agentActionSchema } from "../middleware/validate.js";
import { proposeAction, runApprovedAction } from "../services/openclaw-orchestrator.js";
import { decideAction } from "../services/policy-engine.js";
import { recordAudit } from "../services/audit-log.js";

export const agentRouter = Router();

agentRouter.post("/threads/:threadId/agent/actions", (req, res) => {
  const parsed = agentActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const proposed = proposeAction({ ...parsed.data, threadId: req.params.threadId });

  recordAudit({
    type: "agent.action.proposed",
    actor: "agent",
    threadId: req.params.threadId,
    payload: proposed
  });

  const decision = decideAction(proposed);

  recordAudit({
    type: "policy.decision",
    actor: "policy",
    threadId: req.params.threadId,
    payload: decision
  });

  if (decision.status === "approved") {
    const execution = runApprovedAction(decision);
    recordAudit({
      type: "tool.executed",
      actor: "system",
      threadId: req.params.threadId,
      payload: execution
    });
  }

  if (decision.status === "approval_required" && decision.approval) {
    recordAudit({
      type: "approval.created",
      actor: "system",
      threadId: req.params.threadId,
      payload: decision.approval
    });
  }

  return res.json(decision);
});
