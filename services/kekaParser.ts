import { DayLog } from '../types';
import { calculateDuration } from './timeUtils';

// Helper to normalize time "9:30 AM" -> "09:30"
const normalizeTime = (timeStr: string): string => {
  if (!timeStr) return '';
  const clean = timeStr.toLowerCase().replace(/\s/g, '');
  
  // Handle 12-hour format with AM/PM
  const match12 = clean.match(/(\d{1,2}):(\d{2})(am|pm)/);
  if (match12) {
    let [_, h, m, mer] = match12;
    let hours = parseInt(h, 10);
    if (mer === 'pm' && hours < 12) hours += 12;
    if (mer === 'am' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${m}`;
  }

  // Handle HH:MM:SS or HH:MM
  const match24 = clean.match(/(\d{1,2}):(\d{2})/);
  if (match24) {
    let [_, h, m] = match24;
    return `${h.padStart(2, '0')}:${m}`;
  }

  return '';
};

export const parseKekaText = (rawText: string, currentDays: DayLog[]): DayLog[] => {
  const newDays = [...currentDays];
  const lines = rawText.split(/\n/);

  // Map of common day names to IDs
  const dayMap: Record<string, string> = {
    'mon': 'mon', 'monday': 'mon',
    'tue': 'tue', 'tuesday': 'tue',
    'wed': 'wed', 'wednesday': 'wed',
    'thu': 'thu', 'thursday': 'thu',
    'fri': 'fri', 'friday': 'fri'
  };

  lines.forEach(line => {
    const lowerLine = line.toLowerCase();
    
    // 1. Identify which day this line belongs to
    let foundDayId: string | null = null;
    for (const [key, id] of Object.entries(dayMap)) {
      if (lowerLine.includes(key)) {
        foundDayId = id;
        break;
      }
    }

    if (!foundDayId) return;

    // 2. Find times in the line
    // Regex looks for patterns like: 09:30, 9:30, 09:30:00, 9:30 AM
    const timeRegex = /\b((?:0?[0-9]|1[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?(?:\s?[AaPp][Mm])?)\b/g;
    const times = line.match(timeRegex);

    if (times && times.length >= 1) {
      const dayIndex = newDays.findIndex(d => d.id === foundDayId);
      if (dayIndex === -1) return;

      const currentDay = newDays[dayIndex];
      
      // If user pasted data, we assume the first time found is Punch In
      // If there are 2+ times, the last one is likely Punch Out
      
      const firstTime = normalizeTime(times[0]);
      const lastTime = times.length > 1 ? normalizeTime(times[times.length - 1]) : '';

      // Only update if we found valid times
      if (firstTime) {
        newDays[dayIndex] = {
          ...currentDay,
          punchIn: firstTime,
          // Only set punch out if it's different and seemingly valid
          punchOut: (lastTime && lastTime !== firstTime) ? lastTime : '',
          grossHours: calculateDuration(firstTime, (lastTime && lastTime !== firstTime) ? lastTime : '')
        };
      }
    }
  });

  return newDays;
};