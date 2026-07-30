import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#F8FAFC" />
        <title>Napplet Portal</title>
      </head>
      <body class="bg-[#F8FAFC] text-[#0F172A]">
        <Component />
      </body>
    </html>
  );
});
