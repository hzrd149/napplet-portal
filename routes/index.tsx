import { Head } from "fresh/runtime";
import { loadRuntimeConfig } from "../runtime/config.ts";
import { define } from "../utils.ts";
import NappletShell from "../islands/NappletShell.tsx";

export default define.page(function Home() {
  const config = loadRuntimeConfig();
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
