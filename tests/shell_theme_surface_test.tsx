import { assert, assertGreaterOrEqual } from "jsr:@std/assert@1.0.16";

const styles = await Deno.readTextFile("assets/styles.css");

function token(theme: "light" | "dark", name: string): string {
  const selector = theme === "light" ? ":root" : 'html[data-theme="dark"]';
  const start = styles.indexOf(selector);
  assert(start >= 0, `${selector} token block must exist`);
  const block = styles.slice(start, styles.indexOf("}", start));
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  assert(match, `${theme} must define --${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
  ).map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] +
    0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)]
    .sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function assertTokenized(selectors: readonly string[]): void {
  for (const selector of selectors) {
    const start = styles.indexOf(selector);
    assert(start >= 0, `${selector} must be styled`);
    const block = styles.slice(start, styles.indexOf("}", start));
    assert(
      block.includes("var(--"),
      `${selector} must consume semantic tokens`,
    );
    assert(
      !/#[0-9a-fA-F]{3,8}|rgb\(/.test(block),
      `${selector} has a fixed color`,
    );
  }
}

Deno.test("ink bone and electric amber tokens meet shell contrast thresholds", () => {
  for (const theme of ["light", "dark"] as const) {
    const background = token(theme, "shell-bg");
    const surface = token(theme, "shell-surface");
    for (
      const foreground of ["shell-text", "shell-muted", "shell-error-text"]
    ) {
      assertGreaterOrEqual(
        contrast(token(theme, foreground), surface),
        4.5,
        `${theme} ${foreground} normal text contrast`,
      );
    }
    assertGreaterOrEqual(
      contrast(token(theme, "shell-border-strong"), background),
      3,
      `${theme} strong border UI contrast`,
    );
    assertGreaterOrEqual(
      contrast(token(theme, "shell-accent"), background),
      3,
      `${theme} electric amber UI contrast`,
    );
    assertGreaterOrEqual(
      contrast(token(theme, "shell-accent-ink"), token(theme, "shell-accent")),
      4.5,
      `${theme} accent button text contrast`,
    );
  }
});

Deno.test("reusable home and account surfaces consume semantic tokens", () => {
  assertTokenized([
    ".portal-view",
    ".catalog-card",
    ".catalog-status",
    ".catalog-dialog",
    ".home-identity-target",
    ".account-sheet-backdrop",
    ".account-sheet",
    ".signout-toast",
  ]);
  assert(
    styles.includes('data-status="offline"'),
    "signer status keeps text semantics",
  );
  assert(
    styles.includes("text-decoration: underline"),
    "offline state keeps a non-color cue",
  );
  assert(
    !/transition:\s*(?:all|[^;]*(?:color|background|border))/.test(styles),
  );
});
