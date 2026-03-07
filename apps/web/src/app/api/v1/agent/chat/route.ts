import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getBackendUrl() {
  return process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080";
}

export async function POST(request: NextRequest) {
  const backendUrl = `${getBackendUrl()}/v1/agent/chat`;

  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json"
      },
      body: await request.text(),
      cache: "no-store"
    });

    const text = await response.text();
    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent proxy failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
