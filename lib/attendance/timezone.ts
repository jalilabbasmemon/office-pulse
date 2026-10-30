const DEFAULT_TZ = "Asia/Karachi";

/** Calendar date (YYYY-MM-DD) in the office timezone using server time. */
export function getTodayInTimezone(timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function greetingForNow(timeZone = DEFAULT_TZ): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(new Date())
  );

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

export function computeWorkMinutes(
  checkInIso: string,
  checkOutIso: string
): number {
  const start = new Date(checkInIso).getTime();
  const end = new Date(checkOutIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 60000);
}

export function isLate(
  checkInIso: string,
  shiftStartTime: string,
  graceMinutes: number,
  timeZone = DEFAULT_TZ
): boolean {
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(checkInIso));

  const [hh, mm] = shiftStartTime.split(":").map(Number);
  const shiftStart = new Date(`${datePart}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);

  // Approximate: treat shift start as local wall clock; for MVP compare using UTC offset of Karachi (+05:00)
  const shiftStartMs = Date.parse(
    `${datePart}T${String(hh).padStart(2, "0")}:${String(mm ?? 0).padStart(2, "0")}:00+05:00`
  );
  const checkInMs = new Date(checkInIso).getTime();
  const graceMs = graceMinutes * 60_000;

  void shiftStart;
  return checkInMs > shiftStartMs + graceMs;
}
