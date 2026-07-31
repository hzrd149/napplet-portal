import { Agent, fetch as undiciFetch } from "undici";
/** Fetches through a connector whose DNS lookup can return only policy-approved IPs. */
export async function pinnedFetch(
  url: URL,
  init: RequestInit = {},
  approvedAddresses: readonly string[] = [],
): Promise<Response> {
  const addresses = [...approvedAddresses];
  if (addresses.length === 0) throw new TypeError("missing approved address");
  const dispatcher = new Agent({
    connect: {
      lookup: (
        _hostname: string,
        options: { family?: number; all?: boolean },
        callback:
          & ((error: Error | null, address: string, family: 4 | 6) => void)
          & ((
            error: Error | null,
            addresses: Array<{ address: string; family: 4 | 6 }>,
          ) => void),
      ) => {
        const family = typeof options === "object" ? options.family : 0;
        const address = addresses.find((value) =>
          family === 6
            ? value.includes(":")
            : family === 4
            ? !value.includes(":")
            : true
        ) ?? addresses[0];
        if (options.all) {
          callback(
            null,
            addresses.map((value) => ({
              address: value,
              family: value.includes(":") ? 6 as const : 4 as const,
            })),
          );
        } else {
          callback(null, address, address.includes(":") ? 6 : 4);
        }
      },
    },
  });
  try {
    const response = await undiciFetch(
      url,
      {
        ...init,
        dispatcher,
      } as Parameters<typeof undiciFetch>[1],
    ) as unknown as Response;
    if (!response.body) {
      await dispatcher.close();
      return response;
    }
    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (chunk.done) {
            controller.close();
            await dispatcher.close();
          } else {
            controller.enqueue(chunk.value);
          }
        } catch (error) {
          controller.error(error);
          await dispatcher.close();
        }
      },
      async cancel(reason) {
        try {
          await reader.cancel(reason);
        } finally {
          await dispatcher.close();
        }
      },
    });
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    await dispatcher.close();
    throw error;
  }
}
