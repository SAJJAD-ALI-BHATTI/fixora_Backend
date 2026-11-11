// Booking/task times are entered in Pakistan Standard Time (UTC+05:00).
// Build the scheduled instant explicitly so expiry checks remain correct even
// when the API host itself runs in UTC.
function scheduledAt(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;
  const datePart = dateValue instanceof Date
    ? dateValue.toISOString().slice(0, 10)
    : String(dateValue).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;

  const raw = String(timeValue).trim();
  let hours, minutes;
  const twelve = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  const twentyFour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twelve) {
    hours = Number(twelve[1]) % 12 + (twelve[3].toUpperCase() === "PM" ? 12 : 0);
    minutes = Number(twelve[2] || 0);
  } else if (twentyFour) {
    hours = Number(twentyFour[1]);
    minutes = Number(twentyFour[2]);
  } else {
    return null;
  }
  if (hours > 23 || minutes > 59) return null;
  const hourText = String(hours).padStart(2, "0");
  const minuteText = String(minutes).padStart(2, "0");
  const result = new Date(`${datePart}T${hourText}:${minuteText}:00+05:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}

function hasPassed(dateValue, timeValue, now = new Date()) {
  const scheduled = scheduledAt(dateValue, timeValue);
  return Boolean(scheduled && scheduled.getTime() < now.getTime());
}

module.exports = { scheduledAt, hasPassed };
