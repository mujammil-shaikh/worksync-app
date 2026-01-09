export const DAILY_TARGET_HOURS = 9.5;
export const WEEKLY_TARGET_HOURS = 47.5;
export const HALF_DAY_DEDUCTION = 4.75;
export const FULL_DAY_DEDUCTION = 9.5;

export const MAX_PUNCH_OUT_TIME = "20:31"; // 8:31 PM
export const LATE_THRESHOLD = "11:00";
export const EARLIEST_PUNCH_IN = "10:00";

// Helper to get minutes from midnight for constants
export const MAX_PUNCH_OUT_MINUTES = 20 * 60 + 31; // 1231 minutes

export const WEEK_DAYS = [
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
  { id: 'fri', label: 'Friday' }
];