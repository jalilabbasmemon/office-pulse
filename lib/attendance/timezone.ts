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

/** Minutes since midnight in a timezone for an instant. */
export function getMinutesInTimezone(
  date: Date,
  timeZone = DEFAULT_TZ
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  let hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

/** Parse "HH:MM" or "HH:MM:SS" to minutes since midnight. */
export function parseShiftMinutes(time: string): number {
  const [hh, mm] = time.split(":").map(Number);
  return (hh || 0) * 60 + (mm || 0);
}

export function formatShiftClock(time: string): string {
  const [hh, mm] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(hh || 0, mm || 0, 0, 0);
  return new Intl.DateTimeFormat("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** True when check-in is after shift start + grace. */
export function isLate(
  checkInIso: string,
  shiftStartTime: string,
  graceMinutes: number,
  timeZone = DEFAULT_TZ
): boolean {
  const checkInMinutes = getMinutesInTimezone(new Date(checkInIso), timeZone);
  const start = parseShiftMinutes(shiftStartTime);
  return checkInMinutes > start + graceMinutes;
}

/** True when check-out is before shift end. */
export function isEarlyLeave(
  checkOutIso: string,
  shiftEndTime: string,
  timeZone = DEFAULT_TZ
): boolean {
  const checkOutMinutes = getMinutesInTimezone(new Date(checkOutIso), timeZone);
  const end = parseShiftMinutes(shiftEndTime);
  return checkOutMinutes < end;
}

export function minutesUntilShiftEnd(
  shiftEndTime: string,
  timeZone = DEFAULT_TZ,
  now = new Date()
): number {
  const nowMinutes = getMinutesInTimezone(now, timeZone);
  const end = parseShiftMinutes(shiftEndTime);
  return end - nowMinutes;
}
