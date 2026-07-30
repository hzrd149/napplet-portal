import { json, publicSignerState } from "../../../runtime/signin_http.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  GET(ctx) {
    return json(publicSignerState(ctx.state.signer.state));
  },
});
