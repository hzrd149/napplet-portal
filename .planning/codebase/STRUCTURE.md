# Codebase Structure

**Analysis Date:** 2026-07-30

## Directory Layout

```
napplet-portal/
├── assets/              # Global CSS and Tailwind import
│   └── styles.css       # Tailwind entry plus `.fresh-gradient`
├── components/          # Reusable presentational Preact components
│   └── Button.tsx       # Shared styled button primitive
├── islands/             # Fresh client-hydrated interactive components
│   └── Counter.tsx      # Signal-powered counter island
├── routes/              # Fresh file-system routes and layouts
│   ├── _app.tsx         # Root HTML shell for page routes
│   ├── index.tsx        # Home page route for `/`
│   └── api/             # API route namespace
│       └── [name].tsx   # Dynamic `GET /api/:name` route
├── static/              # Public static files served at site root
│   ├── favicon.ico      # Browser favicon
│   └── logo.svg         # Fresh logo served as `/logo.svg`
├── .planning/           # GSD planning and codebase mapping artifacts
│   └── codebase/        # Generated codebase reference documents
├── client.ts            # Browser/CSS bundle entry for Vite HMR
├── deno.json            # Deno tasks, lint rules, imports, compiler options
├── deno.lock            # Deno dependency lockfile
├── main.ts              # Fresh app composition root
├── README.md            # Project usage notes
├── utils.ts             # Typed Fresh `define` helper and request state
└── vite.config.ts       # Vite config with Fresh and Tailwind plugins
```

## Directory Purposes

**`routes/`:**
- Purpose: Own URL-addressable application behavior through Fresh file-system routing.
- Contains: Page routes, layout files, and API handlers.
- Key files: `routes/_app.tsx`, `routes/index.tsx`, `routes/api/[name].tsx`.
- Use this directory for new pages and endpoint files. Add page exports with `define.page(...)` and API handlers with `define.handlers(...)`.

**`routes/api/`:**
- Purpose: Namespace HTTP API endpoints under `/api`.
- Contains: Dynamic API route files such as `[name].tsx`.
- Key files: `routes/api/[name].tsx`.
- Use this directory for new API endpoints rather than adding more `app.get(...)` handlers in `main.ts`.

**`islands/`:**
- Purpose: Hold components that require client-side hydration or browser event handling.
- Contains: Interactive Preact components that can use signals and event handlers.
- Key files: `islands/Counter.tsx`.
- Use this directory for components with `onClick`, local signal updates, browser-only APIs, or other interactive client behavior.

**`components/`:**
- Purpose: Hold reusable presentational UI components shared by routes and islands.
- Contains: Stateless or mostly stateless TSX components and their prop types.
- Key files: `components/Button.tsx`.
- Use this directory for reusable UI primitives that do not need to be routes and do not own hydration boundaries.

**`assets/`:**
- Purpose: Hold source assets that are bundled by Vite.
- Contains: CSS imported by `client.ts`.
- Key files: `assets/styles.css`.
- Use this directory for global CSS and bundler-managed assets. Keep Tailwind import in `assets/styles.css`.

**`static/`:**
- Purpose: Hold public files served directly by Fresh static file middleware.
- Contains: Files available from the site root, such as `/logo.svg`.
- Key files: `static/favicon.ico`, `static/logo.svg`.
- Use this directory for files that should be copied/served as-is rather than imported through Vite.

**`.planning/`:**
- Purpose: Hold GSD planning state and generated mapping documents.
- Contains: Codebase documentation under `.planning/codebase/`.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`.
- Do not put runtime application code here.

**`node_modules/`:**
- Purpose: Deno manual node modules cache/vendor directory for npm dependencies.
- Contains: Installed dependency packages managed by Deno.
- Key files: Not applicable for application editing.
- Treat as dependency/vendor content; do not edit first-party behavior here.

## Key File Locations

**Entry Points:**
- `main.ts`: Server application composition root; creates `App<State>`, registers middleware, routes, and `app.fsRoutes()`.
- `client.ts`: Browser/CSS entry; imports `assets/styles.css` for Vite hot module reloading.
- `routes/_app.tsx`: Root HTML wrapper for page routes.
- `routes/index.tsx`: Home route for `/`.
- `routes/api/[name].tsx`: Dynamic API endpoint for `GET /api/:name`.

**Configuration:**
- `deno.json`: Deno tasks (`check`, `dev`, `build`, `start`, `update`), lint configuration, import map, compiler options, and `_fresh` exclusion.
- `vite.config.ts`: Vite plugin registration for Fresh and Tailwind.
- `deno.lock`: Locked Deno/npm dependency resolution.
- `.gitignore`: Ignore rules for repository files.

**Core Logic:**
- `main.ts`: Middleware pipeline, app-level routing, static file serving.
- `utils.ts`: Shared `State` interface and `define` helper.
- `routes/index.tsx`: Page rendering and island composition.
- `routes/api/[name].tsx`: API response construction.
- `islands/Counter.tsx`: Client-side counter interaction.
- `components/Button.tsx`: Shared UI primitive.

**Styling and Assets:**
- `assets/styles.css`: Tailwind import and `.fresh-gradient` CSS class.
- `static/logo.svg`: Public logo referenced as `/logo.svg` from `routes/index.tsx`.
- `static/favicon.ico`: Public favicon.

**Testing:**
- Not detected. No `tests/` directory, `*.test.ts`, `*.spec.ts`, or test-specific config files are present in the mapped first-party structure.

## Naming Conventions

**Files:**
- Route files use Fresh file-system names: `routes/index.tsx` for `/`, `routes/_app.tsx` for app shell, and bracket parameters like `routes/api/[name].tsx` for dynamic segments.
- Island and component files use PascalCase: `islands/Counter.tsx`, `components/Button.tsx`.
- Root infrastructure files use descriptive lower-case names: `main.ts`, `client.ts`, `utils.ts`, `vite.config.ts`, `deno.json`.
- CSS source files use lower-case names: `assets/styles.css`.

**Directories:**
- Fresh conventional directories are plural lower-case: `routes/`, `islands/`, `components/`, `assets/`, `static/`.
- API route namespaces mirror URL path segments: `routes/api/` maps to `/api`.
- Generated or dependency directories should remain segregated: `_fresh/` is generated by build tasks; `node_modules/` is dependency/vendor content.

## Where to Add New Code

**New Page Route:**
- Primary code: `routes/<route>.tsx` or nested `routes/<segment>/index.tsx`.
- Shared layout: add or update route-level wrappers under `routes/` when Fresh layout conventions are needed; root document shell is `routes/_app.tsx`.
- Example to follow: `routes/index.tsx` using `export default define.page(function Home(ctx) { ... })`.

**New API Endpoint:**
- Primary code: `routes/api/<name>.tsx` or dynamic segments such as `routes/api/[id].tsx`.
- Handler pattern: export `handler = define.handlers({ METHOD(ctx) { return new Response(...) } })`.
- Example to follow: `routes/api/[name].tsx`.
- Avoid: adding new endpoint implementation directly in `main.ts` with `app.get(...)` unless the route must be app-level or middleware-like.

**New Interactive Component:**
- Implementation: `islands/<ComponentName>.tsx`.
- Shared UI dependencies: import from `components/` using relative paths such as `../components/Button.tsx`.
- Example to follow: `islands/Counter.tsx` receives typed props and updates a `Signal<number>` from click handlers.

**New Shared Component/Module:**
- Implementation: `components/<ComponentName>.tsx` for reusable TSX UI.
- Export pattern: export prop interfaces and named components like `ButtonProps` and `Button` in `components/Button.tsx`.
- Use islands for browser behavior and components for presentational reuse.

**New Request State:**
- Type definition: add fields to `State` in `utils.ts`.
- Population: set fields in middleware in `main.ts` with `ctx.state.<field> = ...`.
- Consumption: read from route `ctx.state` in files like `routes/index.tsx`.

**New Middleware:**
- Global middleware: add `app.use(...)` in `main.ts` before `app.fsRoutes()`.
- Typed middleware: use `define.middleware(...)` as shown by `exampleLoggerMiddleware` in `main.ts`.
- Keep middleware concerns near app setup, and keep endpoint behavior in `routes/`.

**New Static Asset:**
- Public root-served file: `static/<filename>`; reference as `/<filename>` from TSX, as `routes/index.tsx` does with `/logo.svg`.
- Bundled/global CSS asset: `assets/<filename>` and import from `client.ts` or another bundler entry.

**Utilities:**
- Fresh typed helpers and request-state contracts: `utils.ts`.
- If utility code grows beyond Fresh helper setup, create a focused root-level module or directory (for example, `lib/`) and import it from routes/islands. Keep route files URL-focused.

## Special Directories

**`node_modules/`:**
- Purpose: Dependency/vendor directory created by Deno because `deno.json` sets `nodeModulesDir` to `manual`.
- Generated: Yes.
- Committed: Should not be edited manually; dependency state is represented by `deno.json` and `deno.lock`.

**`_fresh/`:**
- Purpose: Generated Fresh build output used by the production start command `deno serve -A _fresh/server.js` in `deno.json`.
- Generated: Yes.
- Committed: Not applicable in current tree; `deno.json` excludes `**/_fresh/*` from lint/check.

**`.planning/codebase/`:**
- Purpose: Generated GSD architecture and structure reference documents.
- Generated: Yes.
- Committed: Intended as planning/documentation artifacts if repository policy commits `.planning/`.

**`static/`:**
- Purpose: First-party public asset directory served by Fresh `staticFiles()` in `main.ts`.
- Generated: No.
- Committed: Yes, for source-controlled public assets such as `static/logo.svg` and `static/favicon.ico`.

**`assets/`:**
- Purpose: First-party bundler-managed assets such as CSS source.
- Generated: No.
- Committed: Yes, for source-controlled application styling such as `assets/styles.css`.

---

*Structure analysis: 2026-07-30*
