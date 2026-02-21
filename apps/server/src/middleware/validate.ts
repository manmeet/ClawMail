import { z } from "zod";

export const agentActionSchema = z.object({
  intent: z.enum(["summarize", "draft", "explain_priority", "delegate", "fetch_context", "send"]),
  input: z.record(z.unknown())
});

export const draftSchema = z.object({
  threadId: z.string().min(1),
  tone: z.enum(["concise", "friendly", "firm"]),
  constraints: z.string().optional()
});

export const taskSchema = z.object({
  threadId: z.string().min(1),
  title: z.string().min(1),
  dueAt: z.string().datetime().optional()
});
