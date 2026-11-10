// Minimal streaming client for a local Ollama server.

export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const PREFERENCE = ["gpt-oss", "qwen", "llama"];

/**
 * OLLAMA_MODEL (or RESCROW_MODEL) if set; otherwise the first installed model
 * in the order gpt-oss, qwen, llama.
 */
export async function pickModel(): Promise<string> {
  const pinned = process.env.OLLAMA_MODEL ?? process.env.RESCROW_MODEL;
  if (pinned) return pinned;
  const res = await fetch(`${OLLAMA_URL}/api/tags`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const { models = [] } = (await res.json()) as { models?: { name: string }[] };
  for (const family of PREFERENCE) {
    const hit = models.find(
      (m) => m.name.startsWith(family) && !/vl|vision/.test(m.name),
    );
    if (hit) return hit.name;
  }
  throw new Error("No gpt-oss, qwen or llama model installed in Ollama");
}

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
export async function chat(
  req: ChatRequest,
): Promise<{ reply: string; model: string }> {
  const model = await pickModel();
  const controller = new AbortController();
  // A stalled model sends nothing, and an abort only surfaces on the next
  // chunk. Racing every read against this promise makes the timeout exact.
  let timedOut: () => void = () => {};
  const deadline = new Promise<never>((_, reject) => {
    timedOut = () =>
      reject(new Error(`Model took longer than ${req.timeoutMs / 1000}s`));
  });
  deadline.catch(() => {}); // Observed below; avoid an unhandled rejection.
  const timer = setTimeout(() => {
    controller.abort();
    timedOut();
  }, req.timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
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
    deadline.catch(() => void reader.cancel().catch(() => {}));
    const decoder = new TextDecoder();
    let buffer = "";
    let reply = "";
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
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
    return { reply, model };
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
      body: JSON.stringify({ model: await pickModel(), keep_alive: "30m" }),
    });
    return res.ok;
  } catch (err) {
    console.error("[agent] could not warm the model", err);
    return false;
  }
}
