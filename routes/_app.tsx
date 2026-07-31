// deno-lint-ignore-file react-no-danger -- static hashable first-paint script
import { define } from "../utils.ts";
import { LIGHT_THEME_COLOR, THEME_BOOTSTRAP_SCRIPT } from "../shell/theme.ts";

export default define.page(function App({ Component }) {
  return (
    <html data-theme="light" style="color-scheme: light">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content={LIGHT_THEME_COLOR} />
        <meta name="referrer" content="no-referrer" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <title>Napplet Portal</title>
      </head>
      <body class="bg-[#F8FAFC] text-[#0F172A]">
        <Component />
      </body>
    </html>
  );
});
