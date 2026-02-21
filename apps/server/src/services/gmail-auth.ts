import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

type StoredToken = {
  tokens: {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
    expiry_date?: number;
  };
  connectedEmail?: string;
  connectedAt: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../.data");
const TOKEN_PATH = path.join(DATA_DIR, "gmail-token.json");

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email"
];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:8080/v1/auth/google/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function readStoredToken(): Promise<StoredToken | null> {
  try {
    const raw = await readFile(TOKEN_PATH, "utf8");
    return JSON.parse(raw) as StoredToken;
  } catch {
    return null;
  }
}

async function saveStoredToken(token: StoredToken): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(token, null, 2), "utf8");
}

export function getGoogleAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });
}

export async function exchangeCodeAndStoreToken(code: string): Promise<{ connectedEmail?: string }> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const profile = await oauth2.userinfo.get();

  await saveStoredToken({
    tokens: {
      access_token: tokens.access_token ?? undefined,
      refresh_token: tokens.refresh_token ?? undefined,
      scope: tokens.scope ?? undefined,
      token_type: tokens.token_type ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined
    },
    connectedEmail: profile.data.email ?? undefined,
    connectedAt: new Date().toISOString()
  });

  return { connectedEmail: profile.data.email ?? undefined };
}

export async function getConnectedGmailClient() {
  const stored = await readStoredToken();
  if (!stored?.tokens?.access_token && !stored?.tokens?.refresh_token) {
    return null;
  }

  const client = getOAuthClient();
  client.setCredentials(stored.tokens);

  return {
    client,
    connectedEmail: stored.connectedEmail
  };
}

export async function getGmailConnectionStatus() {
  const stored = await readStoredToken();
  return {
    connected: Boolean(stored?.tokens?.access_token || stored?.tokens?.refresh_token),
    connectedEmail: stored?.connectedEmail,
    connectedAt: stored?.connectedAt
  };
}

export async function disconnectGmail() {
  await saveStoredToken({
    tokens: {},
    connectedAt: new Date().toISOString()
  });
}
