---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 3
total_count: 4
last_updated: 2026-07-30T13:24:01.859Z
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
  }
]
````
