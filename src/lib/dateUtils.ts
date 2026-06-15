import { isValid, subHours, format, startOfWeek, endOfWeek, startOfDay } from 'date-fns';

/**
 * Safely parses any date-like value into a valid Date object.
 * Handles ISO strings, numbers, and legacy Firebase-style timestamp objects.
 */
export function safeParseDate(val: unknown): Date {
  if (!val) return new Date();

  let date: Date;

  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'string' || typeof val === 'number') {
    date = new Date(val);
  } else {
    date = new Date(val as string | number);
  }

  if (!isValid(date)) {
    return new Date();
  }

  return date;
}

/**
 * Normalizes a date to the configurable behavioral boundary (default 3 AM).
 */
function getLogicalDate(date: Date, boundaryHour: number = 3): Date {
  return subHours(date, boundaryHour);
}

/**
 * Returns the current behavioral "Today" as a Date object at 00:00:00.
 * If it's 2 AM on May 11th with boundary 3, it returns May 10th 00:00:00.
 */
export function getBehavioralToday(boundaryHour: number = 3): Date {
  const logical = getLogicalDate(new Date(), boundaryHour);
  return startOfDay(logical);
}

export function getLogicalDateStr(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Weekly logic: Week ends on Friday.
 * date-fns startOfWeek(date, { weekStartsOn: 6 }) would be Saturday as start.
 * If week ends on Friday, then Saturday is the first day of the week.
 */
export function getLogicalWeekRange(date: Date = new Date(), boundaryHour: number = 3, firstWeekday: number = 6) {
  const logical = getLogicalDate(date, boundaryHour);
  const start = startOfWeek(logical, { weekStartsOn: firstWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  const end = endOfWeek(logical, { weekStartsOn: firstWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6 });
  return { start, end };
}
