import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import NappletShell from "../islands/NappletShell.tsx";

export default define.page(function Home(ctx) {
  const config = ctx.state.config;
  return (
    <>
      <Head>
        <title>Napplet Portal</title>
        <meta name="theme-color" content="#F8FAFC" />
      </Head>
      <NappletShell coordinate={config.coordinate} />
    </>
  );
});
