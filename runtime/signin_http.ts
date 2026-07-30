import type { IdentitySnapshot } from "./accounts.ts";
import type { SignerConnectionState } from "./signer_service.ts";

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

export function publicIdentity(identity: IdentitySnapshot) {
  if (identity.pubkey && identity.status !== "unavailable") {
    return { status: identity.status, pubkey: identity.pubkey };
  }
  return { status: "unavailable" };
}

export function publicSignerState(state: SignerConnectionState) {
  if (state.status === "active") return publicIdentity(state.identity);
  if (state.status === "awaiting") {
    return { status: "awaiting", uri: state.uri };
  }
  if (state.status === "error") {
    return { status: "error", message: state.message };
  }
  return { status: state.status };
}

export async function readJsonObject(
  req: Request,
): Promise<Record<string, unknown>> {
  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Expected JSON object");
  }
  return body as Record<string, unknown>;
}
