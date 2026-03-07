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

const THREAD_MUTATING_PATTERNS = [/\bcompose\b/i, /\bsend\b/i, /\breply\b/i, /\brespond\b/i, /\bdraft\b/i];

type ThreadContext = {
  id: string;
  subject: string;
  participants: string[];
  messages: Array<{ sender: string; body: string; timestamp: string }>;
};

type CachedThreadContext = {
  context: ThreadContext;
  expiresAt: number;
};

const THREAD_CONTEXT_CACHE_TTL_MS = 30_000;
const MAX_CONTEXT_MESSAGES = 3;
const threadContextCache = new Map<string, CachedThreadContext>();

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

function isThreadMutatingMessage(message: string): boolean {
  return THREAD_MUTATING_PATTERNS.some((pattern) => pattern.test(message));
}

function buildSessionKey(threadId: string | undefined, mailboxAccount: string | undefined): string {
  const accountKey = normalizeSessionToken(mailboxAccount ?? "default");
  if (threadId) return `clawmail:${accountKey}:thread:${threadId}`;
  return `clawmail:${accountKey}:inbox`;
}

function buildThreadContextCacheKey(sessionKey: string, threadId: string): string {
  return `${sessionKey}:thread-context:${threadId}`;
}

function getCachedThreadContext(cacheKey: string): ThreadContext | null {
  const cached = threadContextCache.get(cacheKey);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    threadContextCache.delete(cacheKey);
    return null;
  }

  return cached.context;
}

function setCachedThreadContext(cacheKey: string, context: ThreadContext): void {
  threadContextCache.set(cacheKey, {
    context,
    expiresAt: Date.now() + THREAD_CONTEXT_CACHE_TTL_MS
  });
}

function invalidateThreadContextCache(cacheKey: string): void {
  threadContextCache.delete(cacheKey);
}

function toThreadContext(data: Record<string, unknown>): ThreadContext {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const normalizedMessages = messages
    .slice(-MAX_CONTEXT_MESSAGES)
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
  const trimmedMessage = parsed.data.message.trim();
  const threadMutationRequested = isThreadMutatingMessage(trimmedMessage);
  const sessionKey = buildSessionKey(threadId, parsed.data.mailboxAccount);
  const threadContextCacheKey = threadId ? buildThreadContextCacheKey(sessionKey, threadId) : null;

  const threadIntentDetected = autoThreadDetect && isThreadRelatedMessage(trimmedMessage);
  const shouldAttachThread = Boolean(threadId) && (allowThreadAccess || threadIntentDetected);

  let threadAttachReason = "Thread context not requested.";
  let threadAttachSource: "none" | "cache" | "fresh fetch" = "none";
  let threadContext: ThreadContext | null = null;

  if (threadMutationRequested && threadContextCacheKey) {
    invalidateThreadContextCache(threadContextCacheKey);
  }

  if (shouldAttachThread && threadId && threadContextCacheKey) {
    try {
      const cachedContext = getCachedThreadContext(threadContextCacheKey);
      if (cachedContext) {
        threadContext = cachedContext;
        threadAttachSource = "cache";
        threadAttachReason = allowThreadAccess
          ? "Thread context attached by explicit request."
          : "Thread context auto-attached from thread-related message.";
      } else {
        const threadResponse = await getThreadForClient(threadId);
        if (!threadResponse) {
          threadAttachReason = "Thread requested but not found.";
        } else {
          threadContext = toThreadContext(threadResponse.item as Record<string, unknown>);
          setCachedThreadContext(threadContextCacheKey, threadContext);
          threadAttachSource = "fresh fetch";
          threadAttachReason = allowThreadAccess
            ? "Thread context attached by explicit request."
            : "Thread context auto-attached from thread-related message.";
        }
      }
    } catch (error) {
      threadAttachReason = error instanceof Error ? `Thread attach failed: ${error.message}` : "Thread attach failed.";
    }
  } else if (!threadId) {
    threadAttachReason = "No open thread selected.";
  }

  if (threadAttachSource !== "none") {
    console.info("[agent-chat] thread context source", {
      source: threadAttachSource,
      threadId,
      sessionKey
    });
  }

  const prompt = buildPrompt(trimmedMessage, threadContext);

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
      threadAttachReason,
      threadAttachSource
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent chat failed";
    return res.status(502).json({ error: message });
  }
});
