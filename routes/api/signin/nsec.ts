import {
  json,
  publicIdentity,
  readJsonObject,
} from "../../../runtime/signin_http.ts";
import { define } from "../../../utils.ts";

export const handler = define.handlers({
  async POST(ctx) {
    try {
      const body = await readJsonObject(ctx.req);
      if (typeof body.nsec !== "string" || body.nsec.length === 0) {
        return json({ status: "error", message: "Invalid private key" }, {
          status: 400,
        });
      }
      const identity = await ctx.state.signer.signInNsec(body.nsec);
      return json(publicIdentity(identity));
    } catch (error) {
      return json({
        status: "error",
        message: error instanceof Error ? error.message : "nsec sign-in failed",
      }, { status: 400 });
    }
  },
});
