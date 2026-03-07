import { Router } from "express";
import { z } from "zod";
import { getThreadForClient } from "../services/gmail-mail.js";
import { runIronclawAgent } from "../services/ironclaw-agent.js";

export const agentChatRouter = Router();

const agentChatSchema = z.object({
  message: z.string().min(1),
  threadId: z.string().min(1).optional(),
  mailboxAccount: z.string().min(1).optional(),
  allowThreadAccess: z.boolean().optional(),
  autoThreadDetect: z.boolean().optional()
});

const THREAD_RELATED_PATTERNS = [
  /\bthis thread\b/i,
  /\bthis email\b/i,
  /\bthsi email\b/i,
  /\bthsi thread\b/i,
  /\bwhat(?:'s| is)?\s+(?:this|thsi)\s+(?:email|thread)\s+about\b/i,
  /\bwhat\s+is\s+this\s+about\b/i,
  /\bwhat\s+is\s+the\s+email\s+about\b/i,
  /\bwhat(?:'s| is)?\s+going\s+on\s+in\s+(?:this|the)\s+(?:email|thread)\b/i,
  /\blook at (the )?thread\b/i,
  /\baccess (the )?thread\b/i,
  /\bcheck (the )?thread\b/i,
  /\bread (the )?thread\b/i,
  /\breview (the )?thread\b/i,
  /\bwhat (?:does|did) (?:this|the) (?:email|thread) (?:say|mean)\b/i,
  /\bsummarize\b/i,
  /\bsummary\b/i,
  /\breply\b/i,
  /\brespond\b/i,
  /\bdraft\b/i,
  /\bwho sent\b/i,
  /\bwhat should i (say|reply)\b/i,
  /\bsubject\b/i,
  /\bmessage above\b/i
];

type ThreadContext = {
  id: string;
  subject: string;
  participants: string[];
  messages: Array<{ sender: string; body: string; timestamp: string }>;
};

function truncate(value: string, max = 400): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}...`;
}

function normalizeSessionToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function isThreadRelatedMessage(message: string): boolean {
  return THREAD_RELATED_PATTERNS.some((pattern) => pattern.test(message));
}

function buildSessionKey(threadId: string | undefined, mailboxAccount: string | undefined): string {
  const accountKey = normalizeSessionToken(mailboxAccount ?? "default");
  if (threadId) return `clawmail:${accountKey}:thread:${threadId}`;
  return `clawmail:${accountKey}:inbox`;
}

function toThreadContext(data: Record<string, unknown>): ThreadContext {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const normalizedMessages = messages
    .slice(-3)
    .map((message) => {
      if (!message || typeof message !== "object") return null;
      const sender = (message as Record<string, unknown>).sender;
      const body = (message as Record<string, unknown>).body;
      const timestamp = (message as Record<string, unknown>).timestamp;

      if (typeof sender !== "string" || typeof body !== "string") return null;
      return {
        sender,
        body: truncate(body, 1200),
        timestamp: typeof timestamp === "string" ? timestamp : new Date().toISOString()
      };
    })
    .filter((item): item is { sender: string; body: string; timestamp: string } => Boolean(item));

  return {
    id: typeof data.id === "string" ? data.id : "unknown",
    subject: typeof data.subject === "string" ? data.subject : "(No subject)",
    participants: Array.isArray(data.participants)
      ? data.participants.filter((item): item is string => typeof item === "string")
      : [],
    messages: normalizedMessages
  };
}

function buildPrompt(message: string, threadContext: ThreadContext | null): string {
  const directives = [
    "You are ClawMail's right-pane executive assistant.",
    "Never send email or execute outbound actions.",
    "You may draft response text and suggest tasks.",
    "If thread context is missing, state that clearly and ask the user to attach the thread."
  ].join("\n");

  if (!threadContext) {
    return `${directives}\n\nNo thread context is currently attached.\n\nUser request:\n${message}`;
  }

  const messageBlock = threadContext.messages
    .map((item, index) => `${index + 1}. ${item.sender} (${item.timestamp}): ${item.body}`)
    .join("\n");

  return `${directives}\n\nAttached thread context:\nThread ID: ${threadContext.id}\nSubject: ${threadContext.subject}\nParticipants: ${
    threadContext.participants.join(", ") || "unknown"
  }\nRecent messages:\n${messageBlock || "No messages"}\n\nUser request:\n${message}`;
}

agentChatRouter.post("/agent/chat", async (req, res) => {
  const parsed = agentChatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const autoThreadDetect = parsed.data.autoThreadDetect ?? true;
  const allowThreadAccess = parsed.data.allowThreadAccess ?? false;
  const threadId = parsed.data.threadId;

  const threadIntentDetected = autoThreadDetect && isThreadRelatedMessage(parsed.data.message);
  const shouldAttachThread = Boolean(threadId) && (allowThreadAccess || threadIntentDetected);

  let threadAttachReason = "Thread context not requested.";
  let threadContext: ThreadContext | null = null;

  if (shouldAttachThread && threadId) {
    try {
      const threadResponse = await getThreadForClient(threadId);
      if (!threadResponse) {
        threadAttachReason = "Thread requested but not found.";
      } else {
        threadContext = toThreadContext(threadResponse.item as Record<string, unknown>);
        threadAttachReason = allowThreadAccess
          ? "Thread context attached by explicit request."
          : "Thread context auto-attached from thread-related message.";
      }
    } catch (error) {
      threadAttachReason = error instanceof Error ? `Thread attach failed: ${error.message}` : "Thread attach failed.";
    }
  } else if (!threadId) {
    threadAttachReason = "No open thread selected.";
  }

  const sessionKey = buildSessionKey(threadId, parsed.data.mailboxAccount);
  const prompt = buildPrompt(parsed.data.message.trim(), threadContext);

  try {
    const result = await runIronclawAgent({
      message: prompt,
      sessionKey
    });

    return res.json({
      assistantMessage: result.assistantMessage,
      sessionId: result.sessionId,
      model: result.model,
      sessionKey,
      threadAttached: Boolean(threadContext),
      threadAttachReason
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent chat failed";
    return res.status(502).json({ error: message });
  }
});
