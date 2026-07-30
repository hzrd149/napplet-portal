# External Integrations

**Analysis Date:** 2026-07-30

## APIs & External Services

**Application APIs:**
- Local Fresh API route `/api/:name` - Returns a greeting response from file-system route `routes/api/[name].tsx`.
  - SDK/Client: Native Web `Response`; route handler helper from `utils.ts` via `define.handlers`.
  - Auth: Not applicable.
- Local programmatic API route `/api2/:name` - Returns a greeting response registered directly in `main.ts`.
  - SDK/Client: Fresh `App.get()` and native Web `Response` in `main.ts`.
  - Auth: Not applicable.

**External HTTP Services:**
- Not detected in first-party source. No `fetch(` calls or third-party API clients are present in `main.ts`, `client.ts`, `utils.ts`, `routes/`, `components/`, or `islands/`.
  - SDK/Client: Not detected.
  - Auth: Not detected.

**Package Registries:**
- JSR - Fresh framework packages and Deno standard modules are resolved from JSR through `deno.json` and `deno.lock`.
  - SDK/Client: Deno import map in `deno.json`.
  - Auth: Not detected.
- npm registry - Preact, Vite, Tailwind CSS, and transitive build dependencies (Babel, Rollup, esbuild) are resolved through Deno npm specifiers in `deno.json` and pinned in `deno.lock`.
  - SDK/Client: Deno npm compatibility layer.
  - Auth: Not detected.

**Developer Documentation Links:**
- Fresh documentation - `README.md` links to `https://fresh.deno.dev/docs/getting-started` for setup guidance.
  - SDK/Client: Browser/documentation only.
  - Auth: Not applicable.
- Deno installation documentation - `README.md` links to `https://docs.deno.com/runtime/getting_started/installation`.
  - SDK/Client: Browser/documentation only.
  - Auth: Not applicable.

## Data Storage

**Databases:**
- Not detected.
  - Connection: Not detected; no `DATABASE_URL`, `Deno.env`, SQL client, ORM, or database SDK usage appears in first-party source files.
  - Client: Not detected.

**File Storage:**
- Local static filesystem only.
  - Static files are served by Fresh `staticFiles()` middleware in `main.ts`.
  - Static asset directories include `static/` and `assets/`; `assets/styles.css` is imported by `client.ts` for HMR.
  - Generated build files are expected under `_fresh/` and ignored by `.gitignore`.

**Caching:**
- None detected in application code.
- Fresh/Vite may use generated caches and build output, but there is no application-level Redis, Deno KV, browser storage, or custom cache layer in `main.ts`, `routes/`, `components/`, or `islands/`.

## Authentication & Identity

**Auth Provider:**
- None detected.
  - Implementation: No session, OAuth, JWT, cookie parsing, password, identity provider, or permission middleware is present in first-party source.
  - Current API routes in `routes/api/[name].tsx` and `main.ts` are unauthenticated examples.

**Authorization:**
- Not detected.
  - Middleware in `main.ts` only sets `ctx.state.shared = "hello"` and logs requests; it does not enforce access control.

## Monitoring & Observability

**Error Tracking:**
- None detected.
  - No Sentry, OpenTelemetry SDK setup, Datadog, Honeycomb, Rollbar, or custom error reporter appears in first-party source or project config.
  - `@opentelemetry/api` appears only as a transitive Fresh dependency in `deno.lock`; no application instrumentation is configured.

**Logs:**
- Console logging only.
  - Request logging middleware in `main.ts` logs `${ctx.req.method} ${ctx.req.url}`.
  - `routes/index.tsx` logs `Shared value ` plus `ctx.state.shared` during page rendering.

## CI/CD & Deployment

**Hosting:**
- Deno-compatible hosting is implied by `deno task start` in `deno.json`, which runs `deno serve -A _fresh/server.js`.
- No Deno Deploy, Docker, Fly.io, Vercel, Netlify, Kubernetes, or cloud provider configuration is detected in the project root.

**CI Pipeline:**
- None detected.
  - No `.github/workflows/*` files detected.
  - No other CI config files were detected during the tech scan.

**Build Pipeline:**
- Local build command is `deno task build` from `deno.json`, which runs `vite build`.
- Local validation command is `deno task check` from `deno.json`, which runs `deno fmt --check . && deno lint . && deno check`.

## Environment Configuration

**Required env vars:**
- None detected for the current application.
- No first-party source reads environment variables via `Deno.env` or `process.env`.

**Secrets location:**
- Not configured.
- `.gitignore` reserves `.env`, `.env.development.local`, `.env.test.local`, `.env.production.local`, and `.env.local` for uncommitted environment configuration if secrets are introduced later.
- No `.env*` files are present at the project root during this scan.

**Configuration files:**
- `deno.json` - Import map, tasks, lint rules, compiler options, and node modules mode.
- `deno.lock` - Pinned JSR and npm dependency versions.
- `vite.config.ts` - Fresh and Tailwind Vite plugins.
- `.gitignore` - Secret and generated-file ignore rules.

## Webhooks & Callbacks

**Incoming:**
- None detected for external services.
- Public local routes exist for examples only: `GET /api/:name` in `routes/api/[name].tsx` and `GET /api2/:name` in `main.ts`.

**Outgoing:**
- None detected.
- No webhook client, HTTP callback, queue publisher, email provider, payment provider, or background job integration appears in first-party source.

---

*Integration audit: 2026-07-30*
