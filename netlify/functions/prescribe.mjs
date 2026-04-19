const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: HEADERS });
  }
  try {
    const body = await req.json();
    const { messages, system } = body;
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "No messages" }), { status: 400, headers: HEADERS });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), { status: 500, headers: HEADERS });
    }
    const payload = {
      model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages,
    };
    if (system) payload.system = system;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Anthropic error", detail: data }), { status: 500, headers: HEADERS });
    }
    return new Response(JSON.stringify({
      success: true,
      message: data.content?.[0]?.text || "",
      usage: data.usage,
    }), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server crash", detail: err.message }), { status: 500, headers: HEADERS });
  }
}
