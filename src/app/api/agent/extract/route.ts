import { z } from "zod";
import { extractTerms } from "@/lib/agent";
import { errorResponse, parseBody } from "@/lib/api";
import { ndjsonStream } from "@/lib/ndjson";

const schema = z.object({ text: z.string().trim().min(40).max(20_000) });

/**
 * Runs the agent on any pasted agreement without saving anything. Streams
 * {type:"token"} events, then {type:"done", terms, verified}.
 */
export async function POST(req: Request) {
  let text: string;
  try {
    ({ text } = await parseBody(req, schema));
  } catch (err) {
    return errorResponse(err);
  }
  return ndjsonStream(async (send) => {
    const { terms, verified } = await extractTerms(text, {
      onToken: (t) => send({ type: "token", text: t }),
      onThinking: (t) => send({ type: "thinking", text: t }),
    });
    send({ type: "done", terms, verified });
  });
}
