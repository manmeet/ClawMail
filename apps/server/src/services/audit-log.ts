import { randomUUID } from "node:crypto";
import { AuditEvent } from "../types/domain.js";

const events: AuditEvent[] = [];

export function recordAudit(event: Omit<AuditEvent, "id" | "timestamp">): AuditEvent {
  const created: AuditEvent = {
    ...event,
    id: randomUUID(),
    timestamp: new Date().toISOString()
  };
  events.push(created);
  return created;
}

export function listAudit(threadId?: string): AuditEvent[] {
  if (!threadId) return [...events];
  return events.filter((e) => e.threadId === threadId);
}
