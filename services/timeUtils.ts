import { DayLog, WeekStats, LeaveType, DaySuggestions, SuggestionResult } from '../types';
import { 
  DAILY_TARGET_HOURS, 
  WEEKLY_TARGET_HOURS, 
  HALF_DAY_DEDUCTION, 
  FULL_DAY_DEDUCTION, 
  MAX_PUNCH_OUT_MINUTES 
} from '../constants';

// Convert HH:MM string to minutes from midnight
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Convert minutes from midnight to HH:MM string
export const minutesToTime = (totalMinutes: number): string => {
  if (totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Convert decimal hours to pretty string "9h 30m"
export const decimalToDuration = (decimalHours: number): string => {
  const isNegative = decimalHours < 0;
  const absHours = Math.abs(decimalHours);
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);
  return `${isNegative ? '-' : ''}${h}h ${m}m`;
};

// Calculate duration between two time strings in decimal hours
export const calculateDuration = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  const diff = endMins - startMins;
  return diff > 0 ? Number((diff / 60).toFixed(2)) : 0;
};

export const getDailyExpectation = (leaveType: LeaveType): number => {
  if (leaveType === 'FULL') return 0;
  if (leaveType === 'HALF') return HALF_DAY_DEDUCTION; // 4.75
  return DAILY_TARGET_HOURS; // 9.5
};

export const calculateWeekStats = (days: DayLog[]): WeekStats => {
  let totalWorked = 0;
  let totalLeaveDeduction = 0;
  let projectedTotal = 0;
  
  days.forEach(day => {
    // 1. Calculate actual work done
    totalWorked += day.grossHours;

    // 2. Calculate Leave Deductions (Target Reduction)
    if (day.leaveType === 'FULL') {
      totalLeaveDeduction += FULL_DAY_DEDUCTION;
    } else if (day.leaveType === 'HALF') {
      totalLeaveDeduction += HALF_DAY_DEDUCTION;
    }

    // 3. Projection Logic
    const dailyExpectation = getDailyExpectation(day.leaveType);

    if (day.punchOut) {
      projectedTotal += day.grossHours;
    } else if (day.punchIn) {
      projectedTotal += Math.max(day.grossHours, dailyExpectation);
    } else if (day.status === 'FUTURE' || day.status === 'PRESENT') {
      projectedTotal += dailyExpectation;
    } else {
      projectedTotal += 0;
    }
  });

  const requiredTotal = Math.max(0, WEEKLY_TARGET_HOURS - totalLeaveDeduction);
  const remainingWeekly = Math.max(0, requiredTotal - totalWorked);
  
  let expectedSoFar = 0;
  let workedSoFar = 0;
  
  days.forEach(day => {
    if (day.status === 'PAST' || day.punchOut) {
      expectedSoFar += getDailyExpectation(day.leaveType);
      workedSoFar += day.grossHours;
    }
  });
  const weeklyDeficit = Math.max(0, expectedSoFar - workedSoFar);

  return {
    totalWorked,
    requiredTotal,
    originalTarget: WEEKLY_TARGET_HOURS,
    totalLeaveDeduction,
    remainingWeekly,
    weeklyDeficit,
    projectedTotal,
    isOnTrack: projectedTotal >= requiredTotal - 0.1
  };
};

export const distributeDeficit = (days: DayLog[]): DayLog[] => {
  const newDays = [...days];
  const stats = calculateWeekStats(newDays); 
  
  // Logic to determine if a day is "Locked" (cannot be changed by auto-planner)
  // - PAST days are locked.
  // - PRESENT days with a punchOut are locked (already done).
  // - FULL Leave days are locked (no work needed).
  const isLocked = (day: DayLog) => {
    if (day.leaveType === 'FULL') return true;
    if (day.status === 'PAST') return true;
    if (day.status === 'PRESENT' && day.punchOut) return true;
    return false;
  };

  const adjustableIndices = newDays.map((d, i) => i).filter(i => !isLocked(newDays[i]));

  if (adjustableIndices.length === 0) return newDays;

  // Calculate hours already locked in
  const lockedHours = newDays.reduce((acc, day) => {
    return isLocked(day) ? acc + day.grossHours : acc;
  }, 0);
  
  const neededTotal = Math.max(0, stats.requiredTotal - lockedHours);
  
  // Distribute neededTotal across adjustable days
  const hoursPerDay = neededTotal / adjustableIndices.length;

  adjustableIndices.forEach(index => {
    const day = newDays[index];
    const startStr = day.punchIn || "10:30"; // Default start if missing
    const startMins = timeToMinutes(startStr);
    const durationMinutes = hoursPerDay * 60;
    const endMins = startMins + durationMinutes;

    // Apply Hard Constraint (8:31 PM)
    const cappedEndMins = Math.min(endMins, MAX_PUNCH_OUT_MINUTES);
    const endStr = minutesToTime(cappedEndMins);

    newDays[index] = {
         ...day,
         punchIn: startStr,
         punchOut: endStr,
         grossHours: calculateDuration(startStr, endStr)
    };
  });

  return newDays;
};

// New Helper to calculate suggestion for a single target duration
const calculateOutTime = (punchIn: string, targetHours: number): SuggestionResult => {
  const startMins = timeToMinutes(punchIn);
  const targetDurationMins = targetHours * 60;
  const suggestedOutMins = startMins + targetDurationMins;

  if (suggestedOutMins > MAX_PUNCH_OUT_MINUTES) {
    const maxPossibleMins = MAX_PUNCH_OUT_MINUTES - startMins;
    const deficitHours = (targetDurationMins - maxPossibleMins) / 60;
    return {
      time: minutesToTime(MAX_PUNCH_OUT_MINUTES),
      status: 'impossible',
      msg: `Cap reached. Deficit: ${decimalToDuration(deficitHours)}`
    };
  }

  return {
    time: minutesToTime(suggestedOutMins),
    status: 'ok',
    msg: 'Target Met'
  };
};

export const getSmartSuggestions = (
  day: DayLog, 
  allDays: DayLog[]
): DaySuggestions => {
  const emptyResult: SuggestionResult = { time: '', status: 'none', msg: '' };
  
  if (!day.punchIn || day.punchOut || day.leaveType === 'FULL') {
    return { standard: emptyResult, adjusted: emptyResult };
  }

  // 1. Calculate Standard (STD)
  // Just the daily expectation (9.5 or 4.75)
  const standardTarget = getDailyExpectation(day.leaveType);
  const standardSuggestion = calculateOutTime(day.punchIn, standardTarget);

  // 2. Calculate Adjusted (ADJ)
  // Distribute remaining weekly work across remaining days
  const stats = calculateWeekStats(allDays);
  
  // Hours done by others
  // We need to be careful not to double count the current day if it's somehow in stats?
  // calculateWeekStats uses grossHours. Current day has 0 grossHours if no punchOut.
  // So stats.totalWorked excludes current day's potential work.
  // HOWEVER, we must exclude other days that are locked? No, we take stats.requiredTotal - (everyone else's work).
  
  const otherDaysWorked = allDays.reduce((acc, d) => d.id !== day.id ? acc + d.grossHours : acc, 0);
  const remainingNeededGlobal = Math.max(0, stats.requiredTotal - otherDaysWorked);

  // Remaining active days including this one
  const availableDaysCount = allDays.filter(d => 
    d.leaveType !== 'FULL' && 
    !d.punchOut && 
    (d.id === day.id || d.status === 'FUTURE')
  ).length;

  const adjustedTarget = remainingNeededGlobal / Math.max(1, availableDaysCount);
  const adjustedSuggestion = calculateOutTime(day.punchIn, adjustedTarget);

  return {
    standard: standardSuggestion,
    adjusted: adjustedSuggestion
  };
};