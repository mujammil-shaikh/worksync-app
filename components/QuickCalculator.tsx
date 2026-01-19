import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, Clock, AlertTriangle, ArrowRight, RotateCcw, Check, Calendar, Info, ShieldCheck } from 'lucide-react';
import { UserSettings, SuggestionResult, LeaveType } from '../types';
import { calculateOutTimeFromMinutes, minutesToDuration } from '../services/timeUtils';
import { WEEKLY_TARGET_HOURS, DAILY_TARGET_HOURS, HALF_DAY_DEDUCTION, FULL_DAY_DEDUCTION, SAFETY_BUFFER_MINUTES } from '../constants';

interface Props {
  settings: UserSettings;
}

const WEEK_DAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' }
];

interface DayInput {
  hours: string;
  minutes: string;
  leave: LeaveType;
}

const QuickCalculator: React.FC<Props> = ({ settings }) => {
  // State for which day is "Today"
  const [currentDayIdx, setCurrentDayIdx] = useState<number>(0); // 0 = Mon, 4 = Fri
  
  // State for Punch In time for "Today"
  const [todayPunchIn, setTodayPunchIn] = useState(settings.standardInTime);
  
  // State for Past/Future Days Inputs
  const [dayInputs, setDayInputs] = useState<Record<string, DayInput>>(() => {
    const initial: Record<string, DayInput> = {};
    WEEK_DAYS.forEach(d => {
      initial[d.id] = { hours: '', minutes: '', leave: 'NONE' };
    });
    return initial;
  });

  const handleDayChange = (id: string, field: keyof DayInput, value: string) => {
    setDayInputs(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleLeaveToggle = (id: string) => {
    setDayInputs(prev => {
      const current = prev[id].leave;
      let next: LeaveType = 'NONE';
      if (current === 'NONE') next = 'HALF';
      else if (current === 'HALF') next = 'FULL';
      else next = 'NONE';

      // If full leave, clear hours
      const updates: Partial<DayInput> = { leave: next };
      if (next === 'FULL') {
        updates.hours = '';
        updates.minutes = '';
      }

      return {
        ...prev,
        [id]: { ...prev[id], ...updates }
      };
    });
  };

  const handleReset = () => {
    const resetInputs: Record<string, DayInput> = {};
    WEEK_DAYS.forEach(d => {
      resetInputs[d.id] = { hours: '', minutes: '', leave: 'NONE' };
    });
    setDayInputs(resetInputs);
    setTodayPunchIn(settings.standardInTime);
    setCurrentDayIdx(0);
  };

  // --- CALCULATION ENGINE (MINUTE PRECISION) ---
  const calculation = useMemo(() => {
    let totalWorkedMinutes = 0;
    let totalDeductionMinutes = 0;
    let futureDaysCount = 0;

    WEEK_DAYS.forEach((day, idx) => {
      const input = dayInputs[day.id];
      const isPast = idx < currentDayIdx;
      const isToday = idx === currentDayIdx;
      const isFuture = idx > currentDayIdx;

      // 1. Calculate Deductions (Reduces Target)
      // Use exact minutes: 9.5 * 60 = 570, 4.75 * 60 = 285
      if (input.leave === 'FULL') totalDeductionMinutes += (FULL_DAY_DEDUCTION * 60);
      if (input.leave === 'HALF') totalDeductionMinutes += (HALF_DAY_DEDUCTION * 60);

      // 2. Calculate Worked Hours (Only relevant for Past)
      if (isPast && input.leave !== 'FULL') {
        const h = parseInt(input.hours || '0', 10);
        const m = parseInt(input.minutes || '0', 10);
        totalWorkedMinutes += (h * 60) + m;
      }

      // 3. Count Available Days to Spread (Today + Future)
      // Only count if not Full Leave
      if ((isToday || isFuture) && input.leave !== 'FULL') {
        futureDaysCount++;
      }
    });

    const weeklyTargetMinutes = WEEKLY_TARGET_HOURS * 60; // 2850
    const adjustedWeeklyTargetMinutes = Math.max(0, weeklyTargetMinutes - totalDeductionMinutes);
    const remainingNeededMinutes = Math.max(0, adjustedWeeklyTargetMinutes - totalWorkedMinutes);
    
    // Distribute remaining needed across available future days (including today)
    // Use Math.ceil to ensure we don't under-calculate. 
    // E.g., if 100 mins over 3 days => 33.33 => suggest 34 mins today to stay ahead.
    const dailyTargetMinutes = Math.ceil(remainingNeededMinutes / Math.max(1, futureDaysCount));

    return {
      totalWorkedMinutes,
      totalDeductionMinutes,
      remainingNeededMinutes,
      futureDaysCount,
      dailyTargetMinutes,
      adjustedWeeklyTargetMinutes
    };
  }, [dayInputs, currentDayIdx]);

  const result: SuggestionResult = useMemo(() => {
    // If today is Full Leave, no punch out needed
    if (dayInputs[WEEK_DAYS[currentDayIdx].id].leave === 'FULL') {
        return { time: 'Off Day', status: 'ok', msg: 'Full Leave Selected' };
    }
    if (!todayPunchIn) return { time: '--:--', status: 'none', msg: '' };
    
    return calculateOutTimeFromMinutes(todayPunchIn, calculation.dailyTargetMinutes, settings);
  }, [todayPunchIn, calculation.dailyTargetMinutes, settings, currentDayIdx, dayInputs]);

  const isImpossible = result.status === 'impossible';
  const isSuggestion = result.status === 'suggestion';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4">
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-lg">
                    <Calculator className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Quick Calculator</h2>
                    <p className="text-xs text-slate-500">Day-by-day breakdown mode.</p>
                </div>
                <button 
                    onClick={handleReset}
                    className="ml-auto text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-full border border-slate-200 hover:bg-white"
                >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                </button>
            </div>

            {/* Day Selector Tabs */}
            <div className="flex p-1 bg-slate-200/50 rounded-xl mt-6">
                {WEEK_DAYS.map((day, idx) => {
                    const isActive = idx === currentDayIdx;
                    return (
                        <button
                            key={day.id}
                            onClick={() => setCurrentDayIdx(idx)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                isActive 
                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            }`}
                        >
                            {day.label}
                        </button>
                    )
                })}
            </div>
            <div className="text-center mt-2">
                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest">
                    Set Current Day
                </span>
            </div>
        </div>

        {/* Dynamic List */}
        <div className="divide-y divide-slate-100">
            {WEEK_DAYS.map((day, idx) => {
                const isPast = idx < currentDayIdx;
                const isToday = idx === currentDayIdx;
                const isFuture = idx > currentDayIdx;
                const input = dayInputs[day.id];
                const isDisabled = input.leave === 'FULL';

                // Row Background Logic
                let rowClass = "p-4 transition-colors flex items-center gap-4 ";
                if (isToday) rowClass += "bg-indigo-50/30";
                else if (isFuture) rowClass += "bg-slate-50/50 opacity-60";
                else rowClass += "bg-white";

                return (
                    <div key={day.id} className={rowClass}>
                        {/* Label */}
                        <div className="w-16 flex flex-col justify-center">
                            <span className={`font-bold text-sm uppercase ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
                                {day.label}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-300">
                                {isPast ? 'PAST' : isToday ? 'TODAY' : 'FUTURE'}
                            </span>
                        </div>

                        {/* Inputs */}
                        <div className="flex-1">
                            {isFuture ? (
                                <div className="text-xs text-slate-400 font-medium italic pl-2">
                                    {input.leave === 'FULL' ? 'Full Leave Planned' : input.leave === 'HALF' ? 'Half Leave Planned' : 'Available for spread'}
                                </div>
                            ) : isToday ? (
                                isDisabled ? (
                                    <div className="text-xs text-slate-400 font-medium italic pl-2">Off Day</div>
                                ) : (
                                    <div className="relative">
                                        <input 
                                            type="time" 
                                            value={todayPunchIn}
                                            onChange={(e) => setTodayPunchIn(e.target.value)}
                                            className="w-full p-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono font-bold text-slate-800 shadow-sm"
                                        />
                                        <span className="absolute right-3 top-2.5 text-[10px] font-bold text-indigo-300 pointer-events-none">IN TIME</span>
                                    </div>
                                )
                            ) : (
                                isDisabled ? (
                                    <div className="text-xs text-slate-400 font-medium italic pl-2">Off Day</div>
                                ) : (
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input 
                                                type="number" 
                                                placeholder="0"
                                                value={input.hours}
                                                onChange={(e) => handleDayChange(day.id, 'hours', e.target.value)}
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono font-bold text-slate-800"
                                            />
                                            <span className="absolute right-2 top-2.5 text-[10px] font-bold text-slate-300 pointer-events-none">H</span>
                                        </div>
                                        <div className="relative flex-1">
                                            <input 
                                                type="number" 
                                                placeholder="0"
                                                max="59"
                                                value={input.minutes}
                                                onChange={(e) => handleDayChange(day.id, 'minutes', e.target.value)}
                                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono font-bold text-slate-800"
                                            />
                                            <span className="absolute right-2 top-2.5 text-[10px] font-bold text-slate-300 pointer-events-none">M</span>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Leave Toggle */}
                        <button
                            onClick={() => handleLeaveToggle(day.id)}
                            className={`px-2 py-1.5 rounded text-[10px] font-bold border transition-all w-16
                                ${input.leave === 'NONE' ? 'bg-white border-slate-200 text-slate-400 hover:border-slate-300' : 
                                  input.leave === 'HALF' ? 'bg-purple-50 border-purple-200 text-purple-600' : 
                                  'bg-slate-100 border-slate-200 text-slate-500'}`}
                        >
                            {input.leave === 'NONE' ? 'WORK' : input.leave === 'HALF' ? 'HALF' : 'LEAVE'}
                        </button>
                    </div>
                );
            })}
        </div>
        
        {/* Calc Breakdown Stats */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 grid grid-cols-2 gap-4 text-xs text-slate-500">
           <div>
               <span className="block font-bold text-slate-700 uppercase mb-0.5">Total Worked</span>
               <span className="font-mono">{minutesToDuration(calculation.totalWorkedMinutes)}</span>
           </div>
           <div>
               <span className="block font-bold text-slate-700 uppercase mb-0.5">Left to Work</span>
               <span className="font-mono">{minutesToDuration(calculation.remainingNeededMinutes)}</span>
           </div>
        </div>
      </div>

      {/* Result Card */}
      <div className={`p-6 rounded-2xl shadow-lg border-2 transition-all duration-300 transform
        ${isImpossible ? 'bg-red-50 border-red-200' : isSuggestion ? 'bg-amber-50 border-amber-200' : 'bg-indigo-600 border-indigo-600 text-white'}`}
      >
         <div className="flex justify-between items-start mb-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${isImpossible || isSuggestion ? 'text-slate-600' : 'text-indigo-200'}`}>
                Suggested Punch Out ({WEEK_DAYS[currentDayIdx].label})
            </span>
            {isSuggestion && (
                <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full animate-pulse">
                    Action Required
                </span>
            )}
         </div>

         <div className="flex items-baseline gap-2 mt-1">
             <h1 className={`text-5xl font-mono font-bold tracking-tighter ${isImpossible ? 'text-red-600' : isSuggestion ? 'text-amber-700' : 'text-white'}`}>
                {result.time}
             </h1>
             <span className={`text-sm font-medium ${isImpossible ? 'text-red-400' : isSuggestion ? 'text-amber-600' : 'text-indigo-200'}`}>
                {isImpossible ? 'Limit Reached' : 'Today'}
             </span>
         </div>

         <div className={`mt-4 pt-4 border-t ${isImpossible ? 'border-red-200' : isSuggestion ? 'border-amber-200' : 'border-indigo-500/30'}`}>
             <div className="flex items-center gap-3">
                 {isImpossible ? <AlertTriangle className="w-5 h-5 text-red-500" /> : isSuggestion ? <AlertTriangle className="w-5 h-5 text-amber-600" /> : <ShieldCheck className="w-5 h-5 text-indigo-300" />}
                 <div>
                     <p className={`text-sm font-bold ${isImpossible ? 'text-red-700' : isSuggestion ? 'text-amber-800' : 'text-white'}`}>
                        {result.msg} {result.status === 'ok' && `(+${SAFETY_BUFFER_MINUTES}m safe buffer)`}
                     </p>
                     <p className={`text-xs mt-0.5 ${isImpossible ? 'text-red-500' : isSuggestion ? 'text-amber-700' : 'text-indigo-200'}`}>
                        Target for Today: {minutesToDuration(calculation.dailyTargetMinutes)}
                     </p>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
};

export default QuickCalculator;