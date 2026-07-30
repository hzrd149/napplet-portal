import { json, publicSignerState } from "../../../runtime/signin_http.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  async GET(ctx) {
    await ctx.state.signer.restore();
    return json(publicSignerState(ctx.state.signer.state));
  },
});
