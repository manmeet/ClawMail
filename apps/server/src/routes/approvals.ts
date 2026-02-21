import { randomUUID } from "node:crypto";
import { Router } from "express";
import { recordAudit } from "../services/audit-log.js";

export const approvalsRouter = Router();

approvalsRouter.post("/approvals", (req, res) => {
  const actionType = req.body?.actionType;
  const preview = req.body?.preview;
  if (!actionType || !preview) return res.status(400).json({ error: "actionType and preview required" });

  const approval = {
    id: randomUUID(),
    actionType,
    status: "pending",
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString()
  };

  recordAudit({
    type: "approval.created",
    actor: "system",
    payload: { ...approval, preview, citations: req.body?.citations ?? [] }
  });

  return res.status(201).json(approval);
});
