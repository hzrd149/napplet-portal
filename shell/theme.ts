export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "napplet-portal.theme";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
export const LIGHT_THEME_COLOR = "#F8FAFC";
export const DARK_THEME_COLOR = "#111318";

interface ThemeStorageReader {
  getItem(key: string): string | null;
}

interface ThemeStorageWriter {
  setItem(key: string, value: string): void;
}

interface ThemeRoot {
  readonly style: { colorScheme: string };
  setAttribute(name: string, value: string): void;
}

interface ThemeColorElement {
  content: string;
}

interface ThemeDocument {
  readonly root: ThemeRoot;
  readonly themeColor: ThemeColorElement | null;
}

interface ThemeMedia {
  matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export function validateThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function readThemePreference(
  storage: ThemeStorageReader | undefined,
): ThemePreference {
  try {
    return validateThemePreference(storage?.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function writeThemePreference(
  storage: ThemeStorageWriter | undefined,
  preference: ThemePreference,
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

export function applyTheme(theme: ResolvedTheme, target: ThemeDocument): void {
  target.root.setAttribute("data-theme", theme);
  target.root.style.colorScheme = theme;
  if (target.themeColor) {
    target.themeColor.content = theme === "dark"
      ? DARK_THEME_COLOR
      : LIGHT_THEME_COLOR;
  }
}

export function applyThemeToDocument(theme: ResolvedTheme): void {
  applyTheme(theme, {
    root: document.documentElement,
    themeColor: document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    ),
  });
}

export function createThemeController(options: {
  initialPreference: ThemePreference;
  storage?: ThemeStorageWriter;
  media: ThemeMedia;
  apply: (theme: ResolvedTheme) => void;
}) {
  let preference = options.initialPreference;
  let listening = false;

  const applyResolved = () => {
    options.apply(resolveTheme(preference, options.media.matches));
  };
  const systemChanged = () => applyResolved();
  const syncListener = () => {
    if (preference === "system" && !listening) {
      options.media.addEventListener("change", systemChanged);
      listening = true;
    } else if (preference !== "system" && listening) {
      options.media.removeEventListener("change", systemChanged);
      listening = false;
    }
  };

  syncListener();
  applyResolved();
  return {
    get preference(): ThemePreference {
      return preference;
    },
    setPreference(next: ThemePreference): void {
      preference = next;
      writeThemePreference(options.storage, next);
      syncListener();
      applyResolved();
    },
    dispose(): void {
      if (listening) {
        options.media.removeEventListener("change", systemChanged);
        listening = false;
      }
    },
  };
}

// Kept byte-stable and self-contained so deployments can authorize its hash or nonce.
export const THEME_BOOTSTRAP_SCRIPT =
  `(function(){var p="system";try{var v=localStorage.getItem("${THEME_STORAGE_KEY}");if(v==="light"||v==="dark"||v==="system")p=v}catch(_){}var t=p==="system"?(matchMedia("${THEME_MEDIA_QUERY}").matches?"dark":"light"):p;var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"${DARK_THEME_COLOR}":"${LIGHT_THEME_COLOR}"})()`;
