import { type ResolvedNapplet, resolveNapplet } from "@kehto/nip/5d";
import type { NostrEvent } from "@napplet/core";

interface ArtifactFixture {
  readonly manifestEvent: NostrEvent;
  readonly artifact: { readonly servers: readonly string[] };
}

export async function resolveVerifiedArtifact(
  fixture: ArtifactFixture,
  fetcher: typeof fetch = fetch,
): Promise<ResolvedNapplet> {
  return await resolveNapplet({
    event: fixture.manifestEvent,
    fetchBlob: async (sha256, manifestServers) => {
      const servers = manifestServers.length > 0
        ? manifestServers
        : fixture.artifact.servers;
      let lastError: unknown;
      for (const server of servers) {
        try {
          const response = await fetcher(
            `${server.replace(/\/$/, "")}/${sha256}`,
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return new Uint8Array(await response.arrayBuffer());
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError ?? new Error("artifact unavailable");
    },
  });
}
