import { Router } from "express";
import { draftSchema } from "../middleware/validate.js";
import { approveAndSendDraft, createDraft } from "../services/repositories.js";
import { recordAudit } from "../services/audit-log.js";

export const draftsRouter = Router();

draftsRouter.post("/drafts", (req, res) => {
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const draft = createDraft(parsed.data.threadId, parsed.data.tone, parsed.data.constraints);
  return res.status(201).json(draft);
});

draftsRouter.post("/drafts/:draftId/approve-send", (req, res) => {
  const approvalToken = req.body?.approvalToken;
  if (!approvalToken || typeof approvalToken !== "string") {
    return res.status(400).json({ error: "approvalToken required" });
  }

  const result = approveAndSendDraft(req.params.draftId);
  if (result.sent) {
    recordAudit({
      type: "draft.sent",
      actor: "user",
      payload: { draftId: req.params.draftId }
    });
  }

  return res.json(result);
});
