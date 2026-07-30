# Codebase Concerns

**Analysis Date:** 2026-07-30

## Tech Debt

**Fresh starter/demo code remains in production paths:**
- Issue: The app is still the generated Fresh starter with demo routes, demo copy, and a counter island rather than domain-specific portal functionality.
- Files: `README.md`, `routes/index.tsx`, `islands/Counter.tsx`, `components/Button.tsx`, `main.ts`, `routes/api/[name].tsx`
- Impact: Future work starts from scaffold assumptions; demo UI and API paths can be mistaken for supported behavior.
- Fix approach: Replace starter content in `routes/index.tsx`, remove or repurpose `islands/Counter.tsx`, update `README.md`, and delete unused demo endpoints after real portal routes exist.

**Duplicate greeting API implementations:**
- Issue: `main.ts` defines `app.get("/api2/:name")` while `routes/api/[name].tsx` defines a file-system API with the same greeting logic.
- Files: `main.ts`, `routes/api/[name].tsx`
- Impact: Route behavior can diverge if one path changes; users see inconsistent API surface (`/api/:name` and `/api2/:name`).
- Fix approach: Prefer file-system routes under `routes/api/`; remove the inline `app.get("/api2/:name")` block from `main.ts` unless there is a specific need for programmatic route registration.

**Global request middleware carries placeholder state:**
- Issue: `main.ts` sets `ctx.state.shared = "hello"` for every request and `utils.ts` requires `State.shared` as a string.
- Files: `main.ts`, `utils.ts`, `routes/index.tsx`
- Impact: The required state field couples all handlers/pages to demo middleware and does not model real request state such as session, user, or request context.
- Fix approach: Make `State` reflect real cross-cutting request data in `utils.ts`; remove placeholder middleware in `main.ts` or replace it with explicit authenticated/session state when implemented.

**Documentation is scaffold-only:**
- Issue: `README.md` only contains Fresh getting-started text and does not document project purpose, environment assumptions, routes, testing, deployment, or contribution commands beyond `deno task dev`.
- Files: `README.md`, `deno.json`
- Impact: New contributors and automation agents must infer behavior from source files; production setup and verification expectations are unclear.
- Fix approach: Update `README.md` with portal-specific overview, `deno task check`, `deno task build`, `deno task start`, route map, and environment/deployment notes.

## Known Bugs

**Route parameter normalization can return surprising greetings:**
- Symptoms: Empty or unusual path segments are returned directly after only uppercasing the first character; encoded values, punctuation, and very long values are reflected into the response body.
- Files: `main.ts`, `routes/api/[name].tsx`
- Trigger: Request `/api/%20`, `/api/123`, `/api/<very-long-name>`, or equivalent `/api2/:name` values.
- Workaround: Avoid exposing the demo greeting endpoints publicly; validate and bound route parameters before using them in responses.

**Page renders demo counter instead of portal landing content:**
- Symptoms: `/` displays Fresh logo, “Welcome to Fresh”, and an interactive counter.
- Files: `routes/index.tsx`, `islands/Counter.tsx`
- Trigger: Visit the root route `/`.
- Workaround: Treat the current root page as scaffold-only until portal UX is implemented.

## Security Considerations

**Unbounded request logging includes full URLs:**
- Risk: `main.ts` logs `${ctx.req.method} ${ctx.req.url}` for every request, including query strings that may contain tokens, emails, or other sensitive data.
- Files: `main.ts`
- Current mitigation: None detected; logging is direct `console.log` in middleware.
- Recommendations: Log method and pathname only, redact known sensitive query parameters, and gate verbose request logging by environment.

**Dynamic response content is not validated:**
- Risk: `ctx.params.name` is reflected into plain-text responses without length limits or character validation.
- Files: `main.ts`, `routes/api/[name].tsx`
- Current mitigation: The value is returned through `Response` text rather than injected as HTML, which reduces XSS risk for this exact implementation.
- Recommendations: Validate maximum length, allowed characters, and expected parameter shape before generating responses; centralize validation helpers when real API handlers are added.

**Application starts with full permissions:**
- Risk: `deno task start` runs `deno serve -A _fresh/server.js`, granting all Deno permissions to the built server.
- Files: `deno.json`
- Current mitigation: None detected in `deno.json`.
- Recommendations: Replace `-A` with the minimum required permissions after deployment needs are known, such as explicit `--allow-net`, `--allow-read`, and environment access scopes.

**No authentication or authorization layer detected:**
- Risk: Existing route patterns are public by default, and there is no middleware that enforces identity or access control.
- Files: `main.ts`, `utils.ts`, `routes/index.tsx`, `routes/api/[name].tsx`
- Current mitigation: The current app contains only demo functionality.
- Recommendations: Add auth middleware in `main.ts` or route-specific handlers before sensitive portal pages or APIs are introduced; represent user/session state in `utils.ts`.

## Performance Bottlenecks

**Every request executes global demo middleware and logging:**
- Problem: All requests pass through placeholder state assignment and synchronous console logging.
- Files: `main.ts`
- Cause: `app.use()` middleware applies globally before `app.fsRoutes()`.
- Improvement path: Remove placeholder middleware, keep request logging minimal, and avoid logging static asset requests from `staticFiles()` unless needed for diagnostics.

**Client island is unnecessary for static starter content:**
- Problem: `routes/index.tsx` hydrates `islands/Counter.tsx` for a demo counter, adding client-side JavaScript that does not contribute to portal behavior.
- Files: `routes/index.tsx`, `islands/Counter.tsx`, `client.ts`
- Cause: Starter page includes interactive demo state via `useSignal(3)` and a hydrated island.
- Improvement path: Remove `Counter` from `routes/index.tsx` until a real interactive component is needed; keep landing pages server-rendered/static when possible.

**Manual `node_modules` mode can increase repository and environment weight:**
- Problem: `deno.json` uses `"nodeModulesDir": "manual"`, and the workspace contains a populated `node_modules/` tree.
- Files: `deno.json`, `.gitignore`, `deno.lock`
- Cause: npm dependencies are materialized locally for Vite/Tailwind tooling.
- Improvement path: Keep `node_modules/` ignored as configured in `.gitignore`; document setup expectations and avoid scanning or committing generated dependency trees.

## Fragile Areas

**Button prop spreading overrides fixed styling:**
- Files: `components/Button.tsx`, `islands/Counter.tsx`
- Why fragile: `Button` spreads `{...props}` and then sets a fixed `class`, so caller-provided `class` values are discarded while all other props are forwarded. This limits reuse and can surprise future component consumers.
- Safe modification: Define `class`/`className` behavior explicitly in `ButtonProps`, merge caller classes with defaults, and keep event/ARIA props pass-through intentional.
- Test coverage: No tests detected for `components/Button.tsx` or `islands/Counter.tsx`.

**Route behavior exists both in code and filesystem routes:**
- Files: `main.ts`, `routes/api/[name].tsx`
- Why fragile: Fresh supports both programmatic and filesystem routes, and this app uses both for demo endpoints. Future route additions may duplicate behavior or hide precedence assumptions.
- Safe modification: Keep most routes under `routes/`; reserve `main.ts` for app construction, static files, middleware, and intentionally global behavior.
- Test coverage: No route handler tests detected for `routes/api/[name].tsx` or `main.ts`.

**Shared state type is too narrow for real middleware growth:**
- Files: `utils.ts`, `main.ts`, `routes/index.tsx`
- Why fragile: `State.shared` is required and placeholder-specific; adding optional auth/session/request data will require changing global types and all middleware assumptions.
- Safe modification: Replace `shared` with meaningful optional fields, or create separate typed middleware helpers for required state guarantees.
- Test coverage: No middleware/state tests detected.

## Scaling Limits

**No persistent data layer or external service boundaries:**
- Current capacity: Current app serves static/demo page content and simple in-memory request handling only.
- Limit: Portal features requiring user accounts, saved state, background jobs, or external integrations have no established data-access layer.
- Scaling path: Introduce explicit service/data modules before adding complex route handlers; document ownership and keep route files thin.

**No automated regression suite:**
- Current capacity: `deno task check` verifies formatting, linting, and type checking for 9 source/config files.
- Limit: UI behavior, route responses, middleware behavior, and security constraints can regress without tests.
- Scaling path: Add Deno/Fresh route tests and component-level tests as features are added; include them in `deno task check` or a separate `deno task test` command in `deno.json`.

## Dependencies at Risk

**Fresh 2 and Vite integration are central but lightly wrapped:**
- Risk: Application boot, routing, and build behavior depend directly on `fresh`, `@fresh/plugin-vite`, and `vite` imports without project-level abstraction.
- Impact: Framework updates can affect `main.ts`, `vite.config.ts`, filesystem routing under `routes/`, and JSX compilation configured in `deno.json`.
- Migration plan: Keep framework-specific setup isolated in `main.ts`, `vite.config.ts`, and `deno.json`; avoid importing framework primitives deeply into domain code beyond route/page boundaries.

**Tailwind configuration is implicit:**
- Risk: Styling depends on Tailwind 4 via `@tailwindcss/vite` and `@import "tailwindcss"` without a visible project theme/config file.
- Impact: Design tokens, colors, spacing, and responsive rules can become inconsistent as components grow.
- Migration plan: Add a documented styling strategy or Tailwind configuration when custom design tokens appear; keep shared class patterns in reusable components such as `components/Button.tsx`.

## Missing Critical Features

**Portal domain functionality is absent:**
- Problem: No portal-specific routes, data models, forms, authentication, dashboards, or workflows are implemented.
- Blocks: Product validation beyond Fresh scaffold behavior cannot be performed from current source files.

**No project-specific error strategy:**
- Problem: There is no central error handling, typed API error response helper, not-found behavior, or logging policy beyond `console.log`.
- Blocks: Real APIs and pages cannot provide consistent errors or safe production diagnostics.

**No environment/deployment contract:**
- Problem: `.gitignore` anticipates `.env` files, but no `.env.example`, deployment documentation, or explicit production permission set is present.
- Blocks: Reproducible deployment and secret management expectations are undefined.

## Test Coverage Gaps

**All application behavior is untested:**
- What's not tested: Root page rendering, counter island interactions, `Button` rendering, middleware state assignment, and API greeting responses.
- Files: `routes/index.tsx`, `islands/Counter.tsx`, `components/Button.tsx`, `main.ts`, `routes/api/[name].tsx`
- Risk: Scaffold cleanup or feature additions can break routes and components without detection.
- Priority: High

**Security-sensitive request handling has no tests:**
- What's not tested: Query redaction in logs, route parameter validation, response behavior for malformed/long parameters, and permission assumptions around startup.
- Files: `main.ts`, `routes/api/[name].tsx`, `deno.json`
- Risk: Sensitive data could be logged or unsafe request behavior could ship unnoticed.
- Priority: Medium

---

*Concerns audit: 2026-07-30*
