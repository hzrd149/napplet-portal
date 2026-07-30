# Coding Conventions

**Analysis Date:** 2026-07-30

## Naming Patterns

**Files:**
- Use Fresh/Deno route names in `routes/`: page routes use lowercase route files such as `routes/index.tsx`, API route parameters use bracket notation such as `routes/api/[name].tsx`, and app shell files use Fresh reserved names such as `routes/_app.tsx`.
- Use PascalCase for reusable UI component files such as `components/Button.tsx` and island component files such as `islands/Counter.tsx`.
- Use lowercase root runtime/config modules such as `main.ts`, `client.ts`, `utils.ts`, and `vite.config.ts`.

**Functions:**
- Use PascalCase function names for Preact components: `Button` in `components/Button.tsx`, `Counter` in `islands/Counter.tsx`, `Home` in `routes/index.tsx`, and `App` in `routes/_app.tsx`.
- Use uppercase HTTP method keys for Fresh handlers: `GET(ctx)` in `routes/api/[name].tsx`.
- Use descriptive camelCase for non-component variables and middleware helpers: `exampleLoggerMiddleware` in `main.ts`.

**Variables:**
- Use camelCase for local variables and signals: `count` in `routes/index.tsx`, `name` in `routes/api/[name].tsx`, and `exampleLoggerMiddleware` in `main.ts`.
- Use short framework-standard names where context is clear: `ctx` for Fresh route/middleware context in `main.ts`, `routes/index.tsx`, and `routes/api/[name].tsx`.

**Types:**
- Use PascalCase for interfaces and state types: `State` in `utils.ts`, `ButtonProps` in `components/Button.tsx`, and `CounterProps` in `islands/Counter.tsx`.
- Export shared public types when used across modules: `State` is exported from `utils.ts` and consumed by `main.ts` through `App<State>()`.
- Keep component-local prop types private unless another file imports them: `CounterProps` in `islands/Counter.tsx` is not exported.

## Code Style

**Formatting:**
- Use Deno formatting via `deno fmt`; the project quality gate is `deno task check` in `deno.json`.
- Use two-space indentation in TypeScript, TSX, JSON, and CSS as shown in `deno.json`, `routes/index.tsx`, and `assets/styles.css`.
- Use double quotes for string literals and import specifiers: `import { App, staticFiles } from "fresh";` in `main.ts` and `import { Button } from "../components/Button.tsx";` in `islands/Counter.tsx`.
- Preserve trailing commas in multiline calls and arrays as produced by Deno fmt, for example the multiline `new Response(...)` calls in `main.ts` and `routes/api/[name].tsx`, and array values in `deno.json`.
- Use Preact/Fresh JSX `class` attributes rather than React `className`: `routes/index.tsx`, `components/Button.tsx`, and `islands/Counter.tsx` all use `class`.

**Linting:**
- Use Deno lint through `deno task check`; `deno.json` enables the `fresh` and `recommended` lint rule tags.
- Run `deno check` through `deno task check` for type checking; no separate `tsconfig.json` exists.
- Keep generated `_fresh/` files out of lint/check scope; `deno.json` excludes `**/_fresh/*`.

## Import Organization

**Order:**
1. External/runtime imports first: `fresh`, `fresh/runtime`, `preact`, `@preact/signals`, `vite`, and Fresh/Vite plugins in `main.ts`, `routes/index.tsx`, and `vite.config.ts`.
2. Type-only imports use `import type` when no runtime value is needed: `ComponentChildren` in `components/Button.tsx` and `Signal` in `islands/Counter.tsx`.
3. Local relative imports follow external imports: `../utils.ts` and `../islands/Counter.tsx` in `routes/index.tsx`, `../../utils.ts` in `routes/api/[name].tsx`, and `../components/Button.tsx` in `islands/Counter.tsx`.

**Path Aliases:**
- `deno.json` defines the alias `@/` mapped to `./`, but the current source files use relative imports such as `../utils.ts` and `../../utils.ts`.
- When adding code, prefer existing relative import style unless a module is deeply nested enough that `@/` improves clarity.
- Include explicit `.ts` and `.tsx` extensions in local imports, matching `main.ts`, `routes/index.tsx`, and `islands/Counter.tsx`.

## Error Handling

**Patterns:**
- Route handlers return Web `Response` objects directly for successful API responses, as in `routes/api/[name].tsx` and the `/api2/:name` handler in `main.ts`.
- Current application code has no `try`/`catch`, `throw`, or custom error classes in first-party TypeScript/TSX files; unhandled errors are left to Fresh/Deno runtime behavior.
- Use Fresh handler functions (`define.handlers`) for route-level request handling so future errors can be localized in files like `routes/api/[name].tsx`.
- When adding user-input parsing or external calls, validate inputs before constructing a `Response` and return explicit HTTP status codes from the route file that owns the endpoint.

## Logging

**Framework:** console

**Patterns:**
- Use `console.log` for development-only diagnostics and request logging: `main.ts` logs `${ctx.req.method} ${ctx.req.url}` in middleware, and `routes/index.tsx` logs `ctx.state.shared`.
- Avoid logging secrets or request bodies; `.gitignore` shows `.env*` files are treated as environment configuration and should remain unquoted.
- Prefer route/middleware-local logging near the behavior being observed, such as the middleware defined in `main.ts`.

## Comments

**When to Comment:**
- Use comments to explain framework wiring and shared state, as in `utils.ts` where `State` documents `ctx.state`, and `main.ts` where middleware and filesystem routing are called out.
- Remove scaffold comments when replacing example code; `main.ts` contains Fresh starter comments for `/api2/:name` and `exampleLoggerMiddleware`.
- Do not comment obvious JSX; component structure in `components/Button.tsx`, `islands/Counter.tsx`, and `routes/index.tsx` is self-explanatory.

**JSDoc/TSDoc:**
- Not used in current first-party source files.
- Prefer concise interface names and inline TypeScript types over JSDoc for simple props and state, following `components/Button.tsx` and `utils.ts`.

## Function Design

**Size:** Keep functions small and focused. Current functions fit in a single short block: `Button` in `components/Button.tsx`, `Counter` in `islands/Counter.tsx`, `GET` in `routes/api/[name].tsx`, and middleware in `main.ts`.

**Parameters:** Accept framework/context or props objects directly. Components receive `props` (`components/Button.tsx`, `islands/Counter.tsx`); routes and middleware receive `ctx` (`main.ts`, `routes/index.tsx`, `routes/api/[name].tsx`).

**Return Values:** Return JSX from page/component functions and `Response` objects from API handlers. Middleware returns `ctx.next()` or `await ctx.next()` as in `main.ts`.

## Module Design

**Exports:**
- Use default exports for route pages and island components: `routes/index.tsx`, `routes/_app.tsx`, and `islands/Counter.tsx`.
- Use named exports for reusable components and route handlers: `Button` in `components/Button.tsx`, `handler` in `routes/api/[name].tsx`, and `app` in `main.ts`.
- Export shared framework helpers from `utils.ts`: `State` and `define`.

**Barrel Files:**
- No barrel files are present. Import directly from implementation files such as `../components/Button.tsx` and `../utils.ts`.

---

*Convention analysis: 2026-07-30*
