/** "2025-09-28T00:00:00.000Z" -> "2025-09-28" (dates are stored as ISO strings). */
export function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : "";
}

/** "2025-09-28..." -> "2025-09" (archive grouping). */
export function formatYearMonth(iso: string): string {
  return iso ? iso.slice(0, 7) : "";
}

export function formatYear(iso: string): string {
  return iso ? iso.slice(0, 4) : "";
}
