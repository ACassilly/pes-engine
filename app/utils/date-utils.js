import { format, parseISO, isValid, differenceInDays, addDays, subDays } from "date-fns";

/**
 * Date/Time Utilities — PES Engine
 * Standardized date formatting and manipulation
 */

const DEFAULT_TIMEZONE = "UTC";

/**
 * Format date for display
 */
export function formatDate(date, formatStr = "yyyy-MM-dd") {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return format(d, formatStr);
}

/**
 * Format datetime for display
 */
export function formatDateTime(date, formatStr = "yyyy-MM-dd HH:mm:ss") {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  return format(d, formatStr);
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date) {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return "—";
  
  const days = differenceInDays(new Date(), d);
  
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Parse date from various formats
 */
export function parseDate(dateString) {
  if (!dateString) return null;
  
  // Try ISO format first
  let d = parseISO(dateString);
  if (isValid(d)) return d;
  
  // Try common formats
  const formats = [
    "MM/dd/yyyy",
    "dd/MM/yyyy",
    "yyyy-MM-dd",
    "MM-dd-yyyy",
    "dd-MM-yyyy",
    "yyyy/MM/dd",
  ];
  
  for (const fmt of formats) {
    try {
      d = parse(dateString, fmt, new Date());
      if (isValid(d)) return d;
    } catch (e) {
      // Continue trying
    }
  }
  
  // Last resort: native Date parsing
  d = new Date(dateString);
  if (isValid(d)) return d;
  
  return null;
}

/**
 * Check if date is within range
 */
export function isDateInRange(date, startDate, endDate) {
  const d = typeof date === "string" ? parseISO(date) : date;
  const start = typeof startDate === "string" ? parseISO(startDate) : startDate;
  const end = typeof endDate === "string" ? parseISO(endDate) : endDate;
  
  if (!isValid(d) || !isValid(start) || !isValid(end)) return false;
  
  return d >= start && d <= end;
}

/**
 * Get date range for common periods
 */
export function getDateRange(period) {
  const now = new Date();
  
  switch (period) {
    case "today":
      return { start: now, end: now };
    case "yesterday":
      return { start: subDays(now, 1), end: subDays(now, 1) };
    case "last_7_days":
      return { start: subDays(now, 7), end: now };
    case "last_30_days":
      return { start: subDays(now, 30), end: now };
    case "last_90_days":
      return { start: subDays(now, 90), end: now };
    case "last_365_days":
      return { start: subDays(now, 365), end: now };
    case "this_month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
    case "last_month":
      return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: new Date(now.getFullYear(), now.getMonth(), 0) };
    case "this_year":
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    case "last_year":
      return { start: new Date(now.getFullYear() - 1, 0, 1), end: new Date(now.getFullYear() - 1, 11, 31) };
    default:
      return { start: subDays(now, 30), end: now };
  }
}

/**
 * Format cron schedule for display
 */
export function formatCronSchedule(cronExpression) {
  if (!cronExpression) return "Not scheduled";
  
  const parts = cronExpression.split(" ");
  if (parts.length !== 5) return cronExpression;
  
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  if (dayOfWeek !== "*" && dayOfMonth === "*") {
    const dayName = days[parseInt(dayOfWeek)] || `Day ${dayOfWeek}`;
    return `${dayName} at ${hour}:${minute.padStart(2, "0")}`;
  }
  
  if (dayOfMonth !== "*" && dayOfWeek === "*") {
    return `Day ${dayOfMonth} of month at ${hour}:${minute.padStart(2, "0")}`;
  }
  
  if (dayOfWeek === "*" && dayOfMonth === "*") {
    return `Daily at ${hour}:${minute.padStart(2, "0")}`;
  }
  
  return cronExpression;
}

/**
 * Check if a date is expired (older than X days)
 */
export function isExpired(date, days = 365) {
  if (!date) return true;
  const d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return true;
  
  const diff = differenceInDays(new Date(), d);
  return diff > days;
}

/**
 * Add business days to a date (excluding weekends)
 */
export function addBusinessDays(date, days) {
  let d = typeof date === "string" ? parseISO(date) : date;
  if (!isValid(d)) return null;
  
  let count = 0;
  while (count < days) {
    d = addDays(d, 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) { // Not Sunday or Saturday
      count++;
    }
  }
  
  return d;
}
