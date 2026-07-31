import { useEffect, useRef } from "preact/hooks";
import { debug as rootDebug, shortId } from "../debug.ts";

const debug = rootDebug.extend("iframe");

export interface VerifiedNappletIdentity {
  readonly dTag: string;
  readonly aggregateHash: string;
}

export interface FrameIdentityRegistry {
  register(
    source: Window,
    identity: VerifiedNappletIdentity,
  ): void;
}

interface VerifiedIdentityPublisherOptions {
  readonly source: () => Window | null;
  readonly registered: () => {
    source: Window;
    identity: VerifiedNappletIdentity;
  } | null;
  readonly post: (
    message: { type: "identity.changed"; identity: { pubkey: string } },
  ) => void;
}

export function createVerifiedIdentityPublisher(
  options: VerifiedIdentityPublisherOptions,
) {
  return (
    candidate: Window,
    message: { type: "identity.changed"; identity: { pubkey: string } },
  ): boolean => {
    const source = options.source();
    if (
      !source || candidate !== source || options.registered()?.source !== source
    ) return false;
    options.post(message);
    return true;
  };
}

export function mountVerifiedFrame(
  frame: HTMLIFrameElement,
  identity: VerifiedNappletIdentity,
  srcdoc: string,
  registry: FrameIdentityRegistry,
): void {
  const source = frame.contentWindow;
  if (!source) throw new Error("napplet frame window is unavailable");
  registry.register(source, identity);
  frame.srcdoc = srcdoc;
  debug(
    "mounted verified frame dTag=%s aggregate=%s bytes=%d",
    identity.dTag,
    shortId(identity.aggregateHash),
    srcdoc.length,
  );
}

interface BridgeEvent {
  readonly source: MessageEventSource | null;
  readonly data: unknown;
}

interface IframeBridgeOptions {
  readonly source: () => MessageEventSource | null;
  readonly post: (message: Record<string, unknown>) => void;
  readonly forward: (message: Record<string, unknown>) => void;
}

const BASE_DOMAINS = Object.freeze(["shell", "identity", "relay", "outbox"]);

export function createIframeBridge(options: IframeBridgeOptions) {
  let initialized = false;
  let domains: readonly string[] = BASE_DOMAINS;
  return {
    grantDomains(capabilities: readonly string[]): void {
      const granted = capabilities.map((capability) => capability.split(".")[0])
        .filter((domain) => domain === "common" || domain === "storage");
      domains = Object.freeze([...new Set([...BASE_DOMAINS, ...granted])]);
    },
    receive(event: BridgeEvent): void {
      const source = options.source();
      if (!source || event.source !== source) {
        debug(
          "ignored message source trusted=%s",
          Boolean(source && event.source === source),
        );
        return;
      }
      if (!event.data || typeof event.data !== "object") {
        debug("ignored non-object message");
        return;
      }
      const message = event.data as Record<string, unknown>;
      if (typeof message.type !== "string") {
        debug("ignored message without type");
        return;
      }
      debug(
        "received iframe message type=%s initialized=%s",
        message.type,
        initialized,
      );
      if (message.type === "shell.ready") {
        if (initialized) return;
        initialized = true;
        debug("posting shell init services=%d", domains.length);
        options.post({
          type: "shell.init",
          capabilities: { domains: [...domains] },
          services: [...domains],
        });
        return;
      }
      const domain = message.type.split(".")[0];
      if (!domains.includes(domain) || domain === "shell") {
        debug("ignored unsupported iframe message type=%s", message.type);
        return;
      }
      debug("forward iframe message type=%s", message.type);
      options.forward(message);
    },
    reset(): void {
      initialized = false;
      domains = BASE_DOMAINS;
      debug("bridge reset");
    },
  };
}

interface NappletFrameProps {
  readonly srcdoc: string;
  readonly identity: VerifiedNappletIdentity | null;
  readonly title: string;
  readonly hidden: boolean;
  readonly registry: FrameIdentityRegistry;
  readonly onFrame: (frame: HTMLIFrameElement | null) => void;
}

export function NappletFrame({
  srcdoc,
  identity,
  title,
  hidden,
  registry,
  onFrame,
}: NappletFrameProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (!frame.current || !identity || !srcdoc) return;
    mountVerifiedFrame(frame.current, identity, srcdoc, registry);
  }, [identity?.dTag, identity?.aggregateHash, srcdoc]);

  return (
    <iframe
      ref={(element) => {
        frame.current = element;
        onFrame(element);
      }}
      sandbox="allow-scripts"
      title={title}
      class={`napplet-frame ${hidden ? "shell-view-hidden" : ""}`}
      aria-hidden={hidden ? "true" : undefined}
      inert={hidden}
    />
  );
}
