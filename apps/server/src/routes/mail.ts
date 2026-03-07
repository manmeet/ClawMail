import { Router } from "express";
import { z } from "zod";
import {
  applyThreadActionForClient,
  createDraftForClient,
  getThreadForClient,
  listMailLabels,
  listThreadsForClient,
  sendDraftForClient,
  sendMessageForClient
} from "../services/gmail-mail.js";

export const mailRouter = Router();

const folderSchema = z.enum(["inbox", "important", "sent", "drafts", "trash", "spam", "snoozed", "all"]);
const threadActionSchema = z.object({
  action: z.enum(["archive", "unarchive", "mark_read", "mark_unread", "snooze", "unsnooze", "trash"])
});
const composeSchema = z.object({
  threadId: z.string().optional(),
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().default(""),
  body: z.string().default("")
});

mailRouter.get("/mail/labels", async (_req, res) => {
  try {
    const labels = await listMailLabels();
    res.json(labels);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to list labels" });
  }
});

mailRouter.get("/mail/threads", async (req, res) => {
  const parsedFolder = folderSchema.safeParse(req.query.folder ?? "inbox");
  if (!parsedFolder.success) {
    return res.status(400).json({ error: "Invalid folder" });
  }

  const query = typeof req.query.q === "string" ? req.query.q : undefined;
  const maxResults = Number(req.query.maxResults ?? 35);
  const pageToken = typeof req.query.pageToken === "string" ? req.query.pageToken : undefined;

  try {
    const result = await listThreadsForClient(parsedFolder.data, query, maxResults, pageToken);
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to list threads" });
  }
});

mailRouter.get("/mail/threads/:threadId", async (req, res) => {
  try {
    const result = await getThreadForClient(req.params.threadId);
    if (!result) return res.status(404).json({ error: "Thread not found" });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to fetch thread" });
  }
});

mailRouter.post("/mail/drafts", async (req, res) => {
  const parsed = composeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await createDraftForClient(parsed.data);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create draft" });
  }
});

mailRouter.post("/mail/drafts/:draftId/send", async (req, res) => {
  try {
    const result = await sendDraftForClient(req.params.draftId);
    if (!result) return res.status(404).json({ error: "Draft not found" });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send draft" });
  }
});

mailRouter.post("/mail/send", async (req, res) => {
  const parsed = composeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await sendMessageForClient(parsed.data);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send message" });
  }
});

mailRouter.post("/mail/threads/:threadId/actions", async (req, res) => {
  const parsed = threadActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await applyThreadActionForClient(req.params.threadId, parsed.data.action);
    if (!result) return res.status(404).json({ error: "Thread not found" });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Failed to apply action" });
  }
});
