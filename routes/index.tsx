import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import NappletShell from "../islands/NappletShell.tsx";

export default define.page(function Home() {
  return (
    <>
      <Head>
        <title>Napplet Portal</title>
        <meta name="theme-color" content="#020617" />
      </Head>
      <NappletShell coordinate="naddr1qvzqqqyf8ypzpem34u9stj8ftlxldl4n2qz5f5hmrnxns3uga86fpwe7u28ga4n0qqx8xetrw4exjare94kxzcsuktmwx" />
    </>
  );
});
