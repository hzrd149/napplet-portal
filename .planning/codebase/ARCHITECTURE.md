<!-- refreshed: 2026-07-30 -->
# Architecture

**Analysis Date:** 2026-07-30

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    Fresh 2 / Vite App                       │
│                 `main.ts`, `vite.config.ts`                 │
├──────────────────┬──────────────────┬───────────────────────┤
│ File routes      │ Interactive UI   │ Shared UI components  │
│ `routes/`        │ `islands/`       │ `components/`         │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │                  │                     │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Typed Fresh define + request state              │
│                       `utils.ts`                             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Static assets, CSS entry, generated Fresh server output       │
│ `static/`, `assets/styles.css`, `_fresh/server.js`            │
└─────────────────────────────────────────────────────────────┘
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

**Overall:** Fresh file-system routed island architecture with a typed request-state helper.

**Key Characteristics:**
- Use `main.ts` as the server/app composition root: instantiate `new App<State>()`, attach global middleware with `app.use(...)`, register explicit routes with `app.get(...)` when needed, then include `app.fsRoutes()`.
- Use `routes/` for server-rendered pages and route handlers. A route file exports `define.page(...)` for pages or `handler = define.handlers(...)` for APIs.
- Use `islands/` only for browser-hydrated interactivity. Islands can import reusable UI from `components/` and are included from route pages.
- Use `utils.ts` as the shared typing seam between middleware, layouts, and routes. Add fields to `State` before assigning to `ctx.state` in middleware.
- Use Tailwind utility classes inline in TSX and put global CSS imports/utilities in `assets/styles.css` through `client.ts`.

## Layers

**Application Composition:**
- Purpose: Create and configure the Fresh application.
- Location: `main.ts`
- Contains: `App<State>` construction, static file middleware, request middleware, programmatic routes, logger middleware, file-system route registration.
- Depends on: `fresh` and `define`/`State` from `utils.ts`.
- Used by: Fresh/Vite runtime and the production command in `deno.json` (`deno serve -A _fresh/server.js`).

**Typed Framework Helpers:**
- Purpose: Centralize Fresh `createDefine` setup and typed per-request state.
- Location: `utils.ts`
- Contains: `State` interface and `define` helper.
- Depends on: `createDefine` from `fresh`.
- Used by: `main.ts`, `routes/_app.tsx`, `routes/index.tsx`, and `routes/api/[name].tsx`.

**Routes:**
- Purpose: Define server-rendered pages, layouts, and HTTP handlers using Fresh file-system routing.
- Location: `routes/`
- Contains: `_app.tsx` application shell, `index.tsx` home page, `api/[name].tsx` dynamic API handler.
- Depends on: `define` from `utils.ts`, Fresh runtime helpers, Preact Signals, and islands/components as needed.
- Used by: `app.fsRoutes()` in `main.ts`.

**Islands:**
- Purpose: Hold client-side interactive Preact components hydrated by Fresh.
- Location: `islands/`
- Contains: Components such as `Counter` that use mutable browser-side state and event handlers.
- Depends on: Preact/Signals and shared components from `components/`.
- Used by: Route pages such as `routes/index.tsx`.

**Shared Components:**
- Purpose: Provide reusable non-route UI components.
- Location: `components/`
- Contains: Stateless UI primitives such as `Button`.
- Depends on: Preact types and CSS class conventions.
- Used by: Islands and route pages.

**Assets and Static Files:**
- Purpose: Provide application styling and public files.
- Location: `assets/`, `static/`, `client.ts`
- Contains: Tailwind import and custom CSS in `assets/styles.css`; public files such as `static/logo.svg` and `static/favicon.ico`; CSS import entry in `client.ts`.
- Depends on: Tailwind Vite plugin from `vite.config.ts`.
- Used by: `staticFiles()` in `main.ts`, Vite dev/build pipeline, and TSX markup referencing `/logo.svg`.

## Data Flow

### Primary Page Request Path

1. The Fresh app instance is created as `export const app = new App<State>()` (`main.ts:4`).
2. Static asset requests are handled first by `app.use(staticFiles())` (`main.ts:6`).
3. Global middleware writes `ctx.state.shared = "hello"` and continues with `ctx.next()` (`main.ts:9`).
4. Logger middleware records the HTTP method and URL before continuing (`main.ts:23`).
5. File-system routing is enabled with `app.fsRoutes()` (`main.ts:30`).
6. `routes/_app.tsx` renders the root `<html>`, `<head>`, and `<body>` wrapper (`routes/_app.tsx:3`).
7. `routes/index.tsx` renders `Home`, reads `ctx.state.shared`, creates `const count = useSignal(3)`, and renders `<Counter count={count} />` (`routes/index.tsx:6`).
8. `islands/Counter.tsx` hydrates client-side controls and updates `props.count.value` on click (`islands/Counter.tsx:8`).
9. `components/Button.tsx` renders the styled button primitive used by the island (`components/Button.tsx:10`).

### API Request Path

1. File-system routing maps `GET /api/:name` to `routes/api/[name].tsx` (`main.ts:30`).
2. The handler is declared with `define.handlers({ GET(ctx) { ... } })` (`routes/api/[name].tsx:3`).
3. The dynamic path segment is read from `ctx.params.name` (`routes/api/[name].tsx:5`).
4. The handler returns a plain `Response` with a formatted greeting (`routes/api/[name].tsx:6`).

### Programmatic Route Path

1. `main.ts` registers `app.get("/api2/:name", ...)` directly on the app (`main.ts:15`).
2. The route reads `ctx.params.name` and returns a greeting `Response` (`main.ts:16`).
3. Prefer file-system routes in `routes/` for new endpoints because `main.ts` comments identify this as equivalent to a file route (`main.ts:14`).

**State Management:**
- Request-scoped state lives on `ctx.state` and is typed by `State` in `utils.ts`.
- Shared state is currently a single `shared: string` field populated by middleware in `main.ts`.
- Client-side interactive state uses `@preact/signals`; `routes/index.tsx` creates a `Signal<number>` and passes it to `islands/Counter.tsx`.
- No persistent database, external store, or application-level cache is present in the mapped files.

## Key Abstractions

**`App<State>` Fresh application:**
- Purpose: Represents the configured server application and routing pipeline.
- Examples: `main.ts`
- Pattern: Singleton composition root exported from `main.ts`.

**`State` interface:**
- Purpose: Represents data shared across middleware, layouts, and routes during a request.
- Examples: `utils.ts`, `main.ts`, `routes/index.tsx`
- Pattern: Extend the interface in `utils.ts`, populate from middleware in `main.ts`, consume from `ctx.state` in routes.

**`define` helper:**
- Purpose: Provides typed wrappers for Fresh pages, handlers, and middleware.
- Examples: `utils.ts`, `routes/_app.tsx`, `routes/index.tsx`, `routes/api/[name].tsx`, `main.ts`
- Pattern: Import from `../utils.ts` or `../../utils.ts`; do not call `createDefine` in route files.

**File-system routes:**
- Purpose: Map files under `routes/` to URL paths.
- Examples: `routes/index.tsx`, `routes/api/[name].tsx`, `routes/_app.tsx`
- Pattern: Place route files under `routes/` and rely on `app.fsRoutes()`.

**Islands:**
- Purpose: Represent client-hydrated interactive components.
- Examples: `islands/Counter.tsx`
- Pattern: Export a Preact component from `islands/`, pass serializable/signals props from route pages, and keep browser event handlers inside the island.

**Shared components:**
- Purpose: Reusable presentational TSX outside route ownership.
- Examples: `components/Button.tsx`
- Pattern: Export named components and prop interfaces, then import from islands or pages.

## Entry Points

**Server/application entry:**
- Location: `main.ts`
- Triggers: Fresh/Vite runtime during development and generated `_fresh/server.js` during production serve.
- Responsibilities: Register middleware, static files, routes, and file-system routing.

**Browser/CSS entry:**
- Location: `client.ts`
- Triggers: Vite client bundle/HMR.
- Responsibilities: Import `assets/styles.css` so global CSS and Tailwind are included.

**Build configuration entry:**
- Location: `vite.config.ts`
- Triggers: `deno task dev` and `deno task build` from `deno.json`.
- Responsibilities: Enable Fresh and Tailwind Vite plugins.

**Root page layout:**
- Location: `routes/_app.tsx`
- Triggers: Every page render.
- Responsibilities: Render shared document structure and metadata.

**Home route:**
- Location: `routes/index.tsx`
- Triggers: Request to `/`.
- Responsibilities: Render page content and include the `Counter` island.

**API route:**
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

**What happens:** Programmatic route registration such as `app.get("/api2/:name", ...)` lives in `main.ts`.
**Why it's wrong:** It bypasses the file-system route organization used by `routes/api/[name].tsx` and makes `main.ts` mix composition with endpoint implementation.
**Do this instead:** Put new endpoints under `routes/api/` and export `handler = define.handlers(...)` like `routes/api/[name].tsx`.

### Creating untyped route helpers in individual files

**What happens:** Calling `createDefine` outside `utils.ts` would create duplicated route/helper setup.
**Why it's wrong:** It can drift from the shared `State` contract used by `ctx.state.shared` in `main.ts` and `routes/index.tsx`.
**Do this instead:** Import `define` from `utils.ts` (`routes/_app.tsx:1`, `routes/index.tsx:3`, `routes/api/[name].tsx:1`).

### Putting browser event behavior in generic components by default

**What happens:** Event-driven state changes belong to islands, not to reusable server-safe components.
**Why it's wrong:** It blurs Fresh's server-rendered route/component layer and client-hydrated island layer.
**Do this instead:** Keep interactive state and handlers in `islands/Counter.tsx`; keep reusable primitives like `components/Button.tsx` presentational and reusable.

## Error Handling

**Strategy:** Minimal direct `Response` returns; no centralized error handling layer is present.

**Patterns:**
- Route handlers return web-standard `Response` objects directly (`routes/api/[name].tsx:6`, `main.ts:17`).
- Middleware awaits or returns `ctx.next()` to delegate downstream handling (`main.ts:11`, `main.ts:25`).
- No explicit validation/error responses exist for dynamic route parameters; new APIs should add validation in `define.handlers` before constructing responses.

## Cross-Cutting Concerns

**Logging:** Console logging is used in middleware for request method/URL (`main.ts:24`) and in the home route for `ctx.state.shared` (`routes/index.tsx:9`). Keep request logging in middleware rather than page render logic.

**Validation:** Not detected beyond route parameter extraction. Add validation inside route handlers such as `routes/api/[name].tsx` for new inputs.

**Authentication:** Not detected in `main.ts`, `utils.ts`, or `routes/`. Add authentication as middleware in `main.ts` or route-scoped handlers when required, and type any authenticated user context in `State` in `utils.ts`.

---

*Architecture analysis: 2026-07-30*
