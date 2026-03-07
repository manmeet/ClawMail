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

const DEFAULT_AGENT_ID = process.env.AGENT_ID?.trim() || undefined;
const DEFAULT_TIMEOUT_SECONDS = Number(process.env.AGENT_TIMEOUT_SECONDS ?? 120);
const DEFAULT_CLI_BIN = process.env.AGENT_CLI_BIN;
const MAX_STDIO_BUFFER = 12 * 1024 * 1024;

function toCliSessionId(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

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

function buildParsedResponse(payload: Record<string, unknown>): IronclawAgentResponse {
  return {
    assistantMessage: extractAssistantText(payload),
    sessionId: extractSessionId(payload),
    model: extractModel(payload),
    raw: payload
  };
}

export async function runIronclawAgent(request: IronclawAgentRequest): Promise<IronclawAgentResponse> {
  const cliCandidates = [request.cliBin, DEFAULT_CLI_BIN, "openclaw", "ironclaw"].filter(
    (item, index, all): item is string => typeof item === "string" && item.trim().length > 0 && all.indexOf(item) === index
  );
  const agentId = request.agentId?.trim() || DEFAULT_AGENT_ID;
  const timeoutSeconds =
    typeof request.timeoutSeconds === "number" && Number.isFinite(request.timeoutSeconds)
      ? request.timeoutSeconds
      : DEFAULT_TIMEOUT_SECONDS;

  const args = [
    "agent",
    "--session-id",
    toCliSessionId(request.sessionKey),
    "--message",
    request.message,
    "--json",
    "--timeout",
    String(timeoutSeconds)
  ];

  if (agentId && agentId !== "main") {
    args.splice(1, 0, "--agent", agentId);
  }

  if (cliCandidates.length === 0) {
    throw new Error("Agent CLI not configured. Set AGENT_CLI_BIN to your OpenClaw executable.");
  }

  let lastErrorDetails = "";
  for (const cliBin of cliCandidates) {
    try {
      const { stdout, stderr } = await execFileAsync(cliBin, args, {
        timeout: timeoutSeconds * 1000 + 5000,
        maxBuffer: MAX_STDIO_BUFFER
      });

      const payload = parseFirstJsonObject(stdout);
      if (stderr.trim()) {
        console.warn(`[agent:${cliBin}] stderr: ${stderr.trim()}`);
      }

      return buildParsedResponse(payload);
    } catch (error) {
      if (error && typeof error === "object") {
        const err = error as {
          code?: string | number;
          message?: string;
          stdout?: string;
          stderr?: string;
          signal?: string;
          killed?: boolean;
          cmd?: string;
        };
        if (err.code === "ENOENT") {
          lastErrorDetails = `Missing CLI '${cliBin}'`;
          continue;
        }
        const jsonCandidate = [err.stdout, err.stderr].find((value) => {
          if (typeof value !== "string" || !value.trim()) return false;
          try {
            parseFirstJsonObject(value);
            return true;
          } catch {
            return false;
          }
        });
        if (jsonCandidate) {
          return buildParsedResponse(parseFirstJsonObject(jsonCandidate));
        }

        const timedOut =
          err.signal === "SIGTERM" &&
          err.killed === true &&
          typeof err.message === "string" &&
          err.message.includes("Command failed");
        const detailParts = [
          timedOut ? `Timed out after ${timeoutSeconds}s` : err.message,
          typeof err.code !== "undefined" ? `code=${String(err.code)}` : "",
          err.signal ? `signal=${err.signal}` : "",
          err.cmd ? `cmd=${err.cmd}` : "",
          err.stderr,
          err.stdout
        ].filter(Boolean);
        const details = detailParts.join(" | ");
        throw new Error(`Failed to run ${cliBin} agent: ${details}`);
      }
      throw error;
    }
  }

  throw new Error(
    `No agent CLI found (${cliCandidates.join(", ")}). Install OpenClaw or set AGENT_CLI_BIN to the correct executable. ${lastErrorDetails}`
  );
}
