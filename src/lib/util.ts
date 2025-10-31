export function formatNowStamp() {
  const d = new Date();
  const opts: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", year: "2-digit", hour: "numeric", minute: "2-digit" };
  return new Intl.DateTimeFormat(undefined, opts).format(d);
}
