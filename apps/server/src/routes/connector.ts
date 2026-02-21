import { Router } from "express";
import { getGmailConnectionStatus } from "../services/gmail-auth.js";

export const connectorRouter = Router();

connectorRouter.get("/connectors", async (_req, res) => {
  const gmail = await getGmailConnectionStatus();
  res.json({
    items: [
      {
        id: "gmail",
        name: "Gmail",
        connected: gmail.connected,
        account: gmail.connectedEmail ?? null,
        connectedAt: gmail.connectedAt ?? null
      }
    ]
  });
});
