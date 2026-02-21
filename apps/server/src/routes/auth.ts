import { Router } from "express";
import {
  disconnectGmail,
  exchangeCodeAndStoreToken,
  getGmailConnectionStatus,
  getGoogleAuthUrl
} from "../services/gmail-auth.js";

export const authRouter = Router();

authRouter.get("/auth/google/start", (_req, res) => {
  try {
    const authUrl = getGoogleAuthUrl();
    return res.json({ authUrl });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create auth URL" });
  }
});

authRouter.get("/auth/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!code) return res.status(400).json({ error: "Missing code parameter" });

  try {
    const result = await exchangeCodeAndStoreToken(code);
    return res.json({ connected: true, connectedEmail: result.connectedEmail });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "OAuth callback failed" });
  }
});

authRouter.get("/auth/google/status", async (_req, res) => {
  const status = await getGmailConnectionStatus();
  res.json(status);
});

authRouter.post("/auth/google/disconnect", async (_req, res) => {
  await disconnectGmail();
  res.json({ disconnected: true });
});
