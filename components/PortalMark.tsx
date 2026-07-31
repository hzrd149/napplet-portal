export const PORTAL_GATE_GEOMETRY_ID = "napplet-sovereign-gate-v1";
export const PORTAL_GATE_LINK_ID = "napplet-gate-link-v1";
export const PORTAL_GATE_NODE_ID = "napplet-gate-nodes-v1";

interface PortalMarkProps {
  readonly class?: string;
  readonly dataState?: string;
  readonly dataRitual?: string;
}

export function PortalMark(
  { class: className = "portal-mark", dataState, dataRitual }: PortalMarkProps,
) {
  return (
    <svg
      class={className}
      viewBox="0 0 120 120"
      aria-hidden="true"
      data-state={dataState}
      data-ritual={dataRitual}
      data-portal-geometry={PORTAL_GATE_GEOMETRY_ID}
    >
      <path
        class="constellation-gate"
        data-geometry={PORTAL_GATE_GEOMETRY_ID}
        d="M28 96V42L60 22l32 20v54"
      />
      <path
        class="constellation-link"
        data-geometry={PORTAL_GATE_LINK_ID}
        d="M36 76 52 60 68 66 84 48M52 60l8-24 8 30"
      />
      <g
        class="constellation-nodes"
        data-geometry={PORTAL_GATE_NODE_ID}
      >
        <circle class="constellation-node" cx="36" cy="76" r="5" />
        <circle class="constellation-node" cx="52" cy="60" r="4" />
        <circle class="constellation-node" cx="60" cy="36" r="4" />
        <circle class="constellation-node" cx="68" cy="66" r="4" />
        <circle class="constellation-node" cx="84" cy="48" r="5" />
      </g>
      <path
        class="constellation-proof"
        d="m48 96 12-12 12 12-12 12z"
      />
    </svg>
  );
}
