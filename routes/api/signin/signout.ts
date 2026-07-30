import { json } from "../../../runtime/signin_http.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  async POST(ctx) {
    await ctx.state.signer.signOut();
    return json({ status: "unavailable" });
  },
});
