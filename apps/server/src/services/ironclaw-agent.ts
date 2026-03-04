import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type IronclawAgentRequest = {
  message: string;
  sessionKey: string;
  agentId?: string;
  timeoutSeconds?: number;
  cliBin?: string;
};

export type IronclawAgentResponse = {
  assistantMessage: string;
  sessionId: string | null;
  model: string | null;
  raw: Record<string, unknown>;
};

const DEFAULT_AGENT_ID = process.env.AGENT_ID ?? "main";
const DEFAULT_TIMEOUT_SECONDS = Number(process.env.AGENT_TIMEOUT_SECONDS ?? 120);
const DEFAULT_CLI_BIN = process.env.AGENT_CLI_BIN ?? "ironclaw";
const MAX_STDIO_BUFFER = 12 * 1024 * 1024;

function parseFirstJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Agent returned empty output");

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("Agent did not return valid JSON");
    }
    const candidate = trimmed.slice(start, end + 1);
    return JSON.parse(candidate) as Record<string, unknown>;
  }
}

function extractAssistantText(payload: Record<string, unknown>): string {
  const result = payload.result as Record<string, unknown> | undefined;
  const payloads = Array.isArray(result?.payloads) ? result.payloads : [];

  const textBlocks = payloads
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const text = (item as Record<string, unknown>).text;
      return typeof text === "string" ? text.trim() : "";
    })
    .filter(Boolean);

  if (textBlocks.length > 0) return textBlocks.join("\n\n");

  const fallback = result?.text;
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();

  throw new Error("Agent returned no assistant text");
}

function extractSessionId(payload: Record<string, unknown>): string | null {
  const result = payload.result as Record<string, unknown> | undefined;
  const meta = result?.meta as Record<string, unknown> | undefined;
  const agentMeta = meta?.agentMeta as Record<string, unknown> | undefined;
  const sessionId = agentMeta?.sessionId;
  return typeof sessionId === "string" ? sessionId : null;
}

function extractModel(payload: Record<string, unknown>): string | null {
  const result = payload.result as Record<string, unknown> | undefined;
  const meta = result?.meta as Record<string, unknown> | undefined;
  const agentMeta = meta?.agentMeta as Record<string, unknown> | undefined;
  const model = agentMeta?.model;
  return typeof model === "string" ? model : null;
}

export async function runIronclawAgent(request: IronclawAgentRequest): Promise<IronclawAgentResponse> {
  const cliBin = request.cliBin ?? DEFAULT_CLI_BIN;
  const agentId = request.agentId ?? DEFAULT_AGENT_ID;
  const timeoutSeconds =
    typeof request.timeoutSeconds === "number" && Number.isFinite(request.timeoutSeconds)
      ? request.timeoutSeconds
      : DEFAULT_TIMEOUT_SECONDS;

  const args = [
    "agent",
    "--agent",
    agentId,
    "--session-key",
    request.sessionKey,
    "--message",
    request.message,
    "--json",
    "--timeout",
    String(timeoutSeconds)
  ];

  try {
    const { stdout, stderr } = await execFileAsync(cliBin, args, {
      timeout: timeoutSeconds * 1000 + 5000,
      maxBuffer: MAX_STDIO_BUFFER
    });

    const payload = parseFirstJsonObject(stdout);
    const assistantMessage = extractAssistantText(payload);
    if (stderr.trim()) {
      console.warn(`[agent:${cliBin}] stderr: ${stderr.trim()}`);
    }

    return {
      assistantMessage,
      sessionId: extractSessionId(payload),
      model: extractModel(payload),
      raw: payload
    };
  } catch (error) {
    if (error && typeof error === "object") {
      const err = error as {
        message?: string;
        stdout?: string;
        stderr?: string;
      };
      const details = [err.message, err.stderr, err.stdout].filter(Boolean).join(" | ");
      throw new Error(`Failed to run ${cliBin} agent: ${details}`);
    }
    throw error;
  }
}
