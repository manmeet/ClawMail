"use client";

import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { shortcutHelp } from "../lib/shortcuts";
import { createDraft, fetchInbox, fetchThread, runAgentAction } from "../lib/api";
import type { AgentActionIntent, Thread, ThreadDetail, ViewName } from "../lib/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

const views: { id: ViewName; label: string }[] = [
  { id: "inbox", label: "Inbox" },
  { id: "priority", label: "Important" },
  { id: "needs-reply", label: "Needs Reply" },
  { id: "waiting", label: "Waiting" },
  { id: "snoozed", label: "Snoozed" },
  { id: "delegated", label: "Delegated" },
  { id: "done", label: "Done" }
];

const accountTabs = [
  "Important (614) - msm@trexorobotics.com",
  "Important (332) - naturalravine@gmail.com",
  "Important (149) - manmeet.maggu@gmail.com",
  "Inbox - ajooni.maggu@gmail.com"
];

const quickBuckets = ["Investors", "FDA", "Signature", "VPM", "PandaDoc", "Calendar", "Other"];

function formatRelative(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function makeMessage(role: ChatMessage["role"], text: string): ChatMessage {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, role, text };
}

export function InboxShell() {
  const [view, setView] = useState<ViewName>("priority");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [threadDetail, setThreadDetail] = useState<ThreadDetail | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [chatInput, setChatInput] = useState("Draft a concise response using Drive context.");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    makeMessage("assistant", "Thread-aware executive assistant is online. Open a thread and assign work.")
  ]);

  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastThreadContextRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInbox() {
      try {
        setListLoading(true);
        setListError(null);
        const data = await fetchInbox(view);
        if (!isMounted) return;
        setThreads(data);
        setSelectedIndex(0);
        setIsThreadOpen(false);
      } catch (error) {
        if (!isMounted) return;
        setListError(error instanceof Error ? error.message : "Failed to load inbox");
      } finally {
        if (isMounted) setListLoading(false);
      }
    }

    loadInbox();
    return () => {
      isMounted = false;
    };
  }, [view]);

  const current = useMemo(() => {
    if (threads.length === 0) return null;
    return threads[Math.min(selectedIndex, Math.max(threads.length - 1, 0))] ?? null;
  }, [threads, selectedIndex]);

  useEffect(() => {
    const threadId = current?.id ?? "";
    if (!threadId) {
      setThreadDetail(null);
      return;
    }

    let isMounted = true;

    async function loadThread() {
      try {
        setThreadLoading(true);
        setThreadError(null);
        const details = await fetchThread(threadId);
        if (!isMounted) return;
        setThreadDetail(details);
      } catch (error) {
        if (!isMounted) return;
        setThreadError(error instanceof Error ? error.message : "Failed to load thread");
      } finally {
        if (isMounted) setThreadLoading(false);
      }
    }

    loadThread();

    return () => {
      isMounted = false;
    };
  }, [current?.id]);

  useEffect(() => {
    if (!current) return;
    if (lastThreadContextRef.current === current.id) return;

    lastThreadContextRef.current = current.id;
    setChatMessages((prev) => [
      ...prev,
      makeMessage("system", `Context switched to thread: ${current.subject} (${current.participants[0] ?? "Unknown"}).`)
    ]);
  }, [current]);

  const runIntent = useCallback(
    async (prompt: string, intent: AgentActionIntent) => {
      if (!current?.id) {
        setChatMessages((prev) => [...prev, makeMessage("assistant", "Select a thread first so I can act with context.")]);
        return;
      }

      setChatLoading(true);
      try {
        if (intent === "draft") {
          const draft = await createDraft(current.id, "concise", prompt);
          setChatMessages((prev) => [...prev, makeMessage("assistant", `Draft ready:\n\n${draft.content}`)]);
          return;
        }

        const decision = await runAgentAction(current.id, intent, { prompt, scope: "thread" });
        const tool = decision.proposedToolCalls?.[0]?.tool;
        const approval = decision.approval ? ` Approval required (${decision.approval.actionType}).` : "";
        const detail = tool ? ` Tool: ${tool}.` : "";

        setChatMessages((prev) => [
          ...prev,
          makeMessage("assistant", `Status: ${decision.status}. ${decision.reason}.${detail}${approval}`)
        ]);
      } catch (error) {
        setChatMessages((prev) => [
          ...prev,
          makeMessage("assistant", `Action failed: ${error instanceof Error ? error.message : "unknown error"}`)
        ]);
      } finally {
        setChatLoading(false);
      }
    },
    [current?.id]
  );

  const sendChat = useCallback(async () => {
    const prompt = chatInput.trim();
    if (!prompt) return;

    setChatMessages((prev) => [...prev, makeMessage("user", prompt)]);
    setChatInput("");

    const lowered = prompt.toLowerCase();
    if (lowered.includes("draft")) {
      await runIntent(prompt, "draft");
      return;
    }

    if (lowered.includes("delegate")) {
      await runIntent(prompt, "delegate");
      return;
    }

    if (lowered.includes("priority")) {
      await runIntent(prompt, "explain_priority");
      return;
    }

    await runIntent(prompt, "summarize");
  }, [chatInput, runIntent]);

  const onKey = useCallback(
    (event: KeyboardEvent) => {
      const ctrlOrMeta = event.metaKey || event.ctrlKey;

      if (ctrlOrMeta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandOpen((v) => !v);
        return;
      }

      if (event.key === "j") {
        event.preventDefault();
        setSelectedIndex((v) => Math.min(v + 1, Math.max(threads.length - 1, 0)));
        return;
      }

      if (event.key === "k" && !ctrlOrMeta) {
        event.preventDefault();
        setSelectedIndex((v) => Math.max(v - 1, 0));
        return;
      }

      if (event.key === "Enter" || event.key.toLowerCase() === "o") {
        if (!isCommandOpen) {
          event.preventDefault();
          if (current?.id) setIsThreadOpen(true);
        }
        return;
      }

      if (event.key.toLowerCase() === "u") {
        event.preventDefault();
        setIsThreadOpen(false);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (isSidebarOpen) {
          setIsSidebarOpen(false);
          return;
        }
        setIsThreadOpen(false);
        return;
      }

      if (event.key.toLowerCase() === "a" && !event.shiftKey && !ctrlOrMeta) {
        event.preventDefault();
        chatInputRef.current?.focus();
        return;
      }

      if (event.shiftKey && event.key === "D") {
        event.preventDefault();
        setChatInput("Draft a concise response with two clear commitments.");
        void runIntent("Draft a concise response with two clear commitments.", "draft");
        return;
      }

      if (event.shiftKey && event.key === "S") {
        event.preventDefault();
        void runIntent("Summarize this thread and recommend next action.", "summarize");
        return;
      }

      if (event.shiftKey && event.key === "P") {
        event.preventDefault();
        void runIntent("Explain priority and cite signals.", "explain_priority");
        return;
      }

      if (event.shiftKey && event.key === "T") {
        event.preventDefault();
        void runIntent("Delegate follow-up and create task with due date.", "delegate");
      }
    },
    [current?.id, isCommandOpen, isSidebarOpen, runIntent, threads.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  const openThread = (idx: number) => {
    setSelectedIndex(idx);
    setIsThreadOpen(true);
    setIsSidebarOpen(false);
  };

  return (
    <main className="superShell">
      <header className="topChrome">
        {accountTabs.map((tab, index) => (
          <button key={tab} className={index === 0 ? "accountTab active" : "accountTab"}>
            {tab}
          </button>
        ))}
      </header>

      <aside className="iconRail">
        <div className="logoDot">ai</div>
        <button className={isSidebarOpen ? "railBtn active" : "railBtn"} onClick={() => setIsSidebarOpen((v) => !v)} aria-label="toggle folders">
          ✉
        </button>
        <button className="railBtn">31</button>
      </aside>

      {isSidebarOpen ? <button className="drawerScrim" aria-label="close folders" onClick={() => setIsSidebarOpen(false)} /> : null}

      <aside className={isSidebarOpen ? "foldersPane drawer open" : "foldersPane drawer"}>
        <div className="foldersHeader">
          <h2>Important</h2>
          <span>{threads.length}</span>
        </div>
        <nav>
          {views.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id);
                setIsSidebarOpen(false);
              }}
              className={view === item.id ? "folder active" : "folder"}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="agentHint">
          <p>EA Assistant</p>
          <small>Always-on via `a` or `Cmd/Ctrl+K`</small>
        </div>
      </aside>

      <section className="mainPane">
        {!isThreadOpen ? (
          <>
            <div className="bucketBar">
              <button className="hamburgerBtn" aria-label="open folders" onClick={() => setIsSidebarOpen(true)}>
                ☰
              </button>
              {quickBuckets.map((bucket) => (
                <button key={bucket} className="bucketBtn">
                  {bucket}
                </button>
              ))}
            </div>

            {listLoading ? <p className="sub">Loading inbox...</p> : null}
            {listError ? <p className="error">{listError}</p> : null}

            <ul className="threadTable">
              {threads.map((thread, idx) => (
                <li key={thread.id} onClick={() => openThread(idx)} className={idx === selectedIndex ? "mailRow active" : "mailRow"}>
                  <div className="senderCol">
                    <span className="dot" />
                    <strong>{thread.participants[0] ?? "Unknown"}</strong>
                  </div>
                  <p className="subjectCol">{thread.subject}</p>
                  <p className="snippetCol">{thread.snippet ?? thread.priority.reasons[0] ?? "No preview"}</p>
                  <span className="iconCol">{idx % 2 === 0 ? "⊃" : "✓"}</span>
                  <span className="timeCol">{formatRelative(thread.lastMessageAt)}</span>
                </li>
              ))}
            </ul>
            {threadLoading ? <p className="sub listStatus">Loading thread...</p> : null}
            {threadError ? <p className="error listStatus">{threadError}</p> : null}
          </>
        ) : (
          <div className="threadReader">
            <div className="threadReaderHeader">
              <button className="backBtn" onClick={() => setIsThreadOpen(false)} aria-label="back to list">
                ←
              </button>
              <div>
                <h2>{threadDetail?.subject ?? current?.subject ?? "Thread"}</h2>
                <p>{threadDetail?.messages[0]?.sender ?? current?.participants[0] ?? "Unknown"}</p>
              </div>
              <div className="readerActions">
                <button onClick={() => void runIntent("Draft a concise reply to this thread.", "draft")}>Draft</button>
                <button onClick={() => void runIntent("Summarize this thread and next steps.", "summarize")}>Summarize</button>
                <button onClick={() => void runIntent("Delegate follow-up with due date.", "delegate")}>Delegate</button>
              </div>
            </div>

            <div className="threadReaderBody">
              <article className="readerMessageCard">
                <p className="readerMeta">
                  {threadDetail?.messages[0]?.sender ?? current?.participants[0] ?? "Unknown"}
                  <span>{threadDetail?.messages[0]?.timestamp ? formatRelative(threadDetail.messages[0].timestamp) : ""}</span>
                </p>
                <p>{threadDetail?.messages[0]?.body ?? current?.snippet ?? "No message body available."}</p>
              </article>
            </div>
          </div>
        )}
      </section>

      <aside className="rightPane chatPane">
        <div className="chatHeader">
          <h3>
            Chat: <span>{current?.participants[0] ?? "inbox"}</span>
          </h3>
          <p>{chatLoading ? "Streaming..." : "Ready"}</p>
        </div>

        <div className="chatFeed">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`chatMsg ${msg.role}`}>
              <p>{msg.text}</p>
            </div>
          ))}
        </div>

        <div className="chatShortcuts">
          <button onClick={() => void runIntent("Summarize this thread and next steps.", "summarize")}>Summarize</button>
          <button onClick={() => void runIntent("Draft a concise reply.", "draft")}>Draft Reply</button>
          <button onClick={() => void runIntent("Pull context from connected docs.", "fetch_context")}>Pull Context</button>
        </div>

        <div className="chatComposer">
          <textarea
            ref={chatInputRef}
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            rows={3}
            placeholder="Ask your EA to draft, triage, delegate, or fetch context..."
          />
          <div className="composerActions">
            <button onClick={() => void sendChat()} disabled={chatLoading}>
              {chatLoading ? "Running..." : "Send"}
            </button>
            <span className="sub">{shortcutHelp[0]} • {shortcutHelp[9]}</span>
          </div>
        </div>
      </aside>

      {isCommandOpen ? (
        <div className="commandBar" role="dialog" aria-modal="true">
          <input autoFocus placeholder="Command: draft reply with Drive context" aria-label="command" />
        </div>
      ) : null}
    </main>
  );
}
