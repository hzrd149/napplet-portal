window.opener = null;

const reservationId = location.hash.slice(1);
if (!/^[0-9a-f-]{36}$/.test(reservationId)) {
  document.body.textContent = "Invalid navigation reservation.";
}
