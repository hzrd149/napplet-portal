# Deferred Items

- `tests/runtime_reconnect_smoke_test.ts` fails before exercising catalog code because its spawned production server is not accepting the selected loopback port (`ConnectionRefused` after 13 seconds). The Phase 4 focused suite and static gate pass; this environment-dependent pre-existing smoke failure is outside Plan 04-01 files and scope.
