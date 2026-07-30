---
schema_version: 1
open_count: 0
waived_count: 0
fixed_count: 1
total_count: 1
last_updated: 2026-07-30T13:06:23.126Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | runtime/portal_runtime.ts |  | Broadened the shell receive boundary to the canonical NappletMessage type shape | fixed |  | 2026-07-30T13:06:10.539Z | 2026-07-30T13:06:23.126Z |

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
  }
]
````
