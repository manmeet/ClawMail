import { google } from "googleapis";
import { getConnectedGmailClient } from "./gmail-auth.js";

function scoreSubject(subject: string) {
  const lowered = subject.toLowerCase();
  if (lowered.includes("urgent") || lowered.includes("deadline") || lowered.includes("invoice") || lowered.includes("legal")) {
    return { score: 0.9, level: "P1" as const, reasons: ["Urgency/legal/finance keywords"] };
  }
  if (lowered.includes("meeting") || lowered.includes("review") || lowered.includes("follow")) {
    return { score: 0.72, level: "P2" as const, reasons: ["Follow-up workload"] };
  }
  return { score: 0.55, level: "P3" as const, reasons: ["General inbox item"] };
}

function getHeaderValue(headers: Array<{ name?: string | null; value?: string | null }> | undefined, name: string) {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

function extractBody(payload: {
  body?: { data?: string | null };
  parts?: Array<{ mimeType?: string | null; body?: { data?: string | null } }>;
} | null | undefined) {
  const direct = payload?.body?.data;
  if (direct) return decodeBase64Url(direct);

  const plain = payload?.parts?.find((part) => part.mimeType === "text/plain")?.body?.data;
  if (plain) return decodeBase64Url(plain);

  const html = payload?.parts?.find((part) => part.mimeType === "text/html")?.body?.data;
  if (html) return decodeBase64Url(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return "";
}

export async function syncGmailInbox(maxResults: number) {
  const connection = await getConnectedGmailClient();
  if (!connection) {
    throw new Error("Gmail account is not connected");
  }

  const gmail = google.gmail({ version: "v1", auth: connection.client });
  const list = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: Math.max(1, Math.min(maxResults, 50))
  });

  const messages = list.data.messages ?? [];
  const detailed = await Promise.all(
    messages.map(async (message) => {
      const full = await gmail.users.messages.get({
        userId: "me",
        id: message.id ?? "",
        format: "full"
      });

      const headers = full.data.payload?.headers ?? [];
      const subject = getHeaderValue(headers, "Subject") || "(No subject)";
      const from = getHeaderValue(headers, "From") || "Unknown sender";
      const dateHeader = getHeaderValue(headers, "Date");
      const parsedDate = dateHeader ? new Date(dateHeader) : null;
      const timestamp = !parsedDate || Number.isNaN(parsedDate.getTime())
        ? new Date(Number(full.data.internalDate ?? Date.now())).toISOString()
        : parsedDate.toISOString();

      return {
        id: `gm_${full.data.id}`,
        subject,
        from,
        snippet: full.data.snippet ?? "",
        timestamp,
        body: extractBody(full.data.payload),
        state: "inbox" as const,
        priority: scoreSubject(subject)
      };
    })
  );

  return {
    connectedEmail: connection.connectedEmail,
    threads: detailed
  };
}
