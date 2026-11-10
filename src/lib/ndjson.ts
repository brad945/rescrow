/** Streams newline-delimited JSON events to the browser as they happen. */
export function ndjsonStream(
  run: (send: (event: object) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        await run(send);
      } catch (err) {
        console.error("[stream]", err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
