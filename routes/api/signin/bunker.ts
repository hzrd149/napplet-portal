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
      if (typeof body.uri !== "string" || !body.uri.startsWith("bunker://")) {
        return json({ status: "error", message: "Invalid bunker URI" }, {
          status: 400,
        });
      }
      const identity = await ctx.state.signer.signInBunker(body.uri);
      return json(publicIdentity(identity));
    } catch (error) {
      return json({
        status: "error",
        message: error instanceof Error
          ? error.message
          : "Bunker sign-in failed",
      }, { status: 400 });
    }
  },
});
