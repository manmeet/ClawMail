"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyMailThreadAction,
  chatWithAgent,
  createMailDraft,
  getConnectors,
  getMailThread,
  getServerVersion,
  listMailThreads,
  sendMail,
  sendMailDraft,
  startGoogleAuth,
  syncGmail
} from "../lib/api";
import type { MailComposePayload, MailFolder, MailThread, MailThreadDetail } from "../lib/types";

const folders: Array<{ id: MailFolder; label: string; shortcut: string }> = [
  { id: "inbox", label: "Inbox", shortcut: "g i" },
  { id: "important", label: "Important", shortcut: "g p" },
  { id: "snoozed", label: "Snoozed", shortcut: "h" },
  { id: "sent", label: "Sent", shortcut: "g s" },
  { id: "drafts", label: "Drafts", shortcut: "g d" },
  { id: "trash", label: "Trash", shortcut: "#" }
];

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function formatBuildStamp(iso: string | null | undefined) {
  if (!iso) return "unknown";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function splitQuotedBody(raw: string) {
  const body = raw ?? "";
  const markerMatch =
    /\n(?:On .+wrote:|From:\s|Sent:\s|To:\s|Subject:\s|Content-Type:\s|Content-Transfer-Encoding:\s|---+\s*Original Message\s*---+|--[a-z0-9_-]{12,})/i.exec(
      body
    );
  const quoteBlockMatch = /\n>/.exec(body);
  const markerIndex = markerMatch?.index ?? -1;
  const quoteIndex = quoteBlockMatch?.index ?? -1;

  const splitIndex =
    markerIndex >= 0 && quoteIndex >= 0 ? Math.min(markerIndex, quoteIndex) : markerIndex >= 0 ? markerIndex : quoteIndex;

  if (splitIndex < 0) {
    return { main: body.trim(), quoted: "" };
  }

  return {
    main: body.slice(0, splitIndex).trim(),
    quoted: body.slice(splitIndex).trim()
  };
}

function buildMessagePreview(raw: string, maxLen = 190) {
  const compact = raw.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen).trimEnd()}...`;
}

function buildReplyDefaults(thread: MailThreadDetail, mailboxAccount: string | null, replyAll = false) {
  const sender = thread.messages?.[0]?.sender ?? thread.participants?.[0] ?? "";
  const participantEmails = thread.participants.map((item) => item.trim()).filter((item) => item.includes("@"));
  const uniqueEmails = Array.from(new Set(participantEmails));
  const accountLower = (mailboxAccount ?? "").toLowerCase();
  const filteredAll = uniqueEmails.filter((email) => email.toLowerCase() !== accountLower);
  const to = replyAll ? (filteredAll.length > 0 ? filteredAll : sender ? [sender] : []) : sender ? [sender] : [];
  const subject = thread.subject.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject}`;
  return { to, subject };
}

type AgentPaneMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: string;
  threadAttached?: boolean;
  threadAttachReason?: string;
  draftId?: string;
};

type ThreadDraftCacheEntry = {
  draftId: string | null;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
};

type ThreadDetailCacheEntry = {
  timestamp: number;
  payload: MailThreadDetail;
};

const THREAD_DETAIL_CACHE_TTL_MS = 60_000;

function nextMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSessionToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function buildAgentSessionKey(threadId: string | undefined, mailboxAccount: string | undefined) {
  const accountKey = normalizeSessionToken(mailboxAccount ?? "default");
  if (!threadId) return `clawmail:${accountKey}:inbox`;
  return `clawmail:${accountKey}:thread:${threadId}`;
}

function buildInitialSessionMessages(threadId?: string): AgentPaneMessage[] {
  const now = new Date().toISOString();
  if (!threadId) {
    return [
      {
        id: nextMessageId(),
        role: "system",
        text: "Inbox session active. Open a thread to start a dedicated thread session.",
        createdAt: now,
        threadAttached: false,
        threadAttachReason: "No open thread selected."
      }
    ];
  }

  return [
    {
      id: nextMessageId(),
      role: "system",
      text: "New thread session active. Past chats from other threads are not included here.",
      createdAt: now,
      threadAttached: false,
      threadAttachReason: "Thread context auto-attaches for thread-related requests."
    }
  ];
}

function isDraftIntentMessage(value: string) {
  const text = value.toLowerCase();
  return (
    /\bdraft\b/.test(text) ||
    /\bcompose\b/.test(text) ||
    /\bwrite\b.*\b(reply|response|email)\b/.test(text) ||
    /\bhelp me\b.*\b(reply|respond)\b/.test(text) ||
    /\brespond\b/.test(text)
  );
}

function isDraftRefinementMessage(value: string) {
  const text = value.toLowerCase().trim();
  return (
    /\bmake it\b/.test(text) ||
    /\bshorter\b/.test(text) ||
    /\blonger\b/.test(text) ||
    /\brewrite\b/.test(text) ||
    /\brefine\b/.test(text) ||
    /\bpolish\b/.test(text) ||
    /\bmore\b/.test(text) ||
    /\bless\b/.test(text) ||
    /\bchange the tone\b/.test(text)
  );
}

function extractDraftBodyFromAssistant(raw: string) {
  const cleaned = raw
    .replace(/```[a-z]*\n?/gi, "")
    .replace(/```/g, "")
    .replace(/\r/g, "")
    .trim();

  const lines = cleaned.split("\n").map((line) => line.trimEnd());
  const filtered = lines.filter((line) => {
    const compact = line.trim().toLowerCase();
    const normalized = compact.replace(/^[>*\-\s_`#]+/, "").replace(/[*_`]+/g, "");
    if (!compact) return true;
    if (/^(subject|to|cc|bcc)\s*:/i.test(normalized)) return false;
    if (/^(sure|absolutely|certainly|here(?:'|’)s|below is|draft reply|draft email|response draft)/i.test(normalized)) return false;
    if (/^(let me know|if you want|if you'd like|i can also)/i.test(normalized)) return false;
    return true;
  });

  return filtered.join("\n").trim();
}

export function InboxShell() {
  const clientVersion = process.env.NEXT_PUBLIC_CLIENT_VERSION ?? "web-dev";
  const clientBuiltAt = process.env.NEXT_PUBLIC_CLIENT_BUILT_AT ?? "";
  const [folder, setFolder] = useState<MailFolder>("important");
  const [query, setQuery] = useState("");
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [openedThreadId, setOpenedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<MailThreadDetail | null>(null);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({});
  const [expandedQuotedBodies, setExpandedQuotedBodies] = useState<Record<string, boolean>>({});

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [composePayload, setComposePayload] = useState<MailComposePayload>({
    to: [],
    cc: [],
    bcc: [],
    subject: "",
    body: ""
  });

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailAccount, setGmailAccount] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<string>("srv-...");
  const [serverStartedAt, setServerStartedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isTabletAgentOpen, setIsTabletAgentOpen] = useState(false);
  const [agentInput, setAgentInput] = useState("");
  const [isAgentWorking, setIsAgentWorking] = useState(false);
  const [agentSessionMessages, setAgentSessionMessages] = useState<Record<string, AgentPaneMessage[]>>({});
  const [threadDraftCache, setThreadDraftCache] = useState<Record<string, ThreadDraftCacheEntry>>({});
  const [threadDetailCache, setThreadDetailCache] = useState<Record<string, ThreadDetailCacheEntry>>({});

  const searchRef = useRef<HTMLInputElement | null>(null);
  const replyRef = useRef<HTMLTextAreaElement | null>(null);
  const commandRef = useRef<HTMLInputElement | null>(null);
  const agentRef = useRef<HTMLTextAreaElement | null>(null);
  const agentFeedRef = useRef<HTMLDivElement | null>(null);
  const threadConversationRef = useRef<HTMLDivElement | null>(null);
  const openThreadReqRef = useRef(0);

  const selectedThread = useMemo(() => threads[selectedIndex] ?? null, [threads, selectedIndex]);
  const replyComposerReady = !openedThreadId || Boolean(threadDetail);

  const refreshThreads = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const result = await listMailThreads(folder, query);
      setThreads(result.items);
      setSelectedIndex(0);
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Failed to load threads");
    } finally {
      setIsLoadingList(false);
    }
  }, [folder, query]);

  const refreshConnector = useCallback(async () => {
    try {
      const connectors = await getConnectors();
      const gmail = connectors.items.find((item) => item.id === "gmail");
      setGmailConnected(Boolean(gmail?.connected));
      setGmailAccount(gmail?.account ?? null);
    } catch {
      setGmailConnected(false);
      setGmailAccount(null);
    }
  }, []);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    void refreshConnector();
  }, [refreshConnector]);

  useEffect(() => {
    let cancelled = false;
    const loadVersion = async () => {
      try {
        const result = await getServerVersion();
        if (!cancelled) {
          setServerVersion(result.serverVersion);
          setServerStartedAt(result.startedAt);
        }
      } catch {
        if (!cancelled) {
          setServerVersion("srv-offline");
          setServerStartedAt(null);
        }
      }
    };
    void loadVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCommandOpen) return;
    const timer = window.setTimeout(() => commandRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [isCommandOpen]);

  const scrollThreadToBottom = useCallback(() => {
    const container = threadConversationRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  const getCachedThreadDetail = useCallback(
    (threadId: string) => {
      const entry = threadDetailCache[threadId];
      if (!entry) return null;
      if (Date.now() - entry.timestamp > THREAD_DETAIL_CACHE_TTL_MS) return null;
      return entry.payload;
    },
    [threadDetailCache]
  );

  const hydrateThreadView = useCallback(
    (item: MailThreadDetail, options?: { threadId?: string; openComposer?: boolean; replyAll?: boolean }) => {
      const threadId = options?.threadId ?? item.id;
      setThreadDetail(item);
      setThreads((prev) => prev.map((thread) => (thread.id === threadId ? { ...thread, unread: false } : thread)));
      const messages = item.messages ?? [];
      const unreadMessageIds = messages
        .filter((message) => (message.labelIds ?? []).includes("UNREAD"))
        .map((message) => message.id);
      const latestMessageId = messages[messages.length - 1]?.id;
      setExpandedMessages(() => {
        if (unreadMessageIds.length > 0) {
          return Object.fromEntries(unreadMessageIds.map((messageId) => [messageId, true]));
        }
        return latestMessageId ? { [latestMessageId]: true } : {};
      });
      setExpandedQuotedBodies({});

      const replyDefaults = buildReplyDefaults(item, gmailAccount, Boolean(options?.replyAll));
      const cachedDraft = threadDraftCache[threadId];
      setComposePayload({
        threadId: item.id,
        to: cachedDraft?.to ?? replyDefaults.to,
        cc: cachedDraft?.cc ?? [],
        bcc: cachedDraft?.bcc ?? [],
        subject: cachedDraft?.subject ?? replyDefaults.subject,
        body: cachedDraft?.body ?? ""
      });
      setComposeOpen(Boolean(options?.openComposer || cachedDraft));
      setComposeDraftId(cachedDraft?.draftId ?? null);
      window.setTimeout(scrollThreadToBottom, 20);
    },
    [gmailAccount, scrollThreadToBottom, threadDraftCache]
  );

  const prefetchThreadDetail = useCallback(
    async (threadId: string) => {
      if (getCachedThreadDetail(threadId)) return;
      try {
        const result = await getMailThread(threadId);
        setThreadDetailCache((prev) => ({
          ...prev,
          [threadId]: {
            timestamp: Date.now(),
            payload: result.item
          }
        }));
      } catch {
        // Ignore prefetch errors to keep navigation fluid.
      }
    },
    [getCachedThreadDetail]
  );

  const prefetchAdjacentThreadDetails = useCallback(
    (threadId: string) => {
      const index = threads.findIndex((thread) => thread.id === threadId);
      if (index < 0) return;
      const adjacentIds = [threads[index - 1]?.id, threads[index + 1]?.id].filter((id): id is string => Boolean(id));
      adjacentIds.forEach((id) => {
        void prefetchThreadDetail(id);
      });
    },
    [prefetchThreadDetail, threads]
  );

  const openThread = useCallback(async (threadId: string, options?: { openComposer?: boolean; replyAll?: boolean }) => {
    const reqId = ++openThreadReqRef.current;
    setOpenedThreadId(threadId);
    setThreadError(null);
    setStatus(null);
    const cached = getCachedThreadDetail(threadId);
    const hasFreshCache = Boolean(cached);

    if (cached) {
      hydrateThreadView(cached, { ...options, threadId });
      setIsLoadingThread(false);
      prefetchAdjacentThreadDetails(threadId);
    } else {
      setIsLoadingThread(true);
    }

    try {
      const result = await getMailThread(threadId);
      if (reqId !== openThreadReqRef.current) return;
      setThreadDetailCache((prev) => ({
        ...prev,
        [threadId]: {
          timestamp: Date.now(),
          payload: result.item
        }
      }));
      hydrateThreadView(result.item, { ...options, threadId });
      void applyMailThreadAction(threadId, "mark_read").catch(() => {});
      prefetchAdjacentThreadDetails(threadId);
    } catch (error) {
      if (reqId !== openThreadReqRef.current) return;
      setThreadError(error instanceof Error ? error.message : "Failed to load thread");
    } finally {
      if (reqId === openThreadReqRef.current && !hasFreshCache) {
        setIsLoadingThread(false);
      }
    }
  }, [getCachedThreadDetail, hydrateThreadView, prefetchAdjacentThreadDetails]);

  const openNewCompose = useCallback(() => {
    setOpenedThreadId(null);
    setThreadDetail(null);
    setComposeDraftId(null);
    setStatus(null);
    setComposePayload({
      to: [],
      cc: [],
      bcc: [],
      subject: "",
      body: ""
    });
    setComposeOpen(true);
  }, []);

  const parseEmails = (raw: string) =>
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const closeOpenedThread = useCallback(() => {
    setOpenedThreadId(null);
    setThreadDetail(null);
    setExpandedMessages({});
    setExpandedQuotedBodies({});
    setComposeOpen(false);
    setStatus(null);
    setComposePayload({ to: [], cc: [], bcc: [], subject: "", body: "" });
    setComposeDraftId(null);
  }, []);

  const openReplyComposer = useCallback(
    (replyAll = false) => {
      if (!openedThreadId) return;
      if (!threadDetail) {
        setStatus(null);
        setComposeOpen(true);
        setComposePayload((prev) => ({ ...prev, threadId: openedThreadId }));
        void openThread(openedThreadId, { openComposer: true, replyAll });
        return;
      }
      const replyDefaults = buildReplyDefaults(threadDetail, gmailAccount, replyAll);

      setStatus(null);
      setComposePayload((prev) => ({
        ...prev,
        threadId: openedThreadId,
        to: replyDefaults.to,
        subject: prev.subject || replyDefaults.subject
      }));
      setComposeOpen(true);
      setTimeout(() => replyRef.current?.focus(), 30);
    },
    [gmailAccount, openThread, openedThreadId, threadDetail]
  );

  const executeThreadAction = useCallback(
    async (action: "archive" | "mark_read" | "mark_unread" | "snooze" | "trash") => {
      const id = openedThreadId ?? selectedThread?.id;
      if (!id) return;
      const currentIndex = threads.findIndex((thread) => thread.id === id);
      const previousThreads = threads;
      const previousThreadDetail = threadDetail;
      const previousCacheEntry = threadDetailCache[id];
      setIsWorking(true);
      setStatus(null);

      if (action === "mark_read" || action === "mark_unread") {
        const unread = action === "mark_unread";
        setThreads((prev) => prev.map((thread) => (thread.id === id ? { ...thread, unread } : thread)));
        setThreadDetail((prev) => {
          if (!prev || prev.id !== id) return prev;
          return {
            ...prev,
            unread,
            messages: prev.messages.map((message) => {
              const labels = new Set(message.labelIds ?? []);
              if (unread) {
                labels.add("UNREAD");
              } else {
                labels.delete("UNREAD");
              }
              return { ...message, labelIds: Array.from(labels) };
            })
          };
        });
      }

      if (action === "archive" || action === "trash" || action === "snooze") {
        setThreads((prev) => {
          const nextThreads = prev.filter((thread) => thread.id !== id);
          const nextIndex = Math.min(Math.max(currentIndex, 0), Math.max(nextThreads.length - 1, 0));
          setSelectedIndex(nextIndex);
          return nextThreads;
        });
        setThreadDetail((prev) => {
          if (!prev || prev.id !== id) return prev;
          return { ...prev, state: action };
        });
      }

      setThreadDetailCache((prev) => {
        const cached = prev[id];
        if (!cached) return prev;
        let nextPayload = cached.payload;
        if (action === "mark_read" || action === "mark_unread") {
          const unread = action === "mark_unread";
          nextPayload = {
            ...cached.payload,
            unread,
            messages: cached.payload.messages.map((message) => {
              const labels = new Set(message.labelIds ?? []);
              if (unread) {
                labels.add("UNREAD");
              } else {
                labels.delete("UNREAD");
              }
              return { ...message, labelIds: Array.from(labels) };
            })
          };
        }
        if (action === "archive" || action === "trash" || action === "snooze") {
          nextPayload = { ...nextPayload, state: action };
        }
        return {
          ...prev,
          [id]: {
            timestamp: Date.now(),
            payload: nextPayload
          }
        };
      });

      try {
        await applyMailThreadAction(id, action);
        setStatus(`Applied: ${action}`);
        if (action === "archive" || action === "trash" || action === "snooze") {
          closeOpenedThread();
          return;
        }
        if (action === "mark_read" || action === "mark_unread") {
          return;
        }
        await refreshThreads();
      } catch (error) {
        setThreads(previousThreads);
        setThreadDetail(previousThreadDetail);
        setThreadDetailCache((prev) => {
          if (!previousCacheEntry) {
            const next = { ...prev };
            delete next[id];
            return next;
          }
          return {
            ...prev,
            [id]: previousCacheEntry
          };
        });
        setStatus(error instanceof Error ? error.message : "Action failed");
      } finally {
        setIsWorking(false);
      }
    },
    [closeOpenedThread, openedThreadId, refreshThreads, selectedThread?.id, threadDetail, threadDetailCache, threads]
  );

  const saveDraft = useCallback(async () => {
    if (composePayload.to.length === 0) {
      setStatus("Add at least one recipient");
      return;
    }
    setIsWorking(true);
    setStatus("Saving draft...");
    try {
      const draft = await createMailDraft(composePayload);
      setComposeDraftId(draft.item.id ?? null);
      if (composePayload.threadId) {
        setThreadDraftCache((prev) => ({
          ...prev,
          [composePayload.threadId as string]: {
            draftId: draft.item.id ?? null,
            to: composePayload.to,
            cc: composePayload.cc ?? [],
            bcc: composePayload.bcc ?? [],
            subject: composePayload.subject,
            body: composePayload.body
          }
        }));
      }
      setStatus("Draft saved");
      await refreshThreads();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Draft failed");
    } finally {
      setIsWorking(false);
    }
  }, [composePayload, refreshThreads]);

  const sendCompose = useCallback(async () => {
    if (composePayload.to.length === 0) {
      setStatus("Add at least one recipient");
      return;
    }
    setIsWorking(true);
    try {
      const messageBody = composePayload.body;
      const threadId = composePayload.threadId ?? openedThreadId ?? undefined;
      const sentAt = new Date().toISOString();
      if (composeDraftId) {
        await sendMailDraft(composeDraftId);
      } else {
        await sendMail(composePayload);
      }
      setStatus("Message sent");

      const isReplyInOpenThread = Boolean(openedThreadId && threadId && openedThreadId === threadId);
      if (isReplyInOpenThread && threadId) {
        const localMessageId = `local-sent-${Date.now()}`;
        setThreadDraftCache((prev) => {
          const next = { ...prev };
          delete next[threadId];
          return next;
        });
        setThreadDetail((prev) => {
          if (!prev || prev.id !== threadId) return prev;
          return {
            ...prev,
            snippet: messageBody.slice(0, 180),
            lastMessageAt: sentAt,
            messages: [
              ...prev.messages,
              {
                id: localMessageId,
                sender: gmailAccount ?? "you",
                body: messageBody,
                timestamp: sentAt
              }
            ]
          };
        });
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  snippet: messageBody.slice(0, 180),
                  lastMessageAt: sentAt,
                  unread: false
                }
              : thread
          )
        );
        setComposeOpen(false);
        setComposeDraftId(null);
        setComposePayload((prev) => ({ ...prev, body: "" }));
        setExpandedMessages({ [localMessageId]: true });
        setExpandedQuotedBodies({});
        void refreshThreads();
        window.setTimeout(scrollThreadToBottom, 20);
      } else {
        closeOpenedThread();
        await refreshThreads();
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Send failed");
    } finally {
      setIsWorking(false);
    }
  }, [closeOpenedThread, composeDraftId, composePayload, gmailAccount, openedThreadId, refreshThreads, scrollThreadToBottom]);

  const syncInbox = useCallback(async () => {
    setIsWorking(true);
    try {
      if (!gmailConnected) {
        const { authUrl } = await startGoogleAuth();
        window.open(authUrl, "_blank", "noopener,noreferrer");
        setStatus("Reconnect started. Complete OAuth, then press Sync again.");
        return;
      }

      const result = await syncGmail(50);
      setStatus(`Synced ${result.importedThreads} threads`);
      await refreshThreads();
      await refreshConnector();
    } catch (error) {
      try {
        const { authUrl } = await startGoogleAuth();
        window.open(authUrl, "_blank", "noopener,noreferrer");
        setStatus("Sync failed; started Gmail re-auth. Complete OAuth and retry Sync.");
      } catch {
        setStatus(error instanceof Error ? error.message : "Sync failed");
      }
    } finally {
      setIsWorking(false);
    }
  }, [gmailConnected, refreshConnector, refreshThreads]);

  const activeMailboxAccount = useMemo(() => gmailAccount ?? undefined, [gmailAccount]);
  const activeChatThreadId = openedThreadId ?? undefined;
  const activeAgentSessionKey = useMemo(
    () => buildAgentSessionKey(activeChatThreadId, activeMailboxAccount),
    [activeChatThreadId, activeMailboxAccount]
  );
  const agentMessages = useMemo(
    () => agentSessionMessages[activeAgentSessionKey] ?? [],
    [activeAgentSessionKey, agentSessionMessages]
  );

  useEffect(() => {
    setAgentSessionMessages((prev) => {
      if (prev[activeAgentSessionKey]) return prev;
      return {
        ...prev,
        [activeAgentSessionKey]: buildInitialSessionMessages(activeChatThreadId)
      };
    });
  }, [activeAgentSessionKey, activeChatThreadId]);

  useEffect(() => {
    const feed = agentFeedRef.current;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }, [agentMessages, isAgentWorking]);

  const appendToActiveSession = useCallback(
    (message: AgentPaneMessage) => {
      setAgentSessionMessages((prev) => {
        const current = prev[activeAgentSessionKey] ?? buildInitialSessionMessages(activeChatThreadId);
        return {
          ...prev,
          [activeAgentSessionKey]: [...current, message]
        };
      });
    },
    [activeAgentSessionKey, activeChatThreadId]
  );

  const saveAgentDraftToMainPane = useCallback(
    async (draftBody: string) => {
      if (!openedThreadId || !threadDetail) return;
      const draftOnlyBody = extractDraftBodyFromAssistant(draftBody);
      if (!draftOnlyBody) {
        setStatus("Agent returned empty draft body");
        return;
      }

      const to = composePayload.to.length > 0 ? composePayload.to : threadDetail.participants.slice(0, 1);
      const subject =
        composePayload.subject ||
        (threadDetail.subject.toLowerCase().startsWith("re:") ? threadDetail.subject : `Re: ${threadDetail.subject}`);

      if (to.length === 0) {
        setStatus("Could not infer recipient for draft");
        return;
      }

      try {
        const created = await createMailDraft({
          threadId: openedThreadId,
          to,
          cc: composePayload.cc ?? [],
          bcc: composePayload.bcc ?? [],
          subject,
          body: draftOnlyBody
        });

        setComposeDraftId(created.item.id ?? null);
        setComposeOpen(true);
        setComposePayload((prev) => ({
          ...prev,
          threadId: openedThreadId,
          to,
          subject,
          body: draftOnlyBody
        }));
        setThreadDraftCache((prev) => ({
          ...prev,
          [openedThreadId]: {
            draftId: created.item.id ?? null,
            to,
            cc: composePayload.cc ?? [],
            bcc: composePayload.bcc ?? [],
            subject,
            body: draftOnlyBody
          }
        }));
        setStatus("Draft inserted in main reply pane. Review and press Send.");
        appendToActiveSession({
          id: nextMessageId(),
          role: "system",
          text: `Draft inserted for this thread (id: ${created.item.id ?? "local"}).`,
          createdAt: new Date().toISOString(),
          draftId: created.item.id ?? undefined
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to save draft";
        setStatus(message);
        appendToActiveSession({
          id: nextMessageId(),
          role: "system",
          text: `Draft save failed: ${message}`,
          createdAt: new Date().toISOString()
        });
      }
    },
    [appendToActiveSession, composePayload.bcc, composePayload.cc, composePayload.subject, composePayload.to, openedThreadId, threadDetail]
  );

  const runAgentChatTurn = useCallback(
    async (message: string, options?: { forceThreadAccess?: boolean; autoInsertDraft?: boolean }) => {
      const trimmed = message.trim();
      if (!trimmed) return null;

      const threadId = activeChatThreadId;
      const createdAt = new Date().toISOString();
      const allowThreadAccess = Boolean(options?.forceThreadAccess === true || threadId);

      appendToActiveSession({
        id: nextMessageId(),
        role: "user",
        text: trimmed,
        createdAt
      });

      setAgentInput("");
      setIsAgentWorking(true);

      try {
        const result = await chatWithAgent({
          message: trimmed,
          threadId,
          mailboxAccount: activeMailboxAccount,
          allowThreadAccess,
          autoThreadDetect: true
        });

        appendToActiveSession({
          id: nextMessageId(),
          role: "assistant",
          text: result.assistantMessage,
          createdAt: new Date().toISOString(),
          threadAttached: result.threadAttached,
          threadAttachReason: result.threadAttachReason
        });

        if (options?.autoInsertDraft && openedThreadId && result.assistantMessage.trim()) {
          await saveAgentDraftToMainPane(result.assistantMessage.trim());
        }

        return result;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : "Agent request failed";
        appendToActiveSession({
          id: nextMessageId(),
          role: "system",
          text: `Agent error: ${messageText}`,
          createdAt: new Date().toISOString(),
          threadAttached: false,
          threadAttachReason: "No thread context attached."
        });
        return null;
      } finally {
        setIsAgentWorking(false);
      }
    },
    [activeChatThreadId, activeMailboxAccount, agentMessages, appendToActiveSession, openedThreadId, saveAgentDraftToMainPane]
  );

  const runAgentFromComposer = useCallback(async () => {
    const prompt = agentInput.trim();
    if (!prompt) return;
    await runAgentChatTurn(prompt, {
      autoInsertDraft: Boolean(openedThreadId && isDraftIntentMessage(prompt))
    });
  }, [agentInput, openedThreadId, runAgentChatTurn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctrlOrMeta = event.metaKey || event.ctrlKey;
      if (ctrlOrMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen(true);
        return;
      }
      if (ctrlOrMeta && event.key.toLowerCase() !== "enter") {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();

        if (isCommandOpen) {
          setIsCommandOpen(false);
          const activeElement = document.activeElement;
          if (activeElement instanceof HTMLElement) activeElement.blur();
          return;
        }

        const active = document.activeElement;
        if (active instanceof HTMLElement && isTypingTarget(active)) {
          active.blur();
          return;
        }

        if (composeOpen) {
          setComposeOpen(false);
          return;
        }

        if (isSidebarOpen) {
          setIsSidebarOpen(false);
          return;
        }

        if (openedThreadId) {
          closeOpenedThread();
          return;
        }
        if (isTabletAgentOpen) {
          setIsTabletAgentOpen(false);
          return;
        }
      }

      if (isTypingTarget(event.target) && !(ctrlOrMeta && event.key.toLowerCase() === "enter")) return;

      if (event.key === "j") {
        event.preventDefault();
        setSelectedIndex((v) => Math.min(v + 1, Math.max(threads.length - 1, 0)));
        return;
      }

      if (event.key === "k") {
        event.preventDefault();
        setSelectedIndex((v) => Math.max(v - 1, 0));
        return;
      }

      if (event.key === "Enter" || event.key.toLowerCase() === "o") {
        event.preventDefault();
        if (selectedThread?.id) void openThread(selectedThread.id);
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        void executeThreadAction("mark_unread");
        return;
      }

      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        closeOpenedThread();
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        openNewCompose();
        return;
      }

      if (event.key.toLowerCase() === "r" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        const replyAll = event.key.toLowerCase() === "a";
        if (!openedThreadId && selectedThread?.id) {
          void openThread(selectedThread.id, { openComposer: true, replyAll });
          return;
        }
        openReplyComposer(replyAll);
        return;
      }

      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        void executeThreadAction("archive");
        return;
      }

      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        void executeThreadAction("snooze");
        return;
      }

      if (event.key.toLowerCase() === "x") {
        event.preventDefault();
        void executeThreadAction("mark_read");
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (ctrlOrMeta && event.key.toLowerCase() === "enter") {
        event.preventDefault();
        if (composeOpen) {
          void sendCompose();
          return;
        }
        if (document.activeElement === agentRef.current) {
          void runAgentFromComposer();
        }
      }

    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    closeOpenedThread,
    composeOpen,
    isCommandOpen,
    isTabletAgentOpen,
    executeThreadAction,
    isSidebarOpen,
    openNewCompose,
    openReplyComposer,
    openThread,
    openedThreadId,
    runAgentFromComposer,
    selectedThread?.id,
    sendCompose,
    threads.length
  ]);

  return (
    <main className="mailApp">
      <header className="mailTopBar">
        <div className="topTabs">
          <span className="topTab active" title={gmailAccount ?? "No connected mailbox"}>
            {gmailAccount ?? "No connected mailbox"}
          </span>
        </div>
        <div className="topControls">
          <span className="versionBadge" title={clientBuiltAt ? `Client built ${clientBuiltAt}` : "Client build version"}>
            Client {clientVersion} · {formatBuildStamp(clientBuiltAt)}
          </span>
          <span className="versionBadge" title={serverStartedAt ? `Server restarted ${serverStartedAt}` : "Server runtime version"}>
            Server {serverVersion} · {formatBuildStamp(serverStartedAt)}
          </span>
          <button className="chromeButton syncButton" onClick={() => void syncInbox()} disabled={isWorking}>
            <span className="syncOrb" />
            Sync
          </button>
          <button className="chromeButton tabletOnly" onClick={() => setIsTabletAgentOpen((v) => !v)}>
            Claw Agent
          </button>
          <span className="statusDot">{gmailConnected ? `Connected: ${gmailAccount ?? "gmail"}` : "Gmail not connected"}</span>
        </div>
      </header>

      <aside className="rail">
        <button className="railBrand" aria-label="assistant">
          <svg className="clawGlyph" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path d="M6 20L14 6L22 20" stroke="currentColor" strokeWidth="1.6" />
            <path d="M9.5 16.8H18.5" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="14" cy="21.2" r="1.6" fill="currentColor" />
          </svg>
        </button>
        <button className="railMain" onClick={() => setIsSidebarOpen((v) => !v)} aria-label="folders">
          ☰
        </button>
        <button className="railMain" onClick={() => openNewCompose()} aria-label="compose">
          ✎
        </button>
      </aside>

      {isSidebarOpen ? <button className="scrim" onClick={() => setIsSidebarOpen(false)} aria-label="close sidebar" /> : null}
      {isCommandOpen ? <button className="commandPaletteScrim" onClick={() => setIsCommandOpen(false)} aria-label="close command palette" /> : null}

      {isCommandOpen ? (
        <section className="commandPalette" aria-label="command palette">
          <input ref={commandRef} placeholder="Type a command..." />
          <div className="commandList">
            <button
              onClick={() => {
                setIsCommandOpen(false);
                setOpenedThreadId(null);
                setComposeOpen(false);
              }}
            >
              Go to Inbox
            </button>
            <button
              onClick={() => {
                setIsCommandOpen(false);
                openNewCompose();
              }}
            >
              Compose new message
            </button>
            <button
              onClick={() => {
                setIsCommandOpen(false);
                setIsSidebarOpen(true);
              }}
            >
              Open inbox drawer
            </button>
            <button
              onClick={() => {
                setIsCommandOpen(false);
                agentRef.current?.focus();
              }}
            >
              Focus EA agent
            </button>
          </div>
          <p className="subtle">Esc closes this pane</p>
        </section>
      ) : null}

      <aside className={isSidebarOpen ? "folderDrawer open" : "folderDrawer"}>
        <div className="drawerProfile">
          <strong>{gmailAccount ?? "Executive Inbox"}</strong>
        </div>
        <nav>
          {folders.map((item) => (
            <button
              key={item.id}
              className={folder === item.id ? "folderBtn active" : "folderBtn"}
              onClick={() => {
                setFolder(item.id);
                closeOpenedThread();
                setIsSidebarOpen(false);
              }}
            >
              <span>{item.label}</span>
              <small>{item.shortcut}</small>
            </button>
          ))}
        </nav>
      </aside>

      <section className="centerPane">
        {!openedThreadId ? (
          <>
            <div className="centerHeader">
              <div>
                <h1>{folder === "important" ? "Important" : folder[0].toUpperCase() + folder.slice(1)}</h1>
                <p>{threads.length} threads</p>
              </div>
              <button className="ghost" onClick={() => setIsSidebarOpen(true)}>
                Inboxes
              </button>
            </div>

            <div className="focusTabs">
              {[
                { id: "inbox", label: "Inbox" },
                { id: "important", label: "Important" },
                { id: "sent", label: "Sent" },
                { id: "drafts", label: "Drafts" },
                { id: "all", label: "Folders" }
              ].map((tab) => (
                <button key={tab.id} onClick={() => setFolder(tab.id as MailFolder)}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="listToolbar">
              <input
                ref={searchRef}
                placeholder="Search mail..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void refreshThreads();
                  }
                }}
              />
              <button onClick={() => void refreshThreads()} disabled={isLoadingList}>
                Refresh
              </button>
              <button onClick={() => openNewCompose()}>Compose (c)</button>
            </div>

            {listError ? <p className="errorLine">{listError}</p> : null}
            {isLoadingList ? <p className="subtle">Loading...</p> : null}

            <ul className="threadList">
              {threads.map((thread, idx) => (
                <li
                  key={thread.id}
                  data-thread-id={thread.id}
                  className={idx === selectedIndex ? "threadRow active" : "threadRow"}
                  style={{ animationDelay: `${Math.min(idx, 14) * 18}ms` }}
                  onClick={() => {
                    setSelectedIndex(idx);
                    void openThread(thread.id);
                  }}
                >
                  <div className="rowSender">
                    <span className={thread.unread ? "dot unread" : "dot"} />
                    <strong>{thread.participants[0] ?? "Unknown"}</strong>
                  </div>
                  <p className="rowSubject">{thread.subject}</p>
                  <p className="rowSnippet">{thread.snippet ?? ""}</p>
                  <span className="rowTime">{relTime(thread.lastMessageAt)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="threadWorkspace">
            <div className="threadHeader">
              <div className="threadHeaderMain">
                <button
                  className="threadBack"
                  onClick={() => {
                    closeOpenedThread();
                  }}
                >
                  Back
                </button>
                <div>
                  <h2>{threadDetail?.subject ?? "Thread"}</h2>
                  <p>{threadDetail?.snippet ?? "Conversation"}</p>
                </div>
              </div>
              <div className="threadActions">
                <button
                  className="threadActionIcon"
                  aria-label="Reply"
                  title="Reply"
                  onClick={() => openReplyComposer(false)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M9 5L4 10L9 15" />
                    <path d="M5 10H12.5C15.3 10 17 11.7 17 14.5V15" />
                  </svg>
                </button>
                <button
                  className="threadActionIcon"
                  aria-label="Reply all"
                  title="Reply all"
                  onClick={() => openReplyComposer(true)}
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M7 6L3 10L7 14" />
                    <path d="M11 6L7 10L11 14" />
                    <path d="M7.5 10H13C15.5 10 17 11.5 17 14V15" />
                  </svg>
                </button>
                <button className="threadActionIcon" aria-label="Archive" title="Archive" onClick={() => void executeThreadAction("archive")}>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="3" y="4" width="14" height="4" rx="1.2" />
                    <path d="M4.5 8V15.5H15.5V8" />
                    <path d="M8 11H12" />
                  </svg>
                </button>
                <button className="threadActionIcon" aria-label="Mark unread" title="Mark unread" onClick={() => void executeThreadAction("mark_unread")}>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="3" y="5" width="14" height="10" rx="1.4" />
                    <path d="M4.5 6.5L10 10.5L15.5 6.5" />
                  </svg>
                </button>
                <button className="threadActionIcon danger" aria-label="Trash" title="Trash" onClick={() => void executeThreadAction("trash")}>
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M6 6.5H14" />
                    <path d="M7 6.5V15.5H13V6.5" />
                    <path d="M8 4.5H12" />
                    <path d="M9 8.5V13.5" />
                    <path d="M11 8.5V13.5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="threadConversation" ref={threadConversationRef}>
              {isLoadingThread ? <p className="subtle">Loading thread...</p> : null}
              {threadError ? <p className="errorLine">{threadError}</p> : null}

              {threadDetail?.messages.map((message) => {
                const isExpanded = Boolean(expandedMessages[message.id]);
                const { main, quoted } = splitQuotedBody(message.body);
                const showQuoted = Boolean(expandedQuotedBodies[message.id]);
                const preview = buildMessagePreview(main || message.body);

                return (
                  <article
                    className={`${message.labelIds?.includes("DRAFT") ? "messageCard draft" : "messageCard"} ${isExpanded ? "expanded" : "collapsed"}`}
                    key={message.id}
                    onClick={() => {
                      if (!isExpanded) {
                        setExpandedMessages({ [message.id]: true });
                        setExpandedQuotedBodies({});
                      }
                    }}
                  >
                    <p className="messageMeta">
                      <strong>{message.sender}</strong>
                      <span>
                        {message.labelIds?.includes("DRAFT") ? <em className="messageBadge">Draft</em> : null}
                        {relTime(message.timestamp)}
                      </span>
                    </p>

                    {isExpanded ? (
                      <>
                        <p className="messageBody">{main || message.body}</p>
                        {quoted ? (
                          showQuoted ? (
                            <div className="messageQuotedWrap">
                              <p className="messageBody messageQuoted">{quoted}</p>
                              <button
                                type="button"
                                className="messageExpandQuoted"
                                aria-label="Hide quoted text"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setExpandedQuotedBodies((prev) => ({ ...prev, [message.id]: false }));
                                }}
                              >
                                ...
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="messageExpandQuoted"
                              aria-label="Show hidden quoted text"
                              title="Show hidden quoted text"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedQuotedBodies((prev) => ({ ...prev, [message.id]: true }));
                              }}
                            >
                              ...
                            </button>
                          )
                        ) : null}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="messageCollapsedPreview"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedMessages({ [message.id]: true });
                          setExpandedQuotedBodies({});
                        }}
                      >
                        {preview || "Open message"}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>

            {composeOpen ? (
              <div className="replyDock open">
                <div className="replyHead">
                  <strong>{replyComposerReady ? `Draft to ${composePayload.to[0] ?? "recipient"}` : "Preparing reply..."}</strong>
                  <span>{replyComposerReady ? "Cmd/Ctrl+Enter to send" : "Loading thread context"}</span>
                </div>
                <div className="replyFields">
                  <input
                    disabled={!replyComposerReady}
                    value={composePayload.to.join(", ")}
                    onChange={(event) =>
                      setComposePayload((prev) => ({
                        ...prev,
                        to: parseEmails(event.target.value)
                      }))
                    }
                    placeholder="To"
                  />
                  <input
                    disabled={!replyComposerReady}
                    value={composePayload.subject}
                    onChange={(event) => setComposePayload((prev) => ({ ...prev, subject: event.target.value }))}
                    placeholder="Subject"
                  />
                  <textarea
                    ref={replyRef}
                    rows={5}
                    disabled={!replyComposerReady}
                    value={composePayload.body}
                    onChange={(event) => setComposePayload((prev) => ({ ...prev, body: event.target.value }))}
                    placeholder={replyComposerReady ? "Write a reply..." : "Loading reply context..."}
                  />
                </div>
                <div className="replyActions">
                  <button onClick={() => void saveDraft()} disabled={isWorking || !replyComposerReady}>
                    Save Draft
                  </button>
                  <button onClick={() => void sendCompose()} disabled={isWorking || !replyComposerReady}>
                    Send
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!openedThreadId && composeOpen ? (
          <div className="replyDock floating open">
            <div className="replyHead">
              <strong>New Message</strong>
              <span>Cmd/Ctrl+Enter to send</span>
            </div>
            <div className="replyFields">
              <input
                value={composePayload.to.join(", ")}
                onChange={(event) =>
                  setComposePayload((prev) => ({
                    ...prev,
                    to: parseEmails(event.target.value)
                  }))
                }
                placeholder="To"
              />
              <input
                value={composePayload.subject}
                onChange={(event) => setComposePayload((prev) => ({ ...prev, subject: event.target.value }))}
                placeholder="Subject"
              />
              <textarea
                ref={replyRef}
                rows={5}
                value={composePayload.body}
                onChange={(event) => setComposePayload((prev) => ({ ...prev, body: event.target.value }))}
                placeholder="Write your message..."
              />
            </div>
            <div className="replyActions">
              <button onClick={() => void saveDraft()} disabled={isWorking}>
                Save Draft
              </button>
              <button onClick={() => void sendCompose()} disabled={isWorking}>
                Send
              </button>
              <button onClick={() => setComposeOpen(false)}>Close</button>
            </div>
          </div>
        ) : null}
      </section>

      {isTabletAgentOpen ? <button className="agentTabletScrim" onClick={() => setIsTabletAgentOpen(false)} aria-label="close agent" /> : null}
      <aside className={isTabletAgentOpen ? "agentPane tabletOpen" : "agentPane"}>
        <div className="agentHead">
          <h3>Claw Agent</h3>
          <span>Thread-aware assistant</span>
        </div>
        <div className="agentFeed" ref={agentFeedRef}>
          {agentMessages.map((item) => (
            <div key={item.id} className={item.role === "assistant" ? "agentMsg ai" : item.role === "user" ? "agentMsg user" : "agentMsg system"}>
              <div className="agentMsgHead">
                <span className="agentRole">{item.role === "assistant" ? "Agent" : item.role === "user" ? "You" : "System"}</span>
                <span className="agentTime">{relTime(item.createdAt)}</span>
              </div>
              <p className="agentText">{item.text}</p>
              {item.role !== "user" ? (
                <div className="agentMeta">
                  <span className={item.threadAttached ? "agentBadge attached" : "agentBadge detached"}>
                    {item.threadAttached ? "Thread attached" : "No thread context"}
                  </span>
                  {item.threadAttachReason ? <span className="agentReason">{item.threadAttachReason}</span> : null}
                </div>
              ) : null}
            </div>
          ))}
          {isAgentWorking ? <div className="agentMsg ai">Working...</div> : null}
        </div>
        <div className="agentComposer">
          <div className="agentSessionLine">
            {activeChatThreadId ? `Thread session: ${activeChatThreadId.slice(-8)}` : "Inbox session"}
            <span>Enter to send, Shift+Enter for newline</span>
          </div>
          <textarea
            ref={agentRef}
            rows={5}
            placeholder="Ask your executive assistant... (Enter to send, Shift+Enter for newline)"
            value={agentInput}
            onChange={(event) => setAgentInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const liveValue = event.currentTarget.value.trim();
                if (!isAgentWorking && liveValue) {
                  void runAgentChatTurn(liveValue, {
                    autoInsertDraft: Boolean(openedThreadId && isDraftIntentMessage(liveValue))
                  });
                }
              }
            }}
          />
        </div>
        <p className="statusLine">{status ?? "Ready"}</p>
      </aside>
    </main>
  );
}
