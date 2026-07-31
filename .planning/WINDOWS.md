---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 13
total_count: 17
last_updated: 2026-07-31T05:14:14.644Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | runtime/portal_runtime.ts |  | Broadened the shell receive boundary to the canonical NappletMessage type shape | fixed |  | 2026-07-30T13:06:10.539Z | 2026-07-30T13:06:23.126Z |
| 2 | 01 | deviation | routes/api/runtime.ts |  | Added browser-safe public account projection and server-side sign-out message | fixed |  | 2026-07-30T13:15:56.068Z | 2026-07-30T13:15:56.179Z |
| 3 | 01 | unrun-verify | islands/NappletShell.tsx |  | Responsive 320/390/768/1440px and safe-area browser inspection deferred to Plan 01-06 final UI checkpoint | open |  | 2026-07-30T13:15:56.294Z |  |
| 4 | 01 | deviation | runtime/outbox.ts |  | Made OUTBOX and replaced-window cleanup idempotent and replay-safe | fixed |  | 2026-07-30T13:24:01.738Z | 2026-07-30T13:24:01.859Z |
| 5 | 03 | deviation | runtime/port.ts |  | Added validated PORTAL_PORT support for unattended production smoke | fixed |  | 2026-07-31T00:16:41.967Z | 2026-07-31T00:17:08.857Z |
| 6 | 03 | deviation | tests/shell_architecture_test.ts |  | Aligned legacy transport assertions with controller-owned recovery | fixed |  | 2026-07-31T00:16:42.072Z | 2026-07-31T00:17:08.965Z |
| 7 | 04 | unrun-verify | tests/runtime_reconnect_smoke_test.ts |  | Production reconnect smoke could not reach its spawned loopback server; focused Phase 04-01 verification passed | open |  | 2026-07-31T01:16:43.974Z |  |
| 8 | 04 | deviation | runtime/catalog.ts |  | Corrected redundant async and mutable in-flight task binding during static verification | fixed |  | 2026-07-31T01:16:44.087Z | 2026-07-31T01:17:17.220Z |
| 9 | 04 | deviation | runtime/catalog.ts |  | Normalized absent catalog generation from undefined to null for first-install approval | fixed |  | 2026-07-31T01:23:55.401Z | 2026-07-31T01:24:28.480Z |
| 10 | 04 | deviation | shell/connection.ts |  | Added socket terminal callback required for pending catalog command cleanup | fixed |  | 2026-07-31T01:31:18.558Z | 2026-07-31T01:31:54.949Z |
| 11 | 04 | deviation | components/HomeView.tsx |  | Removed projected executable launch bytes from the catalog card contract | fixed |  | 2026-07-31T01:31:18.664Z | 2026-07-31T01:31:55.053Z |
| 12 | 05 | deviation | islands/NappletShell.tsx |  | Preserved canonical caller correlation IDs by selecting the fixed tracer only by URL | fixed |  | 2026-07-31T02:18:16.185Z | 2026-07-31T02:19:04.919Z |
| 13 | 06 | deviation | islands/NappletShell.tsx |  | Verified capability handoff added to complete the production iframe bridge | open |  | 2026-07-31T03:28:43.610Z |  |
| 14 | 06 | deviation | main.ts |  | In-memory tracer storage port wired pending Plan 06-03 durability | open |  | 2026-07-31T03:28:43.721Z |  |
| 15 | 07 | deviation | islands/IntentReservation.tsx |  | Used globalThis.opener to satisfy Deno no-window lint while preserving opener-first ordering | fixed |  | 2026-07-31T04:32:20.762Z | 2026-07-31T04:32:34.104Z |
| 16 | 08 | deviation | runtime/connections.ts |  | Stale attachment close fencing added for reconnect correctness | fixed |  | 2026-07-31T05:13:48.670Z | 2026-07-31T05:14:14.508Z |
| 17 | 08 | deviation | tests/media_lifecycle_test.ts |  | Lifecycle fixture adjusted to satisfy prefer-const lint | fixed |  | 2026-07-31T05:13:48.785Z | 2026-07-31T05:14:14.644Z |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "runtime/portal_runtime.ts",
    "line": null,
    "description": "Broadened the shell receive boundary to the canonical NappletMessage type shape",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-30T13:06:10.539Z",
    "resolved_at": "2026-07-30T13:06:23.126Z"
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "01",
    "file": "routes/api/runtime.ts",
    "line": null,
    "description": "Added browser-safe public account projection and server-side sign-out message",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-30T13:15:56.068Z",
    "resolved_at": "2026-07-30T13:15:56.179Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "islands/NappletShell.tsx",
    "line": null,
    "description": "Responsive 320/390/768/1440px and safe-area browser inspection deferred to Plan 01-06 final UI checkpoint",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-30T13:15:56.294Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "01",
    "file": "runtime/outbox.ts",
    "line": null,
    "description": "Made OUTBOX and replaced-window cleanup idempotent and replay-safe",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-30T13:24:01.738Z",
    "resolved_at": "2026-07-30T13:24:01.859Z"
  },
  {
    "id": 5,
    "kind": "deviation",
    "phase": "03",
    "file": "runtime/port.ts",
    "line": null,
    "description": "Added validated PORTAL_PORT support for unattended production smoke",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T00:16:41.967Z",
    "resolved_at": "2026-07-31T00:17:08.857Z"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "03",
    "file": "tests/shell_architecture_test.ts",
    "line": null,
    "description": "Aligned legacy transport assertions with controller-owned recovery",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T00:16:42.072Z",
    "resolved_at": "2026-07-31T00:17:08.965Z"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "tests/runtime_reconnect_smoke_test.ts",
    "line": null,
    "description": "Production reconnect smoke could not reach its spawned loopback server; focused Phase 04-01 verification passed",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-31T01:16:43.974Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "deviation",
    "phase": "04",
    "file": "runtime/catalog.ts",
    "line": null,
    "description": "Corrected redundant async and mutable in-flight task binding during static verification",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T01:16:44.087Z",
    "resolved_at": "2026-07-31T01:17:17.220Z"
  },
  {
    "id": 9,
    "kind": "deviation",
    "phase": "04",
    "file": "runtime/catalog.ts",
    "line": null,
    "description": "Normalized absent catalog generation from undefined to null for first-install approval",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T01:23:55.401Z",
    "resolved_at": "2026-07-31T01:24:28.480Z"
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "04",
    "file": "shell/connection.ts",
    "line": null,
    "description": "Added socket terminal callback required for pending catalog command cleanup",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T01:31:18.558Z",
    "resolved_at": "2026-07-31T01:31:54.949Z"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "04",
    "file": "components/HomeView.tsx",
    "line": null,
    "description": "Removed projected executable launch bytes from the catalog card contract",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T01:31:18.664Z",
    "resolved_at": "2026-07-31T01:31:55.053Z"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "05",
    "file": "islands/NappletShell.tsx",
    "line": null,
    "description": "Preserved canonical caller correlation IDs by selecting the fixed tracer only by URL",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T02:18:16.185Z",
    "resolved_at": "2026-07-31T02:19:04.919Z"
  },
  {
    "id": 13,
    "kind": "deviation",
    "phase": "06",
    "file": "islands/NappletShell.tsx",
    "line": null,
    "description": "Verified capability handoff added to complete the production iframe bridge",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-31T03:28:43.610Z",
    "resolved_at": null
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "06",
    "file": "main.ts",
    "line": null,
    "description": "In-memory tracer storage port wired pending Plan 06-03 durability",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-31T03:28:43.721Z",
    "resolved_at": null
  },
  {
    "id": 15,
    "kind": "deviation",
    "phase": "07",
    "file": "islands/IntentReservation.tsx",
    "line": null,
    "description": "Used globalThis.opener to satisfy Deno no-window lint while preserving opener-first ordering",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T04:32:20.762Z",
    "resolved_at": "2026-07-31T04:32:34.104Z"
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "08",
    "file": "runtime/connections.ts",
    "line": null,
    "description": "Stale attachment close fencing added for reconnect correctness",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T05:13:48.670Z",
    "resolved_at": "2026-07-31T05:14:14.508Z"
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "08",
    "file": "tests/media_lifecycle_test.ts",
    "line": null,
    "description": "Lifecycle fixture adjusted to satisfy prefer-const lint",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-07-31T05:13:48.785Z",
    "resolved_at": "2026-07-31T05:14:14.644Z"
  }
]
````
