import { define } from "../../utils.ts";
import IntentReservation from "../../islands/IntentReservation.tsx";

export default define.page(function ReservedIntent() {
  return (
    <main aria-live="polite">
      <IntentReservation />
    </main>
  );
});
