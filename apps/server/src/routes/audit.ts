import { Router } from "express";
import { listAudit } from "../services/audit-log.js";

export const auditRouter = Router();

auditRouter.get("/audit/events", (req, res) => {
  const threadId = typeof req.query.threadId === "string" ? req.query.threadId : undefined;
  res.json({ items: listAudit(threadId) });
});
