<!-- GSD:project-start source:PROJECT.md -->

## Project

**Napplet Portal**

Napplet Portal is a Deno Fresh server-side runtime for napplets. It serves lightweight web pages that primarily mount sandboxed napplet iframes while the backend runtime owns complex Nostr logic, application state, relay/blossom operations, account handling, storage, and NAP API execution.

The immediate goal is the complete Phase 1 MVP: sign in, load one known sandboxed napplet, and prove a backend-proxied stream-oriented runtime seam. The first vertical tracer checkpoint is targeted for one day; completing the full locked Phase 1 scope has no one-day deadline. The project should stay simple and functional first, then expand into the broader backend Nostr runtime and NAP API surface after the vertical slice works.

**Core Value:** A napplet can run in a mobile browser while a server-side Deno runtime handles the heavy Nostr/runtime work.

### Constraints

- **Timeline**: The first vertical tracer checkpoint is targeted for one day; completing the full locked Phase 1 scope has no one-day deadline.
- **Runtime**: Use Deno and Fresh as the server-side web/runtime foundation because the existing project is a Deno Fresh app.
- **Frontend architecture**: Use Fresh routes for server-rendered pages and islands only for browser-side interactivity; avoid moving backend runtime logic into islands.
- **Nostr libraries**: Use Applesauce packages as much as possible for Nostr primitives, networking, relay connections, database integration, event storage, and relay workflows.
- **Local cache backends**: Runtime design must allow local Nostr relay and local Blossom server connections for event/blob/artifact caching.
- **Reactive style**: Applesauce usage should respect RxJS/functional stream patterns. Avoid nested subscriptions and avoid unnecessary `async`/`await` flows that wait for all data to load.
- **Nostr loading model**: Nostr data is a stream, not a finished request. UI should handle partial, empty, stale, and updating states rather than waiting for completeness.
- **Local dependencies**: Use sibling packages `../kehto` and `../napplet` as reference-only contract sources. Production application dependencies and imports must use the pinned npm packages, including `@napplet/core@0.31.0` and `@napplet/nap@0.31.0`, never file, path, or workspace imports from `../napplet`.
- **Sandboxing**: Napplets run in sandboxed iframes, and NAP API access crosses an explicit proxy/message boundary.
- **Mobile web**: The app shell must work acceptably in mobile browsers, especially fullscreen napplet usage.
- **State ownership**: Persistent application state and complex Nostr processing belong to the backend runtime.
- **Existing codebase**: Current Fresh starter files are scaffolding; new work should evolve the structure without preserving starter demo behavior unnecessarily.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 6.0.3 - Application source in `main.ts`, `client.ts`, `utils.ts`, `routes/**/*.tsx`, `components/**/*.tsx`, and `islands/**/*.tsx`; runtime TypeScript version reported by `deno --version`.
- TSX / JSX with Preact - UI routes and components in `routes/index.tsx`, `routes/_app.tsx`, `components/Button.tsx`, and `islands/Counter.tsx`.
- CSS - Global styles in `assets/styles.css`; Tailwind CSS is imported via `@import "tailwindcss"`.
- JSON - Deno project configuration and dependency map in `deno.json`; dependency lockfile in `deno.lock`.
- Markdown - Project setup documentation in `README.md`.

## Runtime

- Deno 2.9.4 - Primary runtime and task runner; `deno --version` reports Deno 2.9.4, V8 15.0.245.2-rusty, and TypeScript 6.0.3.
- Browser runtime - Interactive island code in `islands/Counter.tsx` runs client-side through Fresh islands and Preact signals.
- Deno import maps and lockfile - Dependencies are declared in `deno.json` under `imports` and pinned in `deno.lock`.
- Lockfile: present (`deno.lock`)
- Node modules mode: manual (`deno.json` sets `nodeModulesDir` to `manual`), so `node_modules/` exists as a generated dependency directory and is ignored by `.gitignore`.
- No `package.json`, `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` detected at project root.

## Frameworks

- Fresh 2.3.3 (`jsr:@fresh/core@^2.3.3`) - Server-side web framework imported as `fresh` in `main.ts` and `utils.ts`; file-system routes are registered with `app.fsRoutes()` in `main.ts`.
- Preact 10.29.4 (`npm:preact@^10.29.1`) - JSX rendering library for pages and components; type imports appear in `components/Button.tsx`.
- @preact/signals 2.9.2 (`npm:@preact/signals@^2.9.0`) - Reactive state for islands; `routes/index.tsx` creates a signal with `useSignal(3)` and passes it to `islands/Counter.tsx`.
- Deno lint/check tooling - `deno.json` defines `deno task check` as `deno fmt --check . && deno lint . && deno check`.
- Test runner: Not detected. No `*.test.*`, `*.spec.*`, `jest.config.*`, or `vitest.config.*` files detected during stack scan.
- Vite 7.3.6 (`npm:vite@^7.1.3`) - Development server and production builder; tasks in `deno.json` run `vite` and `vite build`.
- @fresh/plugin-vite 1.1.2 (`jsr:@fresh/plugin-vite@^1.1.2`) - Fresh integration for Vite; configured in `vite.config.ts` as `fresh()`.
- Tailwind CSS 4.3.2 (`npm:tailwindcss@^4.1.10`) - Utility-first styling; imported in `assets/styles.css` and used through class attributes in `routes/index.tsx`, `components/Button.tsx`, and `islands/Counter.tsx`.
- @tailwindcss/vite 4.3.2 (`npm:@tailwindcss/vite@^4.1.12`) - Tailwind Vite plugin; configured in `vite.config.ts` as `tailwindcss()`.
- Deno fmt and Deno lint - Formatting and linting are driven by the `check` task in `deno.json`.

## Key Dependencies

- `fresh` / `jsr:@fresh/core@^2.3.3` - Owns routing, middleware, typed handlers, page definitions, static file serving, and server build output; see `main.ts`, `utils.ts`, and `routes/api/[name].tsx`.
- `@fresh/plugin-vite` / `jsr:@fresh/plugin-vite@^1.1.2` - Connects Fresh to Vite for dev/build; see `vite.config.ts`.
- `preact` / `npm:preact@^10.29.1` - Component model and JSX runtime; see `components/Button.tsx`.
- `@preact/signals` / `npm:@preact/signals@^2.9.0` - Client-side reactive state; see `routes/index.tsx` and `islands/Counter.tsx`.
- `vite` / `npm:vite@^7.1.3` - Dev server and bundler; see `deno.json` tasks `dev` and `build`.
- `tailwindcss` / `npm:tailwindcss@^4.1.10` - Styling system; see `assets/styles.css` and class usage in `routes/index.tsx`.
- `@tailwindcss/vite` / `npm:@tailwindcss/vite@^4.1.12` - Tailwind processing in Vite; see `vite.config.ts`.
- `@types/babel__core` / `npm:@types/babel__core@^7.20.5` - Type package required by the Fresh/Vite toolchain; declared in `deno.json` imports.
- `deno.lock` - Pins transitive JSR and npm dependencies including Fresh, Vite, Preact, Rollup, esbuild, Babel, and Deno standard modules.

## Configuration

- Runtime configuration is currently static and code-driven; no `.env` files are present in the project root.
- `.gitignore` lists `.env`, `.env.development.local`, `.env.test.local`, `.env.production.local`, and `.env.local`, so future environment files must remain uncommitted.
- No `Deno.env`, `process.env`, database URL, API key, or service credential usage is detected in first-party source files under `main.ts`, `client.ts`, `utils.ts`, `routes/`, `components/`, or `islands/`.
- Shared per-request state is typed in `utils.ts` with `State { shared: string }` and set by middleware in `main.ts`.
- `deno.json` - Task definitions, lint rules, import map, compiler options, `nodeModulesDir`, and Fresh build exclusion.
- `deno.lock` - Dependency lockfile for Deno, JSR, and npm packages.
- `vite.config.ts` - Vite config using Fresh and Tailwind plugins.
- `assets/styles.css` - Tailwind CSS import and custom `.fresh-gradient` style.
- `.gitignore` - Ignores generated `_fresh/`, `node_modules/`, `vendor/`, and local env files.

## Platform Requirements

- Install Deno; `README.md` directs developers to install Deno and run `deno task dev`.
- Run `deno task dev` from project root to start Vite-backed Fresh development server.
- Run `deno task check` before changes are considered ready; this executes format check, lint, and TypeScript checking.
- Keep `node_modules/` generated locally because `deno.json` uses `nodeModulesDir: "manual"`.
- Build with `deno task build`, which runs `vite build` and produces Fresh build output under `_fresh/`.
- Start with `deno task start`, which runs `deno serve -A _fresh/server.js`.
- Deployment target is any Deno-compatible host capable of serving `_fresh/server.js` with the permissions implied by `-A`; no platform-specific deployment config is detected.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Use Fresh/Deno route names in `routes/`: page routes use lowercase route files such as `routes/index.tsx`, API route parameters use bracket notation such as `routes/api/[name].tsx`, and app shell files use Fresh reserved names such as `routes/_app.tsx`.
- Use PascalCase for reusable UI component files such as `components/Button.tsx` and island component files such as `islands/Counter.tsx`.
- Use lowercase root runtime/config modules such as `main.ts`, `client.ts`, `utils.ts`, and `vite.config.ts`.
- Use PascalCase function names for Preact components: `Button` in `components/Button.tsx`, `Counter` in `islands/Counter.tsx`, `Home` in `routes/index.tsx`, and `App` in `routes/_app.tsx`.
- Use uppercase HTTP method keys for Fresh handlers: `GET(ctx)` in `routes/api/[name].tsx`.
- Use descriptive camelCase for non-component variables and middleware helpers: `exampleLoggerMiddleware` in `main.ts`.
- Use camelCase for local variables and signals: `count` in `routes/index.tsx`, `name` in `routes/api/[name].tsx`, and `exampleLoggerMiddleware` in `main.ts`.
- Use short framework-standard names where context is clear: `ctx` for Fresh route/middleware context in `main.ts`, `routes/index.tsx`, and `routes/api/[name].tsx`.
- Use PascalCase for interfaces and state types: `State` in `utils.ts`, `ButtonProps` in `components/Button.tsx`, and `CounterProps` in `islands/Counter.tsx`.
- Export shared public types when used across modules: `State` is exported from `utils.ts` and consumed by `main.ts` through `App<State>()`.
- Keep component-local prop types private unless another file imports them: `CounterProps` in `islands/Counter.tsx` is not exported.

## Code Style

- Use Deno formatting via `deno fmt`; the project quality gate is `deno task check` in `deno.json`.
- Use two-space indentation in TypeScript, TSX, JSON, and CSS as shown in `deno.json`, `routes/index.tsx`, and `assets/styles.css`.
- Use double quotes for string literals and import specifiers: `import { App, staticFiles } from "fresh";` in `main.ts` and `import { Button } from "../components/Button.tsx";` in `islands/Counter.tsx`.
- Preserve trailing commas in multiline calls and arrays as produced by Deno fmt, for example the multiline `new Response(...)` calls in `main.ts` and `routes/api/[name].tsx`, and array values in `deno.json`.
- Use Preact/Fresh JSX `class` attributes rather than React `className`: `routes/index.tsx`, `components/Button.tsx`, and `islands/Counter.tsx` all use `class`.
- Use Deno lint through `deno task check`; `deno.json` enables the `fresh` and `recommended` lint rule tags.
- Run `deno check` through `deno task check` for type checking; no separate `tsconfig.json` exists.
- Keep generated `_fresh/` files out of lint/check scope; `deno.json` excludes `**/_fresh/*`.

## Import Organization

- `deno.json` defines the alias `@/` mapped to `./`, but the current source files use relative imports such as `../utils.ts` and `../../utils.ts`.
- When adding code, prefer existing relative import style unless a module is deeply nested enough that `@/` improves clarity.
- Include explicit `.ts` and `.tsx` extensions in local imports, matching `main.ts`, `routes/index.tsx`, and `islands/Counter.tsx`.

## Error Handling

- Route handlers return Web `Response` objects directly for successful API responses, as in `routes/api/[name].tsx` and the `/api2/:name` handler in `main.ts`.
- Current application code has no `try`/`catch`, `throw`, or custom error classes in first-party TypeScript/TSX files; unhandled errors are left to Fresh/Deno runtime behavior.
- Use Fresh handler functions (`define.handlers`) for route-level request handling so future errors can be localized in files like `routes/api/[name].tsx`.
- When adding user-input parsing or external calls, validate inputs before constructing a `Response` and return explicit HTTP status codes from the route file that owns the endpoint.

## Logging

- Use `console.log` for development-only diagnostics and request logging: `main.ts` logs `${ctx.req.method} ${ctx.req.url}` in middleware, and `routes/index.tsx` logs `ctx.state.shared`.
- Avoid logging secrets or request bodies; `.gitignore` shows `.env*` files are treated as environment configuration and should remain unquoted.
- Prefer route/middleware-local logging near the behavior being observed, such as the middleware defined in `main.ts`.

## Comments

- Use comments to explain framework wiring and shared state, as in `utils.ts` where `State` documents `ctx.state`, and `main.ts` where middleware and filesystem routing are called out.
- Remove scaffold comments when replacing example code; `main.ts` contains Fresh starter comments for `/api2/:name` and `exampleLoggerMiddleware`.
- Do not comment obvious JSX; component structure in `components/Button.tsx`, `islands/Counter.tsx`, and `routes/index.tsx` is self-explanatory.
- Not used in current first-party source files.
- Prefer concise interface names and inline TypeScript types over JSDoc for simple props and state, following `components/Button.tsx` and `utils.ts`.

## Function Design

## Module Design

- Use default exports for route pages and island components: `routes/index.tsx`, `routes/_app.tsx`, and `islands/Counter.tsx`.
- Use named exports for reusable components and route handlers: `Button` in `components/Button.tsx`, `handler` in `routes/api/[name].tsx`, and `app` in `main.ts`.
- Export shared framework helpers from `utils.ts`: `State` and `define`.
- No barrel files are present. Import directly from implementation files such as `../components/Button.tsx` and `../utils.ts`.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Fresh application instance | Creates the `App<State>` singleton, registers static file serving, global middleware, programmatic API route, logger middleware, and file-system routes. | `main.ts` |
| Typed Fresh helpers | Defines the shared request `State` interface and exports `define` for typed pages, handlers, and middleware. | `utils.ts` |
| Browser client entry | Imports global CSS so Vite hot module reloading includes stylesheet updates. | `client.ts` |
| Vite/Fresh/Tailwind build config | Registers Fresh and Tailwind Vite plugins. | `vite.config.ts` |
| Root HTML shell | Wraps every page in the shared document structure and metadata. | `routes/_app.tsx` |
| Home page route | Renders the landing page, reads middleware state, creates a signal, and includes the interactive counter island. | `routes/index.tsx` |
| API route | Handles `GET /api/:name` through Fresh file-system routing. | `routes/api/[name].tsx` |
| Interactive island | Runs client-side counter behavior using `@preact/signals` and shared button UI. | `islands/Counter.tsx` |
| Shared button component | Provides reusable styled button markup for islands or pages. | `components/Button.tsx` |
| Global styles | Imports Tailwind and defines the `.fresh-gradient` utility used by the home page. | `assets/styles.css` |

## Pattern Overview

- Use `main.ts` as the server/app composition root: instantiate `new App<State>()`, attach global middleware with `app.use(...)`, register explicit routes with `app.get(...)` when needed, then include `app.fsRoutes()`.
- Use `routes/` for server-rendered pages and route handlers. A route file exports `define.page(...)` for pages or `handler = define.handlers(...)` for APIs.
- Use `islands/` only for browser-hydrated interactivity. Islands can import reusable UI from `components/` and are included from route pages.
- Use `utils.ts` as the shared typing seam between middleware, layouts, and routes. Add fields to `State` before assigning to `ctx.state` in middleware.
- Use Tailwind utility classes inline in TSX and put global CSS imports/utilities in `assets/styles.css` through `client.ts`.

## Layers

- Purpose: Create and configure the Fresh application.
- Location: `main.ts`
- Contains: `App<State>` construction, static file middleware, request middleware, programmatic routes, logger middleware, file-system route registration.
- Depends on: `fresh` and `define`/`State` from `utils.ts`.
- Used by: Fresh/Vite runtime and the production command in `deno.json` (`deno serve -A _fresh/server.js`).
- Purpose: Centralize Fresh `createDefine` setup and typed per-request state.
- Location: `utils.ts`
- Contains: `State` interface and `define` helper.
- Depends on: `createDefine` from `fresh`.
- Used by: `main.ts`, `routes/_app.tsx`, `routes/index.tsx`, and `routes/api/[name].tsx`.
- Purpose: Define server-rendered pages, layouts, and HTTP handlers using Fresh file-system routing.
- Location: `routes/`
- Contains: `_app.tsx` application shell, `index.tsx` home page, `api/[name].tsx` dynamic API handler.
- Depends on: `define` from `utils.ts`, Fresh runtime helpers, Preact Signals, and islands/components as needed.
- Used by: `app.fsRoutes()` in `main.ts`.
- Purpose: Hold client-side interactive Preact components hydrated by Fresh.
- Location: `islands/`
- Contains: Components such as `Counter` that use mutable browser-side state and event handlers.
- Depends on: Preact/Signals and shared components from `components/`.
- Used by: Route pages such as `routes/index.tsx`.
- Purpose: Provide reusable non-route UI components.
- Location: `components/`
- Contains: Stateless UI primitives such as `Button`.
- Depends on: Preact types and CSS class conventions.
- Used by: Islands and route pages.
- Purpose: Provide application styling and public files.
- Location: `assets/`, `static/`, `client.ts`
- Contains: Tailwind import and custom CSS in `assets/styles.css`; public files such as `static/logo.svg` and `static/favicon.ico`; CSS import entry in `client.ts`.
- Depends on: Tailwind Vite plugin from `vite.config.ts`.
- Used by: `staticFiles()` in `main.ts`, Vite dev/build pipeline, and TSX markup referencing `/logo.svg`.

## Data Flow

### Primary Page Request Path

### API Request Path

### Programmatic Route Path

- Request-scoped state lives on `ctx.state` and is typed by `State` in `utils.ts`.
- Shared state is currently a single `shared: string` field populated by middleware in `main.ts`.
- Client-side interactive state uses `@preact/signals`; `routes/index.tsx` creates a `Signal<number>` and passes it to `islands/Counter.tsx`.
- No persistent database, external store, or application-level cache is present in the mapped files.

## Key Abstractions

- Purpose: Represents the configured server application and routing pipeline.
- Examples: `main.ts`
- Pattern: Singleton composition root exported from `main.ts`.
- Purpose: Represents data shared across middleware, layouts, and routes during a request.
- Examples: `utils.ts`, `main.ts`, `routes/index.tsx`
- Pattern: Extend the interface in `utils.ts`, populate from middleware in `main.ts`, consume from `ctx.state` in routes.
- Purpose: Provides typed wrappers for Fresh pages, handlers, and middleware.
- Examples: `utils.ts`, `routes/_app.tsx`, `routes/index.tsx`, `routes/api/[name].tsx`, `main.ts`
- Pattern: Import from `../utils.ts` or `../../utils.ts`; do not call `createDefine` in route files.
- Purpose: Map files under `routes/` to URL paths.
- Examples: `routes/index.tsx`, `routes/api/[name].tsx`, `routes/_app.tsx`
- Pattern: Place route files under `routes/` and rely on `app.fsRoutes()`.
- Purpose: Represent client-hydrated interactive components.
- Examples: `islands/Counter.tsx`
- Pattern: Export a Preact component from `islands/`, pass serializable/signals props from route pages, and keep browser event handlers inside the island.
- Purpose: Reusable presentational TSX outside route ownership.
- Examples: `components/Button.tsx`
- Pattern: Export named components and prop interfaces, then import from islands or pages.

## Entry Points

- Location: `main.ts`
- Triggers: Fresh/Vite runtime during development and generated `_fresh/server.js` during production serve.
- Responsibilities: Register middleware, static files, routes, and file-system routing.
- Location: `client.ts`
- Triggers: Vite client bundle/HMR.
- Responsibilities: Import `assets/styles.css` so global CSS and Tailwind are included.
- Location: `vite.config.ts`
- Triggers: `deno task dev` and `deno task build` from `deno.json`.
- Responsibilities: Enable Fresh and Tailwind Vite plugins.
- Location: `routes/_app.tsx`
- Triggers: Every page render.
- Responsibilities: Render shared document structure and metadata.
- Location: `routes/index.tsx`
- Triggers: Request to `/`.
- Responsibilities: Render page content and include the `Counter` island.
- Location: `routes/api/[name].tsx`
- Triggers: `GET /api/:name`.
- Responsibilities: Return a greeting response for the supplied dynamic route parameter.

## Architectural Constraints

- **Threading:** Deno/Fresh uses an event-loop request model. Application code in `main.ts`, `routes/`, `islands/`, and `components/` does not create worker threads.
- **Global state:** The exported `app` singleton in `main.ts` is the only application-level singleton. Request data should use `ctx.state` rather than mutable module-level variables.
- **Circular imports:** No circular import chain is present in mapped source files. Dependencies flow from routes to islands/components and from app/routes to `utils.ts`.
- **Generated output:** Production serves `_fresh/server.js` via `deno task start` in `deno.json`; `_fresh/` is excluded from lint/check and should be treated as generated output.
- **Path aliases:** `deno.json` defines the `@/` alias to `./`, but current first-party imports use relative paths. Use relative imports consistently unless the codebase adopts `@/` broadly.

## Anti-Patterns

### Adding new file-routed APIs directly in `main.ts`

### Creating untyped route helpers in individual files

### Putting browser event behavior in generic components by default

## Error Handling

- Route handlers return web-standard `Response` objects directly (`routes/api/[name].tsx:6`, `main.ts:17`).
- Middleware awaits or returns `ctx.next()` to delegate downstream handling (`main.ts:11`, `main.ts:25`).
- No explicit validation/error responses exist for dynamic route parameters; new APIs should add validation in `define.handlers` before constructing responses.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
