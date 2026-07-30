# Technology Stack

**Analysis Date:** 2026-07-30

## Languages

**Primary:**
- TypeScript 6.0.3 - Application source in `main.ts`, `client.ts`, `utils.ts`, `routes/**/*.tsx`, `components/**/*.tsx`, and `islands/**/*.tsx`; runtime TypeScript version reported by `deno --version`.
- TSX / JSX with Preact - UI routes and components in `routes/index.tsx`, `routes/_app.tsx`, `components/Button.tsx`, and `islands/Counter.tsx`.

**Secondary:**
- CSS - Global styles in `assets/styles.css`; Tailwind CSS is imported via `@import "tailwindcss"`.
- JSON - Deno project configuration and dependency map in `deno.json`; dependency lockfile in `deno.lock`.
- Markdown - Project setup documentation in `README.md`.

## Runtime

**Environment:**
- Deno 2.9.4 - Primary runtime and task runner; `deno --version` reports Deno 2.9.4, V8 15.0.245.2-rusty, and TypeScript 6.0.3.
- Browser runtime - Interactive island code in `islands/Counter.tsx` runs client-side through Fresh islands and Preact signals.

**Package Manager:**
- Deno import maps and lockfile - Dependencies are declared in `deno.json` under `imports` and pinned in `deno.lock`.
- Lockfile: present (`deno.lock`)
- Node modules mode: manual (`deno.json` sets `nodeModulesDir` to `manual`), so `node_modules/` exists as a generated dependency directory and is ignored by `.gitignore`.
- No `package.json`, `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock` detected at project root.

## Frameworks

**Core:**
- Fresh 2.3.3 (`jsr:@fresh/core@^2.3.3`) - Server-side web framework imported as `fresh` in `main.ts` and `utils.ts`; file-system routes are registered with `app.fsRoutes()` in `main.ts`.
- Preact 10.29.4 (`npm:preact@^10.29.1`) - JSX rendering library for pages and components; type imports appear in `components/Button.tsx`.
- @preact/signals 2.9.2 (`npm:@preact/signals@^2.9.0`) - Reactive state for islands; `routes/index.tsx` creates a signal with `useSignal(3)` and passes it to `islands/Counter.tsx`.

**Testing:**
- Deno lint/check tooling - `deno.json` defines `deno task check` as `deno fmt --check . && deno lint . && deno check`.
- Test runner: Not detected. No `*.test.*`, `*.spec.*`, `jest.config.*`, or `vitest.config.*` files detected during stack scan.

**Build/Dev:**
- Vite 7.3.6 (`npm:vite@^7.1.3`) - Development server and production builder; tasks in `deno.json` run `vite` and `vite build`.
- @fresh/plugin-vite 1.1.2 (`jsr:@fresh/plugin-vite@^1.1.2`) - Fresh integration for Vite; configured in `vite.config.ts` as `fresh()`.
- Tailwind CSS 4.3.2 (`npm:tailwindcss@^4.1.10`) - Utility-first styling; imported in `assets/styles.css` and used through class attributes in `routes/index.tsx`, `components/Button.tsx`, and `islands/Counter.tsx`.
- @tailwindcss/vite 4.3.2 (`npm:@tailwindcss/vite@^4.1.12`) - Tailwind Vite plugin; configured in `vite.config.ts` as `tailwindcss()`.
- Deno fmt and Deno lint - Formatting and linting are driven by the `check` task in `deno.json`.

## Key Dependencies

**Critical:**
- `fresh` / `jsr:@fresh/core@^2.3.3` - Owns routing, middleware, typed handlers, page definitions, static file serving, and server build output; see `main.ts`, `utils.ts`, and `routes/api/[name].tsx`.
- `@fresh/plugin-vite` / `jsr:@fresh/plugin-vite@^1.1.2` - Connects Fresh to Vite for dev/build; see `vite.config.ts`.
- `preact` / `npm:preact@^10.29.1` - Component model and JSX runtime; see `components/Button.tsx`.
- `@preact/signals` / `npm:@preact/signals@^2.9.0` - Client-side reactive state; see `routes/index.tsx` and `islands/Counter.tsx`.
- `vite` / `npm:vite@^7.1.3` - Dev server and bundler; see `deno.json` tasks `dev` and `build`.
- `tailwindcss` / `npm:tailwindcss@^4.1.10` - Styling system; see `assets/styles.css` and class usage in `routes/index.tsx`.

**Infrastructure:**
- `@tailwindcss/vite` / `npm:@tailwindcss/vite@^4.1.12` - Tailwind processing in Vite; see `vite.config.ts`.
- `@types/babel__core` / `npm:@types/babel__core@^7.20.5` - Type package required by the Fresh/Vite toolchain; declared in `deno.json` imports.
- `deno.lock` - Pins transitive JSR and npm dependencies including Fresh, Vite, Preact, Rollup, esbuild, Babel, and Deno standard modules.

## Configuration

**Environment:**
- Runtime configuration is currently static and code-driven; no `.env` files are present in the project root.
- `.gitignore` lists `.env`, `.env.development.local`, `.env.test.local`, `.env.production.local`, and `.env.local`, so future environment files must remain uncommitted.
- No `Deno.env`, `process.env`, database URL, API key, or service credential usage is detected in first-party source files under `main.ts`, `client.ts`, `utils.ts`, `routes/`, `components/`, or `islands/`.
- Shared per-request state is typed in `utils.ts` with `State { shared: string }` and set by middleware in `main.ts`.

**Build:**
- `deno.json` - Task definitions, lint rules, import map, compiler options, `nodeModulesDir`, and Fresh build exclusion.
- `deno.lock` - Dependency lockfile for Deno, JSR, and npm packages.
- `vite.config.ts` - Vite config using Fresh and Tailwind plugins.
- `assets/styles.css` - Tailwind CSS import and custom `.fresh-gradient` style.
- `.gitignore` - Ignores generated `_fresh/`, `node_modules/`, `vendor/`, and local env files.

## Platform Requirements

**Development:**
- Install Deno; `README.md` directs developers to install Deno and run `deno task dev`.
- Run `deno task dev` from project root to start Vite-backed Fresh development server.
- Run `deno task check` before changes are considered ready; this executes format check, lint, and TypeScript checking.
- Keep `node_modules/` generated locally because `deno.json` uses `nodeModulesDir: "manual"`.

**Production:**
- Build with `deno task build`, which runs `vite build` and produces Fresh build output under `_fresh/`.
- Start with `deno task start`, which runs `deno serve -A _fresh/server.js`.
- Deployment target is any Deno-compatible host capable of serving `_fresh/server.js` with the permissions implied by `-A`; no platform-specific deployment config is detected.

---

*Stack analysis: 2026-07-30*
