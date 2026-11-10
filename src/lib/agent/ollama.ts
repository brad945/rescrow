// Minimal streaming client for a local Ollama server.

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
export const MODEL = process.env.RESCROW_MODEL ?? "gpt-oss:20b";

export interface ChatRequest {
  system: string;
  user: string;
  /** JSON schema the reply must follow. */
  format: object;
  timeoutMs: number;
  onToken?: (text: string) => void;
  /** The model's reasoning, streamed before its answer. */
  onThinking?: (text: string) => void;
}

/** Streams a chat completion and returns the full reply text. */
export async function chat(req: ChatRequest): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        stream: true,
        think: "low",
        format: req.format,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Ollama returned ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const chunk = JSON.parse(line) as {
          message?: { content?: string; thinking?: string };
          error?: string;
        };
        if (chunk.error) throw new Error(chunk.error);
        const thought = chunk.message?.thinking ?? "";
        if (thought) req.onThinking?.(thought);
        const piece = chunk.message?.content ?? "";
        if (piece) {
          reply += piece;
          req.onToken?.(piece);
        }
      }
    }
    return reply;
  } finally {
    clearTimeout(timer);
  }
}

/** Loads the model into memory so the first real call is fast. */
export async function warm(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, keep_alive: "30m" }),
    });
    return res.ok;
  } catch (err) {
    console.error("[agent] could not warm the model", err);
    return false;
  }
}
