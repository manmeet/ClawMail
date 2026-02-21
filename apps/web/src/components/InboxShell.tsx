"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyMailThreadAction,
  createMailDraft,
  getConnectors,
  getMailThread,
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

const focusTabs = ["Investors", "FDA", "Signature", "VPM", "PandaDoc", "Calendar", "Other"];

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export function InboxShell() {
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
  const [status, setStatus] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const replyRef = useRef<HTMLTextAreaElement | null>(null);
  const commandRef = useRef<HTMLInputElement | null>(null);
  const agentRef = useRef<HTMLTextAreaElement | null>(null);
  const threadConversationRef = useRef<HTMLDivElement | null>(null);

  const selectedThread = useMemo(() => threads[selectedIndex] ?? null, [threads, selectedIndex]);

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
    if (!isCommandOpen) return;
    const timer = window.setTimeout(() => commandRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [isCommandOpen]);

  const scrollThreadToBottom = useCallback(() => {
    const container = threadConversationRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, []);

  const openThread = useCallback(async (threadId: string, options?: { openComposer?: boolean }) => {
    setOpenedThreadId(threadId);
    setThreadError(null);
    setIsLoadingThread(true);
    try {
      const result = await getMailThread(threadId);
      setThreadDetail(result.item);
      setThreads((prev) => prev.map((thread) => (thread.id === threadId ? { ...thread, unread: false } : thread)));

      const sender = result.item.messages?.[0]?.sender ?? result.item.participants?.[0] ?? "";
      const nextSubject = result.item.subject.toLowerCase().startsWith("re:") ? result.item.subject : `Re: ${result.item.subject}`;
      setComposePayload({
        threadId: result.item.id,
        to: sender ? [sender] : [],
        cc: [],
        bcc: [],
        subject: nextSubject,
        body: ""
      });
      setComposeOpen(Boolean(options?.openComposer));
      setComposeDraftId(null);
      void applyMailThreadAction(threadId, "mark_read").catch(() => {});
      window.setTimeout(scrollThreadToBottom, 20);
    } catch (error) {
      setThreadError(error instanceof Error ? error.message : "Failed to load thread");
    } finally {
      setIsLoadingThread(false);
    }
  }, [scrollThreadToBottom]);

  const openNewCompose = useCallback(() => {
    setOpenedThreadId(null);
    setThreadDetail(null);
    setComposeDraftId(null);
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
    setComposeOpen(false);
    setComposePayload({ to: [], cc: [], bcc: [], subject: "", body: "" });
    setComposeDraftId(null);
  }, []);

  const executeThreadAction = useCallback(
    async (action: "archive" | "mark_read" | "mark_unread" | "snooze" | "trash") => {
      const id = openedThreadId ?? selectedThread?.id;
      if (!id) return;
      setIsWorking(true);
      setStatus(null);
      try {
        await applyMailThreadAction(id, action);
        setStatus(`Applied: ${action}`);
        if (action === "mark_read") {
          setThreads((prev) => prev.map((thread) => (thread.id === id ? { ...thread, unread: false } : thread)));
        }
        if (action === "mark_unread") {
          setThreads((prev) => prev.map((thread) => (thread.id === id ? { ...thread, unread: true } : thread)));
        }
        if (action === "archive" || action === "trash" || action === "snooze") {
          setThreads((prev) => prev.filter((thread) => thread.id !== id));
          setSelectedIndex(0);
        }
        if (action === "archive" || action === "trash" || action === "snooze") {
          closeOpenedThread();
          return;
        }
        await refreshThreads();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Action failed");
      } finally {
        setIsWorking(false);
      }
    },
    [closeOpenedThread, openedThreadId, refreshThreads, selectedThread?.id]
  );

  const saveDraft = useCallback(async () => {
    if (composePayload.to.length === 0) {
      setStatus("Add at least one recipient");
      return;
    }
    setIsWorking(true);
    try {
      const draft = await createMailDraft(composePayload);
      setComposeDraftId(draft.item.id ?? null);
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
        setThreadDetail((prev) => {
          if (!prev || prev.id !== threadId) return prev;
          return {
            ...prev,
            snippet: messageBody.slice(0, 180),
            lastMessageAt: sentAt,
            messages: [
              ...prev.messages,
              {
                id: `local-sent-${Date.now()}`,
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

  const connectGmail = useCallback(async () => {
    try {
      const { authUrl } = await startGoogleAuth();
      window.open(authUrl, "_blank", "noopener,noreferrer");
      setStatus("Opened Google OAuth consent");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to start OAuth");
    }
  }, []);

  const syncInbox = useCallback(async () => {
    setIsWorking(true);
    try {
      const result = await syncGmail(50);
      setStatus(`Synced ${result.importedThreads} threads`);
      await refreshThreads();
      await refreshConnector();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setIsWorking(false);
    }
  }, [refreshConnector, refreshThreads]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctrlOrMeta = event.metaKey || event.ctrlKey;
      if (ctrlOrMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen(true);
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
        if (!openedThreadId && selectedThread?.id) {
          void openThread(selectedThread.id, { openComposer: true });
          return;
        }
        setComposeOpen(true);
        setTimeout(() => replyRef.current?.focus(), 30);
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
        if (composeOpen) void sendCompose();
      }

    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    closeOpenedThread,
    composeOpen,
    isCommandOpen,
    executeThreadAction,
    isSidebarOpen,
    openNewCompose,
    openThread,
    openedThreadId,
    selectedThread?.id,
    sendCompose,
    threads.length
  ]);

  return (
    <main className="mailApp">
      <header className="mailTopBar">
        <div className="topTabs">
          <button className="topTab active">Important (615) - {gmailAccount ?? "you@gmail.com"}</button>
          <button className="topTab">Important (332) - personal@gmail.com</button>
          <button className="topTab">Inbox - ops@gmail.com</button>
        </div>
        <div className="topControls">
          <button onClick={() => void connectGmail()}>Connect Gmail</button>
          <button onClick={() => void syncInbox()} disabled={isWorking}>
            Sync
          </button>
          <span className="statusDot">{gmailConnected ? `Connected: ${gmailAccount ?? "gmail"}` : "Gmail not connected"}</span>
        </div>
      </header>

      <aside className="rail">
        <button className="railBrand" aria-label="assistant">
          ai
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
              {focusTabs.map((tab) => (
                <button key={tab}>{tab}</button>
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
              <button
                className="ghost"
                onClick={() => {
                  closeOpenedThread();
                }}
              >
                ← Back
              </button>
              <div>
                <h2>{threadDetail?.subject ?? "Thread"}</h2>
                <p>{threadDetail?.snippet ?? "Conversation"}</p>
              </div>
              <div className="threadActions">
                <button
                  onClick={() => {
                    setComposeOpen(true);
                    setTimeout(() => replyRef.current?.focus(), 30);
                  }}
                >
                  Reply (r/a)
                </button>
                <button onClick={() => void executeThreadAction("archive")}>Archive (e)</button>
                <button onClick={() => void executeThreadAction("snooze")}>Snooze (h)</button>
                <button onClick={() => void executeThreadAction("mark_unread")}>Unread</button>
                <button onClick={() => void executeThreadAction("trash")}>Trash</button>
              </div>
            </div>

            <div className="threadConversation" ref={threadConversationRef}>
              {isLoadingThread ? <p className="subtle">Loading thread...</p> : null}
              {threadError ? <p className="errorLine">{threadError}</p> : null}

              {threadDetail?.messages.map((message) => (
                <article className="messageCard" key={message.id}>
                  <p className="messageMeta">
                    <strong>{message.sender}</strong>
                    <span>{relTime(message.timestamp)}</span>
                  </p>
                  <p className="messageBody">{message.body}</p>
                </article>
              ))}
            </div>

            {composeOpen ? (
              <div className="replyDock open">
                <div className="replyHead">
                  <strong>Draft to {composePayload.to[0] ?? "recipient"}</strong>
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
                    placeholder="Write a reply..."
                  />
                </div>
                <div className="replyActions">
                  <button onClick={() => void saveDraft()} disabled={isWorking}>
                    Save Draft
                  </button>
                  <button onClick={() => void sendCompose()} disabled={isWorking}>
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

      <aside className="agentPane">
        <div className="agentHead">
          <h3>EA Agent</h3>
          <span>Always-on via ⌘J</span>
        </div>
        <div className="agentFeed">
          <div className="agentMsg user">Prioritize and summarize this inbox for me.</div>
          <div className="agentMsg ai">Top 3 urgent: certificate revoked, legal demand letter, investor follow-up due today.</div>
          <div className="agentMsg ai">I can draft responses, fetch context from Drive/Notion, and queue tasks.</div>
        </div>
        <div className="agentComposer">
          <textarea ref={agentRef} rows={5} placeholder="Ask your executive assistant..." />
          <div className="agentActions">
            <button>Run</button>
            <button>Draft Reply</button>
            <button>Create Task</button>
          </div>
        </div>
        {status ? <p className="statusLine">{status}</p> : null}
      </aside>
    </main>
  );
}
