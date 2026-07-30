# Testing Patterns

**Analysis Date:** 2026-07-30

## Test Framework

**Runner:**
- No dedicated test runner is configured in `deno.json`.
- Deno is the available quality runtime; `deno.json` defines `deno task check` for formatting, linting, and type checking.
- No `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `*.test.*`, or `*.spec.*` files were detected in first-party project files.

**Assertion Library:**
- Not detected.
- For future Deno tests, use Deno standard assertions or Deno's built-in test APIs unless a separate runner is added to `deno.json`.

**Run Commands:**
```bash
deno task check        # Run formatting check, linting, and type checking
deno fmt --check .     # Check formatting only
deno lint .            # Run lint only
deno check             # Run type checking only
deno test              # Convention for future Deno tests; not currently wired as a task
```

## Test File Organization

**Location:**
- No test files are present.
- Prefer co-located tests beside small modules when adding unit coverage: `components/Button.test.tsx` next to `components/Button.tsx`, `islands/Counter.test.tsx` next to `islands/Counter.tsx`, and `utils.test.ts` next to `utils.ts`.
- Prefer route tests beside route modules for request/response behavior: `routes/api/[name].test.ts` next to `routes/api/[name].tsx`.

**Naming:**
- Use `*.test.ts` for non-JSX modules such as `utils.ts` and API-route behavior.
- Use `*.test.tsx` for components and islands such as `components/Button.tsx`, `islands/Counter.tsx`, and `routes/index.tsx`.

**Structure:**
```
[feature]/
├── Module.tsx
└── Module.test.tsx

routes/api/
├── [name].tsx
└── [name].test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { assertEquals } from "jsr:@std/assert";
import { handler } from "./[name].tsx";

Deno.test("GET /api/:name returns a capitalized greeting", () => {
  // Arrange: build a minimal Fresh-compatible context or extract pure logic.
  // Act: call the route handler.
  // Assert: verify status and response body.
});
```

**Patterns:**
- Keep Arrange/Act/Assert sections clear in each `Deno.test` body.
- Extract pure helpers before testing complex route behavior; current greeting capitalization is duplicated in `main.ts` and `routes/api/[name].tsx`, so a shared helper would make focused tests easier.
- Test the externally visible contract of routes (`Response` status/body) rather than framework internals.
- For UI components, verify rendered output and event callbacks; `components/Button.tsx` forwards props to `<button>`, and `islands/Counter.tsx` increments/decrements a signal through button clicks.

## Mocking

**Framework:** Not detected

**Patterns:**
```typescript
Deno.test("middleware passes control to the next handler", async () => {
  let called = false;
  const ctx = {
    req: new Request("http://localhost/"),
    next: () => {
      called = true;
      return new Response("ok");
    },
  };

  // Call extracted middleware/helper and assert `called` plus response body.
});
```

**What to Mock:**
- Mock Fresh context objects only at route/middleware boundaries such as `main.ts` and `routes/api/[name].tsx`.
- Mock browser/event interaction when testing island behavior in `islands/Counter.tsx`.
- Mock network, filesystem, timers, and environment variables if future code introduces them.

**What NOT to Mock:**
- Do not mock pure string formatting or small helpers; test their direct output.
- Do not mock Preact props or Signals when the real objects are simple to construct, such as the `Signal<number>` passed to `islands/Counter.tsx`.
- Do not mock Deno's `Response` object; use the real Web API and inspect `status`, headers, and `text()`.

## Fixtures and Factories

**Test Data:**
```typescript
const greetingCases = [
  { name: "alice", expected: "Hello, Alice!" },
  { name: "bob", expected: "Hello, Bob!" },
];

for (const { name, expected } of greetingCases) {
  Deno.test(`greets ${name}`, () => {
    // assert helper or route output equals `expected`
  });
}
```

**Location:**
- No fixture directory exists.
- Keep simple test data inline in the `*.test.ts` or `*.test.tsx` file that uses it.
- Add shared fixtures only after two or more tests need them; place component-specific fixtures near `components/` or `islands/`, and route-specific fixtures near `routes/`.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
deno test --coverage=coverage   # Generate Deno coverage output when tests exist
deno coverage coverage          # Render coverage report from generated profile
```

## Test Types

**Unit Tests:**
- Not currently present.
- Best initial unit-test targets are `components/Button.tsx` prop forwarding, `islands/Counter.tsx` increment/decrement behavior, and any extracted greeting helper shared by `main.ts` and `routes/api/[name].tsx`.

**Integration Tests:**
- Not currently present.
- Best initial integration-test targets are Fresh route handlers in `routes/api/[name].tsx` and middleware behavior in `main.ts`.

**E2E Tests:**
- Not used.
- No Playwright, Cypress, browser automation config, or E2E script is present in `deno.json`.

## Common Patterns

**Async Testing:**
```typescript
Deno.test("response body can be read asynchronously", async () => {
  const response = new Response("Hello, Alice!");
  const body = await response.text();
  assertEquals(body, "Hello, Alice!");
});
```

**Error Testing:**
```typescript
Deno.test("invalid input returns a client error", () => {
  // When validation is added to `routes/api/[name].tsx`, assert explicit status codes:
  const response = new Response("Bad Request", { status: 400 });
  assertEquals(response.status, 400);
});
```

---

*Testing analysis: 2026-07-30*
