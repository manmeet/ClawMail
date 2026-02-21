import { Router } from "express";
import { getThread, listThreads } from "../services/repositories.js";

export const inboxRouter = Router();

inboxRouter.get("/inbox", (req, res) => {
  const view = typeof req.query.view === "string" ? req.query.view : undefined;
  res.json({ items: listThreads(view) });
});

inboxRouter.get("/threads/:threadId", (req, res) => {
  const thread = getThread(req.params.threadId);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  return res.json(thread);
});

inboxRouter.post("/threads/:threadId/triage", (req, res) => {
  const thread = getThread(req.params.threadId);
  if (!thread) return res.status(404).json({ error: "Thread not found" });
  return res.json(thread.priority);
});
