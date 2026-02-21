import { Router } from "express";
import { recordAudit } from "../services/audit-log.js";
import { replaceThreadsWithGmail } from "../services/repositories.js";
import { syncGmailInbox } from "../services/gmail-sync.js";

export const syncRouter = Router();

syncRouter.post("/sync/gmail", async (req, res) => {
  const requested = Number(req.query.maxResults ?? 25);

  try {
    const result = await syncGmailInbox(Number.isFinite(requested) ? requested : 25);
    replaceThreadsWithGmail(result.threads);

    recordAudit({
      type: "tool.executed",
      actor: "system",
      payload: {
        tool: "gmail.sync",
        count: result.threads.length,
        connectedEmail: result.connectedEmail
      }
    });

    return res.json({
      synced: true,
      connectedEmail: result.connectedEmail,
      importedThreads: result.threads.length
    });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Gmail sync failed" });
  }
});
