import { json, publicSignerState } from "../../../runtime/signin_http.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    const identity = await ctx.state.signer.restore();
    const state = publicSignerState(ctx.state.signer.state);
    if (state.status === "idle" && identity?.status === "offline") {
      return json({ status: "offline", pubkey: identity.pubkey });
    }
    return json(state);
  },
});
