import { renderToString } from "npm:preact-render-to-string@^6.6.3";
import { h } from "preact";
import { AccountSheet } from "../components/AccountSheet.tsx";
import {
  applyTheme,
  createThemeController,
  DARK_THEME_COLOR,
  LIGHT_THEME_COLOR,
  readThemePreference,
  resolveTheme,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  validateThemePreference,
} from "../shell/theme.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("theme preference validation and resolution are closed and deterministic", () => {
  for (const value of ["system", "light", "dark"] as const) {
    assert(validateThemePreference(value) === value, `${value} is accepted`);
  }
  for (const value of [null, "", "sepia", "DARK", {}, 1]) {
    assert(validateThemePreference(value) === "system", `${value} is rejected`);
  }
  assert(resolveTheme("light", true) === "light", "light stays light");
  assert(resolveTheme("dark", false) === "dark", "dark stays dark");
  assert(resolveTheme("system", true) === "dark", "system follows dark OS");
  assert(resolveTheme("system", false) === "light", "system follows light OS");
});

Deno.test("storage failures and invalid values safely become System", () => {
  assert(
    readThemePreference(undefined) === "system",
    "missing storage is safe",
  );
  assert(
    readThemePreference({ getItem: () => "sepia" }) === "system",
    "invalid storage is safe",
  );
  assert(
    readThemePreference({
      getItem: () => {
        throw new Error("denied");
      },
    }) === "system",
    "inaccessible storage is safe",
  );
});

Deno.test("theme application uses fixed document values and one global meta owner", () => {
  const attributes: Record<string, string> = {};
  const root = {
    style: { colorScheme: "" },
    setAttribute(name: string, value: string) {
      attributes[name] = value;
    },
  };
  const meta = { content: "" };
  applyTheme("dark", { root, themeColor: meta });
  assert(attributes["data-theme"] === "dark", "fixed theme attribute applied");
  assert(root.style.colorScheme === "dark", "native color scheme applied");
  assert(meta.content === DARK_THEME_COLOR, "dark browser chrome applied");
  applyTheme("light", { root, themeColor: meta });
  assert(
    String(meta.content) === LIGHT_THEME_COLOR,
    "light browser chrome applied",
  );
});

Deno.test("document bootstrap precedes body and owns one stable theme-color", async () => {
  const app = await Deno.readTextFile("routes/_app.tsx");
  assert(
    app.indexOf("THEME_BOOTSTRAP_SCRIPT") < app.indexOf("<body"),
    "bootstrap precedes body",
  );
  assert(
    (app.match(/name="theme-color"/g) ?? []).length === 1,
    "one global theme-color meta exists",
  );
  assert(!app.includes("unsafe-inline"), "theme does not weaken CSP");
  const theme = await Deno.readTextFile("shell/theme.ts");
  for (
    const forbidden of [
      "postMessage",
      "iframe",
      "runtime.forward",
      "NappletFrame",
    ]
  ) {
    assert(!theme.includes(forbidden), `theme excludes ${forbidden}`);
  }
});

Deno.test("theme controller persists choices and observes OS only in System mode", () => {
  const stored: string[] = [];
  const applied: string[] = [];
  let listener: (() => void) | undefined;
  let removed = 0;
  const media = {
    matches: false,
    addEventListener(_type: "change", next: () => void) {
      listener = next;
    },
    removeEventListener(_type: "change", next: () => void) {
      if (listener === next) listener = undefined;
      removed++;
    },
  };
  const controller = createThemeController({
    initialPreference: "system",
    storage: {
      setItem: (key: string, value: string) => stored.push(`${key}:${value}`),
    },
    media,
    apply: (theme: "light" | "dark") => applied.push(theme),
  });
  assert(listener !== undefined, "System installs a media listener");
  media.matches = true;
  media.addEventListener;
  const notify = listener as (() => void) | undefined;
  notify?.();
  assert(applied.at(-1) === "dark", "OS change applies live");
  controller.setPreference("light");
  assert(
    listener === undefined && removed === 1,
    "explicit choice removes listener",
  );
  assert(stored.at(-1) === `${THEME_STORAGE_KEY}:light`, "choice persists");
  assert(applied.at(-1) === "light", "choice applies immediately");
  controller.setPreference("system");
  assert(listener !== undefined, "returning to System replaces listener");
  controller.dispose();
  assert(listener === undefined && removed >= 2, "unmount removes listener");
  assert(
    THEME_MEDIA_QUERY === "(prefers-color-scheme: dark)",
    "one media query is shared",
  );
});

Deno.test("theme controls are accessible and account-independent", async () => {
  const html = renderToString(h(AccountSheet, {
    open: true,
    profile: null,
    backendConnected: false,
    onClose: () => undefined,
    onSignOut: () => undefined,
  }));
  assert(html.includes("Theme"), "theme control is available while signed out");
  for (const choice of ["System", "Light", "Dark"]) {
    assert(html.includes(`>${choice}<`), `${choice} is explicit`);
  }
  assert(
    (html.match(/type="radio"/g) ?? []).length === 3,
    "exactly three radio choices",
  );
  const styles = await Deno.readTextFile("assets/styles.css");
  assert(!styles.includes("transition: color"), "colors do not interpolate");
  assert(
    !styles.includes("transition: background"),
    "backgrounds do not interpolate",
  );
});
