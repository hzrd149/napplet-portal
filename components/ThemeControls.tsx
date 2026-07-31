import { useEffect, useState } from "preact/hooks";
import {
  applyThemeToDocument,
  createThemeController,
  readThemePreference,
  resolveTheme,
  THEME_MEDIA_QUERY,
  type ThemePreference,
  validateThemePreference,
  writeThemePreference,
} from "../shell/theme.ts";

const CHOICES: readonly { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeControls() {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    typeof localStorage === "undefined"
      ? "system"
      : readThemePreference(localStorage)
  );

  function select(next: unknown): void {
    const validated = validateThemePreference(next);
    const media = matchMedia(THEME_MEDIA_QUERY);
    writeThemePreference(localStorage, validated);
    applyThemeToDocument(resolveTheme(validated, media.matches));
    setPreference(validated);
  }

  useEffect(() => {
    const controller = createThemeController({
      initialPreference: preference,
      storage: localStorage,
      media: matchMedia(THEME_MEDIA_QUERY),
      apply: applyThemeToDocument,
    });
    return () => controller.dispose();
  }, [preference]);

  return (
    <fieldset class="theme-controls">
      <legend>Theme</legend>
      <div class="theme-options">
        {CHOICES.map((choice) => (
          <label>
            <input
              type="radio"
              name="portal-theme"
              value={choice.value}
              checked={preference === choice.value}
              onChange={(event) => select(event.currentTarget.value)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
