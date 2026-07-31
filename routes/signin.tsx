import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import SignInFlow from "../islands/SignInFlow.tsx";

export default define.page(function SignIn() {
  return (
    <>
      <Head>
        <title>Sign in - Napplet Portal</title>
      </Head>
      <SignInFlow />
    </>
  );
});
