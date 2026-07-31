import type { ConnectionSnapshot } from "../shell/connection.ts";

interface ConnectionConstellationProps {
  readonly state: ConnectionSnapshot;
  readonly compact: boolean;
}

export function connectionCopy(state: ConnectionSnapshot): string {
  switch (state.phase) {
    case "pending":
      return "Preparing a secure connection.";
    case "connected":
      return "The portal is connected.";
    case "bootstrapping":
      return "The napplet is being verified.";
    case "ready":
      return "The portal is ready.";
    case "retrying":
      return "The connection was interrupted and is recovering.";
    case "dormant":
      return state.online
        ? "Recovery is paused while this tab is hidden."
        : "The portal is offline and will recover when the network returns.";
    case "failed":
      return "The connection is unavailable and recovery will continue.";
  }
}

export function ConnectionConstellation(
  { state, compact }: ConnectionConstellationProps,
) {
  const fractured = state.phase === "retrying" || state.phase === "dormant" ||
    state.phase === "failed";
  return (
    <svg
      class={`connection-constellation ${
        compact ? "constellation-compact" : ""
      }`}
      viewBox="0 0 120 120"
      aria-hidden="true"
      data-state={state.phase}
      data-ritual={state.mode}
    >
      <path class="constellation-gate" d="M32 94V37L60 20l28 17v57" />
      <path
        class={`constellation-link ${
          fractured ? "constellation-fracture" : ""
        }`}
        d="M34 78 51 62 69 68 87 46"
      />
      <path
        class="constellation-link constellation-link-secondary"
        d="m51 62 9-25 9 31"
      />
      <circle
        class="constellation-node constellation-seed"
        cx="34"
        cy="78"
        r="5"
      />
      <circle class="constellation-node" cx="51" cy="62" r="4" />
      <circle class="constellation-node" cx="60" cy="37" r="4" />
      <circle class="constellation-node" cx="69" cy="68" r="4" />
      <circle class="constellation-node" cx="87" cy="46" r="5" />
      <path class="constellation-proof" d="m50 94 10-10 10 10-10 10z" />
    </svg>
  );
}
