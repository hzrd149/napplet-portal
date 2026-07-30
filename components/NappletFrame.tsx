import { useEffect, useRef } from "preact/hooks";

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

const DOMAINS = Object.freeze(["shell", "identity", "relay", "outbox"]);

export function createIframeBridge(options: IframeBridgeOptions) {
  let initialized = false;
  return {
    receive(event: BridgeEvent): void {
      const source = options.source();
      if (!source || event.source !== source) return;
      if (!event.data || typeof event.data !== "object") return;
      const message = event.data as Record<string, unknown>;
      if (typeof message.type !== "string") return;
      if (message.type === "shell.ready") {
        if (initialized) return;
        initialized = true;
        options.post({
          type: "shell.init",
          capabilities: { domains: [...DOMAINS] },
          services: [...DOMAINS],
        });
        return;
      }
      if (!/^(identity|relay|outbox)\./.test(message.type)) return;
      options.forward(message);
    },
    reset(): void {
      initialized = false;
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
