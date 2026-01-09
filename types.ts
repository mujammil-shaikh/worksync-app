export interface TimeEntry {
  hours: number;
  minutes: number;
}

export enum DayStatus {
  Future = 'FUTURE',
  Present = 'PRESENT',
  Past = 'PAST',
  Leave = 'LEAVE',
  Weekend = 'WEEKEND'
}

export type LeaveType = 'NONE' | 'HALF' | 'FULL';

export interface UserSettings {
  standardInTime: string;      // Default: "10:30"
  maxOutTime: string;          // Default: "20:31"
  enableMaxTime: boolean;      // Default: true
  lateBufferMinutes: number;   // Default: 30
}

export interface DayLog {
  id: string; // 'mon', 'tue', etc.
  label: string;
  dateStr: string;
  isToday: boolean;
  punchIn: string; // HH:MM format
  punchOut: string; // HH:MM format
  grossHours: number; // in decimal hours
  deficit: number; // relative to daily expectation
  note: string;
  status: DayStatus;
  leaveType: LeaveType;
}

export interface WeekStats {
  totalWorked: number;
  requiredTotal: number;
  originalTarget: number;
  totalLeaveDeduction: number;
  remainingWeekly: number;
  weeklyDeficit: number;
  projectedTotal: number;
  isOnTrack: boolean;
}

export interface SuggestionResult {
  time: string;
  status: 'ok' | 'late' | 'impossible' | 'none' | 'suggestion';
  msg: string;
}

export interface DaySuggestions {
  standard: SuggestionResult;
  adjusted: SuggestionResult;
}