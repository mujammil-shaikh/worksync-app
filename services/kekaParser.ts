import { DayLog, UserSettings } from '../types';
import { calculateDuration, timeToMinutes, minutesToTime } from './timeUtils';

export const parseKekaText = (rawText: string, currentDays: DayLog[], settings: UserSettings): DayLog[] => {
  const newDays = [...currentDays];
  const lines = rawText.split(/\n/);

  // State tracker for parsing
  let currentProcessingDayId: string | null = null;
  
  // Temporary storage to accumulate data per day before finalizing
  const dayData: Record<string, {
      maxMinutes: number;
      arrivalStatus: 'UNKNOWN' | 'ON_TIME' | 'LATE';
      lateMinutes: number;
      leaveTagFound: boolean;
  }> = {};

  // Initialize temp storage for all available days in the dashboard
  currentDays.forEach(day => {
      dayData[day.id] = { maxMinutes: 0, arrivalStatus: 'UNKNOWN', lateMinutes: 0, leaveTagFound: false };
  });

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 1. Detect Date Line with Strict Date Matching
    // Matches: "Mon, 19 Jan", "Thu, 15 JanLeave", "Fri, 16 Jan"
    // Group 1: Day Name (Mon), Group 2: Date (19), Group 3: Month (Jan)
    const dateMatch = trimmed.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(\d{1,2})\s+([A-Za-z]{3})/i);
    
    if (dateMatch) {
        const extractedDate = parseInt(dateMatch[2], 10);
        const extractedMonth = dateMatch[3].toLowerCase();

        // STRICT MATCH: Find the day in our current week that matches this specific date/month
        const matchingDay = currentDays.find(day => {
            // day.dateStr is "MMM dd" (e.g. "Jan 19")
            const [dMonth, dDate] = day.dateStr.split(' ');
            return dMonth.toLowerCase() === extractedMonth && parseInt(dDate, 10) === extractedDate;
        });

        if (matchingDay) {
            currentProcessingDayId = matchingDay.id;
            
            // Check for attached tags in the date line itself (e.g. "JanLeave", "JanHLDY", "JanW-OFF")
            if (trimmed.match(/(Leave|HLDY|W-OFF|Holiday)/i)) {
                dayData[currentProcessingDayId].leaveTagFound = true;
            }
        } else {
            // Found a date (e.g. Fri 16 Jan) that is NOT in our current view (e.g. week of Jan 19-23).
            // Ignore subsequent lines until we hit a valid date.
            currentProcessingDayId = null; 
        }
        return;
    }

    if (!currentProcessingDayId) return;

    // 2. Scan for "Gross Hours" / "Effective Hours" pattern (e.g. "7h 28m", "5h 37m +")
    // We take the maximum duration found in the block as the Gross Hours
    const durationMatches = trimmed.matchAll(/(\d+)h\s+(\d+)m/g);
    for (const match of durationMatches) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const totalMins = h * 60 + m;
        if (totalMins > dayData[currentProcessingDayId].maxMinutes) {
            dayData[currentProcessingDayId].maxMinutes = totalMins;
        }
    }

    // 3. Scan for Arrival Status
    // "0:50:45 late" or "0:06:42 late"
    const lateMatch = trimmed.match(/(\d+):(\d+)(?::\d+)?\s+late/i);
    if (lateMatch) {
        const h = parseInt(lateMatch[1], 10);
        const m = parseInt(lateMatch[2], 10);
        dayData[currentProcessingDayId].arrivalStatus = 'LATE';
        dayData[currentProcessingDayId].lateMinutes = h * 60 + m;
    } else if (trimmed.match(/\bon time\b/i)) {
        dayData[currentProcessingDayId].arrivalStatus = 'ON_TIME';
    }

    // 4. Scan for separate Leave/Holiday lines
    if (trimmed.match(/\b(Holiday|Paid Leave|Unpaid Leave|Sick Leave|Casual Leave|Weekly-off)\b/i)) {
        dayData[currentProcessingDayId].leaveTagFound = true;
    }
  });

  // Apply parsed data to days
  return newDays.map(day => {
      const data = dayData[day.id];
      // If we have no data collected for this day (and it's not today/future), we just leave it.
      if (!data) return day;

      // If we found explicit hours, calculate times
      if (data.maxMinutes > 0) {
          let startMins = 0;
          let calculatedIn = '';
          let calculatedOut = '';
          
          if (data.arrivalStatus === 'LATE') {
              startMins = timeToMinutes(settings.standardInTime) + data.lateMinutes;
              calculatedIn = minutesToTime(startMins);
          } else if (data.arrivalStatus === 'ON_TIME') {
              startMins = timeToMinutes(settings.standardInTime);
              calculatedIn = minutesToTime(startMins);
          } else {
             // Hours found but no arrival status. Keep punches empty if they were empty.
          }

          if (startMins > 0) {
              calculatedOut = minutesToTime(startMins + data.maxMinutes);
               
               // SPECIAL LOGIC FOR TODAY:
               // If it's today, we are still working. Keka shows partial gross hours.
               // We should import the Punch In and the Gross Hours (so far), 
               // but NOT the Punch Out (as that would imply we left).
               if (day.isToday) {
                   return {
                       ...day,
                       punchIn: calculatedIn,
                       punchOut: '', // Keep empty
                       grossHours: Number((data.maxMinutes / 60).toFixed(4)),
                       leaveType: 'NONE'
                   };
               }

               return {
                   ...day,
                   punchIn: calculatedIn,
                   punchOut: calculatedOut,
                   grossHours: Number((data.maxMinutes / 60).toFixed(4)),
                   leaveType: 'NONE' // Hours exist => Working
               };
          } else {
              // Just update gross hours (e.g. partial manual data found)
               return {
                   ...day,
                   grossHours: Number((data.maxMinutes / 60).toFixed(4)),
                   leaveType: 'NONE'
               };
          }
      }

      // If no hours found, check leave tags
      if (data.leaveTagFound) {
          return {
              ...day,
              punchIn: '',
              punchOut: '',
              grossHours: 0,
              leaveType: 'FULL'
          };
      }

      return day;
  });
};