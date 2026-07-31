import { define } from "../../utils.ts";

export default define.page(function ReservedIntent() {
  return (
    <main aria-live="polite">
      <p>Preparing verified napplet…</p>
      <script src="/intent-reserved.js" />
    </main>
  );
});
