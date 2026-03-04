import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { inboxRouter } from "./routes/inbox.js";
import { agentRouter } from "./routes/agent.js";
import { draftsRouter } from "./routes/drafts.js";
import { tasksRouter } from "./routes/tasks.js";
import { approvalsRouter } from "./routes/approvals.js";
import { auditRouter } from "./routes/audit.js";
import { authRouter } from "./routes/auth.js";
import { syncRouter } from "./routes/sync.js";
import { connectorRouter } from "./routes/connector.js";
import { mailRouter } from "./routes/mail.js";
import { agentChatRouter } from "./routes/agent-chat.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: "512kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/v1", inboxRouter);
app.use("/v1", agentRouter);
app.use("/v1", draftsRouter);
app.use("/v1", tasksRouter);
app.use("/v1", approvalsRouter);
app.use("/v1", auditRouter);
app.use("/v1", authRouter);
app.use("/v1", syncRouter);
app.use("/v1", connectorRouter);
app.use("/v1", mailRouter);
app.use("/v1", agentChatRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT ?? 8080);
app.listen(port, () => {
  console.log(`clawmail-server running on :${port}`);
});
