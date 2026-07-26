export function calculateTargetHourUTC(localTime: string, timezone: string): number {
  const [hour, minute] = localTime.split(":").map(Number);

  const now = new Date();
  // Treat hour:minute as if it were already UTC, then check what that instant
  // actually reads as in `timezone` to find the correction needed.
  const naiveUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
  );

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(naiveUTC);
  const readHour = Number(parts.find((part) => part.type === "hour")?.value);
  const readMinute = Number(parts.find((part) => part.type === "minute")?.value);

  const targetMinutes = hour * 60 + minute;
  const readMinutes = readHour * 60 + readMinute;
  const correctionMinutes = targetMinutes - readMinutes;

  const targetUTC = new Date(naiveUTC + correctionMinutes * 60000);
  return targetUTC.getUTCHours();
}
