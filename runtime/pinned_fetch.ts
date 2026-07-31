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
    return await undiciFetch(
      url,
      {
        ...init,
        dispatcher,
      } as Parameters<typeof undiciFetch>[1],
    ) as unknown as Response;
  } finally {
    await dispatcher.close();
  }
}
