import { DayLog, WeekStats, LeaveType, DaySuggestions, SuggestionResult, UserSettings } from '../types';
import { 
  DAILY_TARGET_HOURS, 
  WEEKLY_TARGET_HOURS, 
  HALF_DAY_DEDUCTION, 
  FULL_DAY_DEDUCTION 
} from '../constants';

// Convert HH:MM string to minutes from midnight
export const timeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Convert minutes from midnight to HH:MM string
export const minutesToTime = (totalMinutes: number): string => {
  let mins = Math.max(0, totalMinutes);
  if (mins >= 24 * 60) mins = 23 * 60 + 59; // Cap at 23:59
  const hours = Math.floor(mins / 60);
  const minutes = Math.floor(mins % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

// Add minutes to a time string
export const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
  if (!timeStr) return "00:00";
  const startMins = timeToMinutes(timeStr);
  return minutesToTime(startMins + minutesToAdd);
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

export const distributeDeficit = (days: DayLog[], settings: UserSettings): DayLog[] => {
  const newDays = [...days];
  const stats = calculateWeekStats(newDays); 
  
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

  const maxOutMinutes = settings.enableMaxTime 
    ? timeToMinutes(settings.maxOutTime) 
    : 24 * 60 - 1; // 23:59 if no restriction

  adjustableIndices.forEach(index => {
    const day = newDays[index];
    const startStr = day.punchIn || settings.standardInTime; // Use settings default
    const startMins = timeToMinutes(startStr);
    const durationMinutes = hoursPerDay * 60;
    const endMins = startMins + durationMinutes;

    // Apply Hard Constraint based on settings
    const cappedEndMins = Math.min(endMins, maxOutMinutes);
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
export const calculateOutTime = (punchIn: string, targetHours: number, settings: UserSettings): SuggestionResult => {
  const startMins = timeToMinutes(punchIn);
  const targetDurationMins = targetHours * 60;
  const suggestedOutMins = startMins + targetDurationMins;

  // Determine Limit
  const maxLimitMins = settings.enableMaxTime 
    ? timeToMinutes(settings.maxOutTime) 
    : 24 * 60 - 1;

  // Check if target fits within limits
  if (suggestedOutMins <= maxLimitMins) {
    return {
      time: minutesToTime(suggestedOutMins),
      status: 'ok',
      msg: 'Target Met'
    };
  }

  // --- CONSTRAINT HIT: CALCULATE LEAVE SUGGESTION ---
  
  // How much can we actually work today?
  const maxPossibleMins = Math.max(0, maxLimitMins - startMins);
  
  // Deficit in hours
  const deficitHours = (targetDurationMins - maxPossibleMins) / 60;
  
  // Calculate Half-Day credits needed (4.75h each)
  const halfDaysNeeded = Math.ceil(deficitHours / HALF_DAY_DEDUCTION);
  
  if (halfDaysNeeded > 0) {
     // Recalculate punch out time assuming user takes those leaves (reduces target)
     const creditHours = halfDaysNeeded * HALF_DAY_DEDUCTION;
     const newTargetHours = Math.max(0, targetHours - creditHours);
     const newTargetMins = newTargetHours * 60;
     const newOutMins = startMins + newTargetMins;
     
     return {
       time: minutesToTime(newOutMins),
       status: 'suggestion',
       msg: `Add ${halfDaysNeeded} Half-Day${halfDaysNeeded > 1 ? 's' : ''}`
     };
  }

  return {
    time: minutesToTime(maxLimitMins),
    status: 'impossible',
    msg: `Cap reached. Deficit: ${decimalToDuration(deficitHours)}`
  };
};

export const getSmartSuggestions = (
  day: DayLog, 
  allDays: DayLog[],
  settings: UserSettings
): DaySuggestions => {
  const emptyResult: SuggestionResult = { time: '', status: 'none', msg: '' };
  
  if (!day.punchIn || day.punchOut || day.leaveType === 'FULL') {
    return { standard: emptyResult, adjusted: emptyResult };
  }

  // 1. Calculate Standard (STD)
  const standardTarget = getDailyExpectation(day.leaveType);
  const standardSuggestion = calculateOutTime(day.punchIn, standardTarget, settings);

  // 2. Calculate Adjusted (ADJ)
  const stats = calculateWeekStats(allDays);
  
  const otherDaysWorked = allDays.reduce((acc, d) => d.id !== day.id ? acc + d.grossHours : acc, 0);
  const remainingNeededGlobal = Math.max(0, stats.requiredTotal - otherDaysWorked);

  const availableDaysCount = allDays.filter(d => 
    d.leaveType !== 'FULL' && 
    !d.punchOut && 
    (d.id === day.id || d.status === 'FUTURE')
  ).length;

  const adjustedTarget = remainingNeededGlobal / Math.max(1, availableDaysCount);
  const adjustedSuggestion = calculateOutTime(day.punchIn, adjustedTarget, settings);

  return {
    standard: standardSuggestion,
    adjusted: adjustedSuggestion
  };
};