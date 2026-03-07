import { google } from "googleapis";
import { getConnectedGmailClient } from "./gmail-auth.js";
import {
  applyThreadAction,
  createMailDraft,
  getThread,
  listMailThreads,
  sendMailDraft,
  sendMailMessage
} from "./repositories.js";

type MailFolder = "inbox" | "important" | "sent" | "drafts" | "trash" | "spam" | "snoozed" | "all";

type ComposePayload = {
  threadId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
};

function isInsufficientScopeError(error: unknown) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
  const lower = message.toLowerCase();
  return lower.includes("insufficient permission") || lower.includes("insufficientpermissions") || lower.includes("insufficient_scope");
}

function base64Url(input: string) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildMime(payload: ComposePayload) {
  const lines = [
    `To: ${payload.to.join(", ")}`,
    payload.cc?.length ? `Cc: ${payload.cc.join(", ")}` : "",
    payload.bcc?.length ? `Bcc: ${payload.bcc.join(", ")}` : "",
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "MIME-Version: 1.0",
    `Subject: ${payload.subject || "(No subject)"}`,
    "",
    payload.body || ""
  ].filter(Boolean);

  return base64Url(lines.join("\r\n"));
}

function folderToLabel(folder: MailFolder): string[] | undefined {
  if (folder === "all") return undefined;
  if (folder === "inbox") return ["INBOX"];
  if (folder === "important") return ["INBOX", "IMPORTANT"];
  if (folder === "sent") return ["SENT"];
  if (folder === "drafts") return ["DRAFT"];
  if (folder === "trash") return ["TRASH"];
  if (folder === "spam") return ["SPAM"];
  if (folder === "snoozed") return ["SNOOZED"];
  return undefined;
}

function getHeader(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  }
  if (Array.isArray(payload.parts)) {
    const plain = payload.parts.find((part: any) => part.mimeType === "text/plain");
    if (plain?.body?.data) {
      return Buffer.from(plain.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    }
    const html = payload.parts.find((part: any) => part.mimeType === "text/html");
    if (html?.body?.data) {
      return Buffer.from(html.body.data.replace(/-/g, "+").replace(/_/g, "/"), "base64")
        .toString("utf8")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  return "";
}

function parseFrom(rawFrom: string) {
  const match = rawFrom.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0] ?? (rawFrom || "Unknown sender");
}

function compactPreview(value: string, maxLen = 180) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen).trimEnd()}...`;
}

async function buildThreadSnippet(
  gmail: ReturnType<typeof google.gmail>,
  latestMessageId: string | undefined,
  existingSnippet: string | undefined
) {
  const direct = compactPreview(existingSnippet ?? "");
  if (direct) return direct;
  if (!latestMessageId) return "";

  try {
    const message = await gmail.users.messages.get({
      userId: "me",
      id: latestMessageId,
      format: "full"
    });
    return compactPreview(extractBody(message.data.payload) || message.data.snippet || "");
  } catch {
    return "";
  }
}

export async function listMailLabels() {
  const connection = await getConnectedGmailClient();
  if (!connection) {
    return {
      source: "mock" as const,
      items: [
        { id: "INBOX", name: "Inbox" },
        { id: "IMPORTANT", name: "Important" },
        { id: "SNOOZED", name: "Snoozed" },
        { id: "SENT", name: "Sent" },
        { id: "TRASH", name: "Trash" }
      ]
    };
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });
  const labels = await gmail.users.labels.list({ userId: "me" });

  return {
    source: "gmail" as const,
    items: (labels.data.labels ?? []).map((label) => ({
      id: label.id ?? "",
      name: label.name ?? ""
    }))
  };
}

export async function listThreadsForClient(folder: MailFolder, query?: string, maxResults = 35) {
  const connection = await getConnectedGmailClient();

  if (!connection) {
    return {
      source: "mock" as const,
      items: listMailThreads(folder, query)
    };
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });
  const list = await gmail.users.threads.list({
    userId: "me",
    labelIds: folderToLabel(folder),
    maxResults: Math.max(1, Math.min(maxResults, 50)),
    q: query || undefined
  });

  const threadIds = list.data.threads ?? [];
  const items = await Promise.all(
    threadIds.map(async (threadRef) => {
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadRef.id ?? "",
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"]
      });

      const latest = thread.data.messages?.[thread.data.messages.length - 1];
      const headers = latest?.payload?.headers ?? [];
      const subject = getHeader(headers, "Subject") || "(No subject)";
      const from = parseFrom(getHeader(headers, "From"));
      const dateHeader = getHeader(headers, "Date");
      const parsedDate = dateHeader ? new Date(dateHeader) : null;
      const timestamp = !parsedDate || Number.isNaN(parsedDate.getTime())
        ? new Date(Number(latest?.internalDate ?? Date.now())).toISOString()
        : parsedDate.toISOString();
      const unread = Boolean(latest?.labelIds?.includes("UNREAD"));

      const snippet = await buildThreadSnippet(gmail, latest?.id ?? undefined, thread.data.snippet ?? latest?.snippet ?? "");

      return {
        id: thread.data.id ?? "",
        subject,
        participants: [from],
        snippet,
        lastMessageAt: timestamp,
        state: folder === "important" ? "priority" : folder,
        priority: {
          score: unread ? 0.78 : 0.55,
          level: unread ? "P2" : "P3",
          reasons: unread ? ["Unread in selected folder"] : ["Recently updated"]
        },
        unread
      };
    })
  );

  return {
    source: "gmail" as const,
    items
  };
}

export async function getThreadForClient(threadId: string) {
  const connection = await getConnectedGmailClient();

  if (!connection) {
    const thread = getThread(threadId);
    if (!thread) return null;
    return {
      source: "mock" as const,
      item: thread
    };
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });
  const thread = await gmail.users.threads.get({ userId: "me", id: threadId, format: "full" });
  const messages = thread.data.messages ?? [];
  if (messages.length === 0) return null;

  const latest = messages[messages.length - 1];
  const latestHeaders = latest.payload?.headers ?? [];
  const subject = getHeader(latestHeaders, "Subject") || "(No subject)";
  const from = parseFrom(getHeader(latestHeaders, "From"));

  return {
    source: "gmail" as const,
    item: {
      id: thread.data.id ?? threadId,
      subject,
      participants: [from],
      snippet: thread.data.snippet ?? "",
      lastMessageAt: new Date(Number(latest.internalDate ?? Date.now())).toISOString(),
      state: "inbox",
      priority: { score: 0.6, level: "P2", reasons: ["Live Gmail thread"] },
      messages: messages.map((message, index) => {
        const headers = message.payload?.headers ?? [];
        const sender = parseFrom(getHeader(headers, "From"));
        const body = extractBody(message.payload) || message.snippet || "";
        return {
          id: message.id ?? `${threadId}-${index}`,
          sender,
          body,
          timestamp: new Date(Number(message.internalDate ?? Date.now())).toISOString(),
          labelIds: message.labelIds ?? []
        };
      })
    }
  };
}

export async function createDraftForClient(payload: ComposePayload) {
  const connection = await getConnectedGmailClient();

  if (!connection) {
    return {
      source: "mock" as const,
      item: createMailDraft(payload)
    };
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });
  const raw = buildMime(payload);

  try {
    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          threadId: payload.threadId,
          raw
        }
      }
    });

    return {
      source: "gmail" as const,
      item: {
        id: draft.data.id,
        threadId: payload.threadId,
        to: payload.to,
        cc: payload.cc ?? [],
        bcc: payload.bcc ?? [],
        subject: payload.subject,
        body: payload.body,
        status: "drafted"
      }
    };
  } catch (error) {
    if (!isInsufficientScopeError(error)) throw error;
    return {
      source: "mock" as const,
      item: createMailDraft(payload)
    };
  }
}

export async function sendDraftForClient(draftId: string) {
  const connection = await getConnectedGmailClient();

  if (!connection) {
    const sent = sendMailDraft(draftId);
    if (!sent) return null;
    return {
      source: "mock" as const,
      item: sent
    };
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });
  try {
    const sent = await gmail.users.drafts.send({ userId: "me", requestBody: { id: draftId } });
    return {
      source: "gmail" as const,
      item: {
        id: sent.data.id,
        threadId: sent.data.threadId,
        status: "sent"
      }
    };
  } catch (error) {
    if (!isInsufficientScopeError(error)) throw error;
    const sent = sendMailDraft(draftId);
    if (!sent) return null;
    return {
      source: "mock" as const,
      item: sent
    };
  }
}

export async function sendMessageForClient(payload: ComposePayload) {
  const connection = await getConnectedGmailClient();

  if (!connection) {
    return {
      source: "mock" as const,
      item: sendMailMessage(payload)
    };
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });
  const raw = buildMime(payload);
  try {
    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        threadId: payload.threadId,
        raw
      }
    });

    return {
      source: "gmail" as const,
      item: {
        id: sent.data.id,
        threadId: sent.data.threadId
      }
    };
  } catch (error) {
    if (!isInsufficientScopeError(error)) throw error;
    return {
      source: "mock" as const,
      item: sendMailMessage(payload)
    };
  }
}

export async function applyThreadActionForClient(threadId: string, action: string) {
  const connection = await getConnectedGmailClient();

  if (!connection) {
    const updated = applyThreadAction(threadId, action);
    if (!updated) return null;
    return {
      source: "mock" as const,
      item: updated
    };
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });

  let addLabelIds: string[] = [];
  let removeLabelIds: string[] = [];

  if (action === "archive") removeLabelIds = ["INBOX"];
  if (action === "unarchive") addLabelIds = ["INBOX"];
  if (action === "mark_read") removeLabelIds = ["UNREAD"];
  if (action === "mark_unread") addLabelIds = ["UNREAD"];
  if (action === "snooze") addLabelIds = ["SNOOZED"];
  if (action === "unsnooze") removeLabelIds = ["SNOOZED"];
  if (action === "trash") addLabelIds = ["TRASH"];

  try {
    const updated = await gmail.users.threads.modify({
      userId: "me",
      id: threadId,
      requestBody: {
        addLabelIds,
        removeLabelIds
      }
    });

    return {
      source: "gmail" as const,
      item: {
        id: updated.data.id,
        labels: updated.data.historyId,
        action
      }
    };
  } catch (error) {
    if (!isInsufficientScopeError(error)) throw error;
    const updated = applyThreadAction(threadId, action);
    if (!updated) return null;
    return {
      source: "mock" as const,
      item: updated
    };
  }
}
